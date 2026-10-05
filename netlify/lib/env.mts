import type { Context } from "@netlify/functions";

// Example profiles are for reviewing the design. They never appear on the live site
// unless ADJOIN_EXAMPLES=on is set deliberately.
const PREVIEW_CONTEXTS = new Set(["dev", "deploy-preview", "branch-deploy", "draft"]);

export function deployContext(context: Context): string {
  return context?.deploy?.context || "";
}

export function isProduction(context: Context): boolean {
  return deployContext(context) === "production";
}

export function examplesEnabled(context: Context): boolean {
  const flag = (Netlify.env.get("ADJOIN_EXAMPLES") || "").toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return PREVIEW_CONTEXTS.has(deployContext(context));
}

export function adminEmails(): Set<string> {
  return new Set(
    (Netlify.env.get("ADJOIN_ADMIN_EMAILS") || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
