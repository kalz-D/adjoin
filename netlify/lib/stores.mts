import { getDeployStore, getStore, type Store } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import { isProduction } from "./env.mts";

export type StoreName = "users" | "sessions" | "profiles" | "photos" | "intros" | "throttle";

// Real member data lives in site-wide stores on the published site only. Draft deploys
// and local dev get deploy-scoped stores, so test accounts never mix with real ones.
export function store(context: Context, name: StoreName): Store {
  const fullName = `adjoin-${name}`;
  return isProduction(context)
    ? getStore({ name: fullName, consistency: "strong" })
    : getDeployStore({ name: fullName, consistency: "strong" });
}

export async function listKeys(s: Store, prefix?: string): Promise<string[]> {
  const { blobs } = await s.list(prefix ? { prefix } : undefined);
  return blobs.map((b) => b.key);
}
