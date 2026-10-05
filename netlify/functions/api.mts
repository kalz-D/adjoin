import type { Config, Context } from "@netlify/functions";
import {
  attempts,
  checkNewPassword,
  clearAttempts,
  createSession,
  createUser,
  deleteUser,
  endAllSessions,
  endSession,
  findUserByEmail,
  findUserById,
  getViewer,
  normaliseEmail,
  recordAttempt,
  requireAdmin,
  requireViewer,
  saveUser,
  type Viewer,
} from "../lib/auth.mts";
import { hashPassword, randomId, spendPasswordCheck, temporaryPassword, verifyPassword } from "../lib/crypto.mts";
import { deployContext, examplesEnabled } from "../lib/env.mts";
import { exampleProfile, exampleSummaries } from "../lib/examples.mts";
import { assertSameOrigin, errorResponse, HttpError, json, readJson } from "../lib/http.mts";
import {
  adminView,
  applyEdits,
  blankProfile,
  fullView,
  isKind,
  loadAllProfiles,
  loadProfile,
  MAX_PHOTOS,
  missingForReview,
  OPTIONS,
  ownerView,
  saveProfile,
  summaryView,
  type ProfileRecord,
} from "../lib/profiles.mts";
import { listKeys, store } from "../lib/stores.mts";

const MINUTE = 60_000;
const PAGE_SIZE = 5;
const MAX_PHOTO_BYTES = 4.5 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

type Handler = (req: Request, context: Context, params: string[]) => Promise<Response>;

/* ---- Helpers ---- */

async function browseAccess(context: Context, viewer: Viewer) {
  const mine = await loadProfile(context, viewer.userId);
  return { mine, allowed: viewer.isAdmin || mine?.status === "live" };
}

function looksLikeImage(bytes: Uint8Array, ext: string): boolean {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (ext === "jpg") return at(0, [0xff, 0xd8, 0xff]);
  if (ext === "png") return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (ext === "webp") return at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50]);
  return false;
}

async function profileOrBlank(context: Context, viewer: Viewer): Promise<ProfileRecord> {
  return (await loadProfile(context, viewer.userId)) ?? blankProfile(viewer.userId, viewer.email);
}

/* ---- Auth ---- */

const signup: Handler = async (req, context) => {
  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  const password = checkNewPassword(body.password);

  const ipKey = `signup-ip:${context.ip}`;
  if ((await attempts(context, ipKey)) >= 8) {
    throw new HttpError(429, "slow_down", "Too many new accounts from here. Please try again in an hour.");
  }
  await recordAttempt(context, ipKey, 60 * MINUTE);

  const user = await createUser(context, email, password);
  if (!user) throw new HttpError(409, "exists", "There's already an account with that email. Sign in instead.");
  await createSession(context, user);
  return json({ ok: true }, 201);
};

const login: Handler = async (req, context) => {
  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";

  const emailKey = `login-email:${email}`;
  const ipKey = `login-ip:${context.ip}`;
  if ((await attempts(context, emailKey)) >= 8 || (await attempts(context, ipKey)) >= 30) {
    throw new HttpError(429, "slow_down", "Too many attempts. Please wait 15 minutes and try again.");
  }

  const user = await findUserByEmail(context, email);
  let ok = false;
  if (user) ok = await verifyPassword(password, user.passwordHash);
  else await spendPasswordCheck(password);

  if (!user || !ok) {
    await Promise.all([recordAttempt(context, emailKey, 15 * MINUTE), recordAttempt(context, ipKey, 15 * MINUTE)]);
    throw new HttpError(401, "bad_credentials", "That email and password don't match.");
  }
  await clearAttempts(context, emailKey);
  await createSession(context, user);
  return json({ ok: true });
};

const logout: Handler = async (_req, context) => {
  await endSession(context, await getViewer(context));
  return json({ ok: true });
};

/* ---- Your account and profile ---- */

const getMe: Handler = async (_req, context) => {
  const viewer = await requireViewer(context);
  const { mine, allowed } = await browseAccess(context, viewer);
  const profile = mine ?? blankProfile(viewer.userId, viewer.email);
  return json({
    user: { email: viewer.email, isAdmin: viewer.isAdmin },
    profile: ownerView(profile),
    hasProfile: Boolean(mine),
    canBrowse: allowed,
    options: OPTIONS,
  });
};

const putProfile: Handler = async (req, context) => {
  const viewer = await requireViewer(context);
  const body = await readJson(req);
  const next = applyEdits(await profileOrBlank(context, viewer), body);
  await saveProfile(context, next);
  return json({ profile: ownerView(next) });
};

const submitProfile: Handler = async (_req, context) => {
  const viewer = await requireViewer(context);
  const profile = await profileOrBlank(context, viewer);
  const missing = missingForReview(profile);
  if (missing.length) {
    throw new HttpError(400, "incomplete", `Before we can review it, add ${missing.join(", ")}.`);
  }
  if (profile.status !== "live") {
    profile.status = "pending";
    profile.submittedAt = new Date().toISOString();
    await saveProfile(context, profile);
  }
  return json({ profile: ownerView(profile) });
};

const uploadPhoto: Handler = async (req, context) => {
  const viewer = await requireViewer(context);
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = PHOTO_TYPES[type];
  if (!ext) throw new HttpError(415, "bad_type", "Photos need to be JPEG, PNG or WebP.");
  if (Number(req.headers.get("content-length") || 0) > MAX_PHOTO_BYTES) {
    throw new HttpError(413, "too_large", "That photo is too large. Try one under 4 MB.");
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.byteLength) throw new HttpError(400, "empty", "That photo was empty.");
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new HttpError(413, "too_large", "That photo is too large. Try one under 4 MB.");
  if (!looksLikeImage(bytes, ext)) throw new HttpError(415, "bad_image", "That file doesn't look like a photo.");

  const slot = new URL(req.url).searchParams.get("slot") === "hero" ? "hero" : "gallery";
  const profile = await profileOrBlank(context, viewer);
  if (slot === "gallery" && profile.photos.length >= MAX_PHOTOS) {
    throw new HttpError(400, "too_many", `You can have up to ${MAX_PHOTOS} photos.`);
  }

  const photos = store(context, "photos");
  const key = `${viewer.userId}/${randomId(12)}.${ext}`;
  await photos.set(key, new Blob([bytes], { type }));

  if (slot === "hero") {
    const previous = profile.photos[0];
    profile.photos = [key, ...profile.photos.slice(1)];
    if (previous) await photos.delete(previous);
  } else {
    profile.photos = [...profile.photos, key];
  }
  profile.updatedAt = new Date().toISOString();
  await saveProfile(context, profile);
  return json({ profile: ownerView(profile) }, 201);
};

const deletePhoto: Handler = async (_req, context, [file]) => {
  const viewer = await requireViewer(context);
  const profile = await profileOrBlank(context, viewer);
  const key = `${viewer.userId}/${file}`;
  if (!profile.photos.includes(key)) throw new HttpError(404, "not_found", "That photo has already gone.");
  profile.photos = profile.photos.filter((k) => k !== key);
  profile.updatedAt = new Date().toISOString();
  await Promise.all([store(context, "photos").delete(key), saveProfile(context, profile)]);
  return json({ profile: ownerView(profile) });
};

const makeHero: Handler = async (_req, context, [file]) => {
  const viewer = await requireViewer(context);
  const profile = await profileOrBlank(context, viewer);
  const key = `${viewer.userId}/${file}`;
  if (!profile.photos.includes(key)) throw new HttpError(404, "not_found", "We couldn't find that photo.");
  profile.photos = [key, ...profile.photos.filter((k) => k !== key)];
  profile.updatedAt = new Date().toISOString();
  await saveProfile(context, profile);
  return json({ profile: ownerView(profile) });
};

const changePassword: Handler = async (req, context) => {
  const viewer = await requireViewer(context);
  const body = await readJson(req);
  const user = await findUserById(context, viewer.userId);
  if (!user) throw new HttpError(401, "signed_out", "Please sign in.");
  const current = typeof body.current === "string" ? body.current.slice(0, 200) : "";
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw new HttpError(400, "bad_password", "Your current password isn't right.");
  }
  user.passwordHash = await hashPassword(checkNewPassword(body.next));
  await saveUser(context, user);
  await endAllSessions(context, user.id);
  await createSession(context, user);
  return json({ ok: true });
};

const deleteAccount: Handler = async (req, context) => {
  const viewer = await requireViewer(context);
  const body = await readJson(req);
  const user = await findUserById(context, viewer.userId);
  if (!user) throw new HttpError(401, "signed_out", "Please sign in.");
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(400, "bad_password", "That password isn't right.");
  }

  const photos = store(context, "photos");
  const intros = store(context, "intros");
  const [photoKeys, introKeys] = await Promise.all([listKeys(photos, `${user.id}/`), listKeys(intros)]);
  const involvesUser = (key: string) => key.startsWith(`${user.id}/`) || key.endsWith(`/${user.id}`);
  await Promise.all([
    ...photoKeys.map((key) => photos.delete(key)),
    ...introKeys.filter(involvesUser).map((key) => intros.delete(key)),
    store(context, "profiles").delete(user.id),
  ]);
  await endAllSessions(context, user.id);
  await deleteUser(context, user);
  await endSession(context, null);
  return json({ ok: true });
};

/* ---- Browsing ---- */

const getCircle: Handler = async (req, context) => {
  const viewer = await requireViewer(context);
  const { mine, allowed } = await browseAccess(context, viewer);
  const url = new URL(req.url);
  const requested = url.searchParams.get("kind");
  const kind = isKind(requested) ? requested : mine?.kind || "desk";
  const page = Math.max(0, Math.min(500, Number.parseInt(url.searchParams.get("page") || "0", 10) || 0));

  let profiles: ReturnType<typeof summaryView>[] = [];
  let total = 0;
  if (allowed) {
    const area = (mine?.area || "").toLowerCase();
    const pool = (await loadAllProfiles(context))
      .filter((p) => p.status === "live" && p.userId !== viewer.userId && p.kind === kind)
      .sort((a, b) => {
        const nearA = area && a.area.toLowerCase() === area ? 1 : 0;
        const nearB = area && b.area.toLowerCase() === area ? 1 : 0;
        return nearB - nearA || b.updatedAt.localeCompare(a.updatedAt);
      });
    total = pool.length;
    profiles = pool.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(summaryView);
  }

  return json({
    kind,
    page,
    pageSize: PAGE_SIZE,
    total,
    locked: !allowed,
    status: mine?.status ?? "none",
    profiles,
    examples: examplesEnabled(context) ? exampleSummaries() : [],
  });
};

const getProfile: Handler = async (_req, context, [id]) => {
  const viewer = await requireViewer(context);
  if (id.startsWith("example-")) {
    const example = examplesEnabled(context) ? exampleProfile(id) : null;
    if (!example) throw new HttpError(404, "not_found", "We couldn't find that profile.");
    return json({ profile: example, isOwn: false });
  }

  const target = await loadProfile(context, id);
  if (!target) throw new HttpError(404, "not_found", "We couldn't find that profile.");
  if (target.userId === viewer.userId) {
    return json({ profile: fullView(target), isOwn: true, status: target.status });
  }

  const { allowed } = await browseAccess(context, viewer);
  // A normal response rather than 403: CDNs and the dev proxy retry 403/404s as file lookups.
  if (!allowed) return json({ locked: true });
  if (target.status !== "live" && !viewer.isAdmin) {
    throw new HttpError(404, "not_found", "We couldn't find that profile.");
  }
  return json({ profile: fullView(target), isOwn: false, status: viewer.isAdmin ? target.status : undefined });
};

const getPhoto: Handler = async (_req, context, [ownerId, file]) => {
  const viewer = await requireViewer(context);
  const key = `${ownerId}/${file}`;

  if (ownerId !== viewer.userId && !viewer.isAdmin) {
    const [{ allowed }, owner] = await Promise.all([browseAccess(context, viewer), loadProfile(context, ownerId)]);
    if (!allowed || !owner || owner.status !== "live" || !owner.photos.includes(key)) {
      throw new HttpError(404, "not_found", "Not found.");
    }
  }

  const data = await store(context, "photos").get(key, { type: "arrayBuffer" });
  if (!data) throw new HttpError(404, "not_found", "Not found.");
  const ext = file.split(".").pop() || "";
  return new Response(data, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
};

const requestIntro: Handler = async (req, context) => {
  const viewer = await requireViewer(context);
  const body = await readJson(req);
  const to = typeof body.to === "string" ? body.to : "";
  if (to.startsWith("example-")) {
    throw new HttpError(400, "example", "That's an example profile, so there's no one to introduce you to.");
  }
  const { mine, allowed } = await browseAccess(context, viewer);
  if (!allowed) throw new HttpError(403, "locked", "Introductions open up once we've welcomed you in.");
  const target = to && to !== viewer.userId ? await loadProfile(context, to) : null;
  if (!target || target.status !== "live") throw new HttpError(404, "not_found", "We couldn't find that profile.");

  const message = typeof body.message === "string" ? body.message.replace(/\r\n?/g, "\n").trim().slice(0, 600) : "";
  await store(context, "intros").setJSON(`${target.userId}/${viewer.userId}`, {
    fromUserId: viewer.userId,
    fromEmail: viewer.email,
    fromBusiness: mine?.businessName || "",
    toUserId: target.userId,
    toEmail: target.ownerEmail,
    toBusiness: target.businessName,
    message,
    createdAt: new Date().toISOString(),
  });
  return json({ ok: true }, 201);
};

/* ---- Admin ---- */

const adminSummary: Handler = async (_req, context) => {
  await requireAdmin(context);
  const intros = store(context, "intros");
  const [profiles, introKeys] = await Promise.all([loadAllProfiles(context), listKeys(intros)]);
  const introList = (await Promise.all(introKeys.map((key) => intros.get(key, { type: "json" }))))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 200);
  return json({
    profiles: profiles
      .sort((a, b) => (b.submittedAt || b.updatedAt).localeCompare(a.submittedAt || a.updatedAt))
      .map(adminView),
    intros: introList,
  });
};

const adminSetStatus: Handler = async (req, context, [id]) => {
  await requireAdmin(context);
  const body = await readJson(req);
  const status = body.status;
  if (status !== "live" && status !== "hidden" && status !== "pending") {
    throw new HttpError(400, "bad_status", "Choose live, hidden or pending.");
  }
  const profile = await loadProfile(context, id);
  if (!profile) throw new HttpError(404, "not_found", "We couldn't find that profile.");
  profile.status = status;
  profile.reviewedAt = new Date().toISOString();
  await saveProfile(context, profile);
  return json({ profile: adminView(profile) });
};

const adminResetPassword: Handler = async (req, context) => {
  await requireAdmin(context);
  const body = await readJson(req);
  const user = await findUserByEmail(context, normaliseEmail(body.email));
  if (!user) throw new HttpError(404, "not_found", "There's no account with that email.");
  const temporary = temporaryPassword();
  user.passwordHash = await hashPassword(temporary);
  await saveUser(context, user);
  await endAllSessions(context, user.id);
  return json({ email: user.email, temporaryPassword: temporary });
};

const health: Handler = async (_req, context) => json({ ok: true, context: deployContext(context) });

const session: Handler = async (_req, context) => json({ signedIn: Boolean(await getViewer(context)) });

/* ---- Routing ---- */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_FILE = "[A-Za-z0-9_-]{16}\\.(?:jpg|png|webp)";

const routes: [string, RegExp, Handler][] = [
  ["GET", /^\/api\/health$/, health],
  ["GET", /^\/api\/session$/, session],
  ["POST", /^\/api\/auth\/signup$/, signup],
  ["POST", /^\/api\/auth\/login$/, login],
  ["POST", /^\/api\/auth\/logout$/, logout],
  ["GET", /^\/api\/me$/, getMe],
  ["DELETE", /^\/api\/me$/, deleteAccount],
  ["PUT", /^\/api\/me\/profile$/, putProfile],
  ["POST", /^\/api\/me\/submit$/, submitProfile],
  ["POST", /^\/api\/me\/password$/, changePassword],
  ["POST", /^\/api\/me\/photos$/, uploadPhoto],
  ["DELETE", new RegExp(`^/api/me/photos/(${PHOTO_FILE})$`), deletePhoto],
  ["POST", new RegExp(`^/api/me/photos/(${PHOTO_FILE})/hero$`), makeHero],
  ["GET", /^\/api\/circle$/, getCircle],
  ["GET", new RegExp(`^/api/profiles/(${UUID}|example-[a-z]+)$`), getProfile],
  ["GET", new RegExp(`^/api/photos/(${UUID})/(${PHOTO_FILE})$`), getPhoto],
  ["POST", /^\/api\/intros$/, requestIntro],
  ["GET", /^\/api\/admin$/, adminSummary],
  ["POST", new RegExp(`^/api/admin/profiles/(${UUID})$`), adminSetStatus],
  ["POST", /^\/api\/admin\/reset-password$/, adminResetPassword],
];

export default async (req: Request, context: Context) => {
  try {
    assertSameOrigin(req);
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    let pathMatched = false;
    for (const [method, pattern, handler] of routes) {
      const match = pattern.exec(path);
      if (!match) continue;
      pathMatched = true;
      if (req.method === method) return await handler(req, context, match.slice(1));
    }
    throw pathMatched
      ? new HttpError(405, "method_not_allowed", "That action isn't allowed here.")
      : new HttpError(404, "not_found", "Not found.");
  } catch (err) {
    return errorResponse(err);
  }
};

export const config: Config = {
  path: "/api/*",
};
