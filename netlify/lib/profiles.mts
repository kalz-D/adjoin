import type { Context } from "@netlify/functions";
import { HttpError } from "./http.mts";
import { listKeys, store } from "./stores.mts";

export const KINDS = {
  desk: "Studios and desks",
  services: "Boutique services",
  workshop: "Workshops and trades",
} as const;

export const SPACE_SIZES = {
  desk: "A desk or two",
  room: "Small room, 10 to 20 m²",
  studio: "Studio, 20 to 50 m²",
  floor: "Workshop or floor, 50 m² plus",
} as const;

export const TIMINGS = {
  now: "As soon as possible",
  soon: "In the next 3 months",
  later: "In the next 6 months",
  exploring: "Just exploring",
} as const;

export const SHARE = {
  "1": "One other business",
  "2": "Two others",
  "3": "Three others",
  "4": "Four others",
  open: "Open to it",
} as const;

export const NEEDS = {
  clients: "Clients visiting",
  quiet: "Quiet",
  water: "Water or a sink",
  power: "Heavy power",
  roller: "Roller door",
  storage: "Storage",
  parking: "Parking",
} as const;

export const OPTIONS = { kinds: KINDS, spaceSizes: SPACE_SIZES, timings: TIMINGS, share: SHARE, needs: NEEDS };

export const MAX_PHOTOS = 4;

export type Kind = keyof typeof KINDS;
export type Status = "draft" | "pending" | "live" | "hidden";

export interface ProfileRecord {
  userId: string;
  ownerEmail: string;
  personName: string;
  businessName: string;
  trade: string;
  kind: Kind | "";
  area: string;
  headline: string;
  about: string;
  spaceSize: string;
  timing: string;
  shareWith: string;
  needs: string[];
  neighbours: string;
  website: string;
  instagram: string;
  photos: string[];
  status: Status;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && Object.hasOwn(KINDS, value);
}

export function blankProfile(userId: string, email: string): ProfileRecord {
  const now = new Date().toISOString();
  return {
    userId,
    ownerEmail: email,
    personName: "",
    businessName: "",
    trade: "",
    kind: "",
    area: "",
    headline: "",
    about: "",
    spaceSize: "",
    timing: "",
    shareWith: "",
    needs: [],
    neighbours: "",
    website: "",
    instagram: "",
    photos: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

/* ---- Input cleaning ---- */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function line(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function paragraphs(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function choice(value: unknown, options: Record<string, string>): string {
  return typeof value === "string" && Object.hasOwn(options, value) ? value : "";
}

function website(value: unknown): string {
  const raw = line(value, 200);
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new HttpError(400, "bad_website", "That website address doesn't look right.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "bad_website", "That website address doesn't look right.");
  }
  if (!url.hostname.includes(".")) {
    throw new HttpError(400, "bad_website", "That website address doesn't look right.");
  }
  return url.toString();
}

function instagram(value: unknown): string {
  const raw = line(value, 120)
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
  if (!raw) return "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw)) {
    throw new HttpError(400, "bad_instagram", "Use just your Instagram handle, like @yourstudio.");
  }
  return raw;
}

// Only fields present in the input change, so the editor can save one section at a time.
export function applyEdits(profile: ProfileRecord, input: Record<string, unknown>): ProfileRecord {
  const next = { ...profile };
  const has = (key: string) => Object.hasOwn(input, key);
  if (has("personName")) next.personName = line(input.personName, 60);
  if (has("businessName")) next.businessName = line(input.businessName, 80);
  if (has("trade")) next.trade = line(input.trade, 60);
  if (has("kind")) next.kind = isKind(input.kind) ? input.kind : "";
  if (has("area")) next.area = line(input.area, 60);
  if (has("headline")) next.headline = line(input.headline, 140);
  if (has("about")) next.about = paragraphs(input.about, 1500);
  if (has("spaceSize")) next.spaceSize = choice(input.spaceSize, SPACE_SIZES);
  if (has("timing")) next.timing = choice(input.timing, TIMINGS);
  if (has("shareWith")) next.shareWith = choice(input.shareWith, SHARE);
  if (has("needs")) {
    const list = Array.isArray(input.needs) ? input.needs : [];
    next.needs = [...new Set(list.filter((n): n is string => typeof n === "string" && Object.hasOwn(NEEDS, n)))];
  }
  if (has("neighbours")) next.neighbours = paragraphs(input.neighbours, 400);
  if (has("website")) next.website = website(input.website);
  if (has("instagram")) next.instagram = instagram(input.instagram);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function missingForReview(p: ProfileRecord): string[] {
  const missing: string[] = [];
  if (!p.photos.length) missing.push("a hero photo");
  if (!p.personName) missing.push("your name");
  if (!p.businessName) missing.push("your business name");
  if (!p.trade) missing.push("what you do");
  if (!p.kind) missing.push("your kind of work");
  if (!p.area) missing.push("where you're based");
  if (!p.headline) missing.push("a one-line headline");
  if (p.about.length < 40) missing.push("a few sentences about you");
  if (!p.spaceSize) missing.push("how much room you need");
  return missing;
}

/* ---- Storage ---- */

export async function loadProfile(context: Context, userId: string): Promise<ProfileRecord | null> {
  return (await store(context, "profiles").get(userId, { type: "json" })) as ProfileRecord | null;
}

export async function saveProfile(context: Context, profile: ProfileRecord): Promise<void> {
  await store(context, "profiles").setJSON(profile.userId, profile);
}

export async function loadAllProfiles(context: Context): Promise<ProfileRecord[]> {
  const profiles = store(context, "profiles");
  const keys = await listKeys(profiles);
  const records = await Promise.all(keys.map((key) => profiles.get(key, { type: "json" })));
  return records.filter(Boolean) as ProfileRecord[];
}

/* ---- What each viewer gets to see ---- */

export function photoUrl(key: string): string {
  return `/api/photos/${key}`;
}

function firstName(name: string): string {
  return name.split(" ")[0] || "";
}

export interface ProfileSummary {
  id: string;
  example?: boolean;
  personName: string;
  businessName: string;
  trade: string;
  kind: string;
  kindLabel: string;
  area: string;
  headline: string;
  lookingFor: { label: string; value: string }[];
  needs: string[];
  hero: string | null;
}

function lookingFor(p: Pick<ProfileRecord, "spaceSize" | "shareWith" | "timing">) {
  const facts: { label: string; value: string }[] = [];
  if (p.spaceSize) facts.push({ label: "Space", value: SPACE_SIZES[p.spaceSize as keyof typeof SPACE_SIZES] });
  if (p.shareWith) facts.push({ label: "Sharing with", value: SHARE[p.shareWith as keyof typeof SHARE] });
  if (p.timing) facts.push({ label: "Timing", value: TIMINGS[p.timing as keyof typeof TIMINGS] });
  return facts;
}

export function summaryView(p: ProfileRecord): ProfileSummary {
  return {
    id: p.userId,
    personName: firstName(p.personName),
    businessName: p.businessName,
    trade: p.trade,
    kind: p.kind,
    kindLabel: p.kind ? KINDS[p.kind] : "",
    area: p.area,
    headline: p.headline,
    lookingFor: lookingFor(p),
    needs: p.needs.map((n) => NEEDS[n as keyof typeof NEEDS]).filter(Boolean),
    hero: p.photos[0] ? photoUrl(p.photos[0]) : null,
  };
}

export function fullView(p: ProfileRecord) {
  return {
    ...summaryView(p),
    about: p.about,
    neighbours: p.neighbours,
    website: p.website,
    instagram: p.instagram,
    gallery: p.photos.slice(1).map(photoUrl),
    memberSince: p.createdAt.slice(0, 7),
  };
}

// The owner sees their raw values too, so the editor can fill its fields.
export function ownerView(p: ProfileRecord) {
  return {
    ...fullView(p),
    raw: {
      personName: p.personName,
      businessName: p.businessName,
      trade: p.trade,
      kind: p.kind,
      area: p.area,
      headline: p.headline,
      about: p.about,
      spaceSize: p.spaceSize,
      timing: p.timing,
      shareWith: p.shareWith,
      needs: p.needs,
      neighbours: p.neighbours,
      website: p.website,
      instagram: p.instagram,
    },
    photos: p.photos.map((key) => ({ key: key.split("/")[1], url: photoUrl(key) })),
    status: p.status,
    missing: missingForReview(p),
  };
}

export function adminView(p: ProfileRecord) {
  return {
    ...summaryView(p),
    email: p.ownerEmail,
    status: p.status,
    submittedAt: p.submittedAt || null,
    updatedAt: p.updatedAt,
    missing: missingForReview(p).length,
  };
}
