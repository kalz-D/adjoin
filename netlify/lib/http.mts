export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error(err);
  return json(
    { error: { code: "server_error", message: "Something went wrong on our side. Please try again." } },
    500,
  );
}

const MAX_JSON_BYTES = 32 * 1024;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    throw new HttpError(415, "bad_type", "Expected JSON.");
  }
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_JSON_BYTES) {
    throw new HttpError(413, "too_large", "That's more than we can take in one go.");
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(buf) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "bad_json", "We couldn't read that request.");
  }
}

// Cookies are SameSite=Lax, but state-changing requests also have to come from this site.
export function assertSameOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new HttpError(403, "cross_site", "Request blocked.");
  }
  const origin = req.headers.get("origin");
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === new URL(req.url).host;
    } catch {
      sameHost = false;
    }
    if (!sameHost) throw new HttpError(403, "cross_site", "Request blocked.");
  }
}
