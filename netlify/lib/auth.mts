import { randomUUID } from "node:crypto";
import type { Context } from "@netlify/functions";
import { hashPassword, randomId, sha256 } from "./crypto.mts";
import { adminEmails } from "./env.mts";
import { HttpError } from "./http.mts";
import { listKeys, store } from "./stores.mts";

const COOKIE_NAME = "adj_session";
const SESSION_DAYS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface SessionRecord {
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface Viewer {
  userId: string;
  email: string;
  isAdmin: boolean;
  sessionKey: string;
}

export function normaliseEmail(raw: unknown): string {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, "bad_email", "Enter a valid email address.");
  }
  return email;
}

export function checkNewPassword(raw: unknown): string {
  const password = typeof raw === "string" ? raw : "";
  if (password.length < 8) throw new HttpError(400, "weak_password", "Use at least 8 characters for your password.");
  if (password.length > 200) throw new HttpError(400, "long_password", "That password is too long.");
  return password;
}

const emailKey = (email: string) => `email/${sha256(email)}`;
const idKey = (id: string) => `id/${id}`;

export async function findUserByEmail(context: Context, email: string): Promise<UserRecord | null> {
  return (await store(context, "users").get(emailKey(email), { type: "json" })) as UserRecord | null;
}

export async function findUserById(context: Context, id: string): Promise<UserRecord | null> {
  const users = store(context, "users");
  const ref = (await users.get(idKey(id), { type: "json" })) as { emailHash: string } | null;
  if (!ref) return null;
  return (await users.get(`email/${ref.emailHash}`, { type: "json" })) as UserRecord | null;
}

// Returns null when the email is already registered; onlyIfNew makes this race-free.
export async function createUser(context: Context, email: string, password: string): Promise<UserRecord | null> {
  const users = store(context, "users");
  const record: UserRecord = {
    id: randomUUID(),
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  const result = await users.setJSON(emailKey(email), record, { onlyIfNew: true });
  if (!result.modified) return null;
  await users.setJSON(idKey(record.id), { emailHash: sha256(email) });
  return record;
}

export async function saveUser(context: Context, user: UserRecord): Promise<void> {
  await store(context, "users").setJSON(emailKey(user.email), user);
}

export async function deleteUser(context: Context, user: UserRecord): Promise<void> {
  const users = store(context, "users");
  await Promise.all([users.delete(emailKey(user.email)), users.delete(idKey(user.id))]);
}

export async function createSession(context: Context, user: UserRecord): Promise<void> {
  const token = randomId(32);
  const now = Date.now();
  const record: SessionRecord = {
    userId: user.id,
    email: user.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DAYS * 86400_000).toISOString(),
  };
  await store(context, "sessions").setJSON(`${user.id}/${sha256(token)}`, record);
  context.cookies.set({
    name: COOKIE_NAME,
    value: `${user.id}.${token}`,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function getViewer(context: Context): Promise<Viewer | null> {
  const raw = context.cookies.get(COOKIE_NAME) || "";
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const userId = raw.slice(0, dot);
  const token = raw.slice(dot + 1);
  if (!UUID_PATTERN.test(userId) || !TOKEN_PATTERN.test(token)) return null;

  const sessionKey = `${userId}/${sha256(token)}`;
  const sessions = store(context, "sessions");
  const session = (await sessions.get(sessionKey, { type: "json" })) as SessionRecord | null;
  if (!session || session.userId !== userId) return null;
  if (Date.parse(session.expiresAt) < Date.now()) {
    await sessions.delete(sessionKey);
    return null;
  }
  return { userId, email: session.email, isAdmin: adminEmails().has(session.email), sessionKey };
}

export async function requireViewer(context: Context): Promise<Viewer> {
  const viewer = await getViewer(context);
  if (!viewer) throw new HttpError(401, "signed_out", "Please sign in.");
  return viewer;
}

export async function requireAdmin(context: Context): Promise<Viewer> {
  const viewer = await requireViewer(context);
  if (!viewer.isAdmin) throw new HttpError(403, "not_admin", "That's for Adjoin admins only.");
  return viewer;
}

export async function endSession(context: Context, viewer: Viewer | null): Promise<void> {
  if (viewer) await store(context, "sessions").delete(viewer.sessionKey);
  context.cookies.delete({ name: COOKIE_NAME, path: "/" });
}

export async function endAllSessions(context: Context, userId: string): Promise<void> {
  const sessions = store(context, "sessions");
  const keys = await listKeys(sessions, `${userId}/`);
  await Promise.all(keys.map((key) => sessions.delete(key)));
}

/* ---- Throttling for sign-in and sign-up ---- */

interface Counter {
  count: number;
  resetAt: number;
}

async function readCounter(context: Context, key: string): Promise<Counter | null> {
  const counter = (await store(context, "throttle").get(sha256(key), { type: "json" })) as Counter | null;
  return counter && counter.resetAt > Date.now() ? counter : null;
}

export async function attempts(context: Context, key: string): Promise<number> {
  return (await readCounter(context, key))?.count ?? 0;
}

export async function recordAttempt(context: Context, key: string, windowMs: number): Promise<void> {
  const current = await readCounter(context, key);
  const next: Counter = current
    ? { count: current.count + 1, resetAt: current.resetAt }
    : { count: 1, resetAt: Date.now() + windowMs };
  await store(context, "throttle").setJSON(sha256(key), next);
}

export async function clearAttempts(context: Context, key: string): Promise<void> {
  await store(context, "throttle").delete(sha256(key));
}
