import type { IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";

/** API calls need the start token and, when the browser sends one, our own Origin. */
export function authorize(req: IncomingMessage, url: URL, token: string, origin: string): boolean {
  const given = url.searchParams.get("t") ?? req.headers["x-specyard-token"];
  if (typeof given !== "string" || !sameSecret(given, token)) return false;
  return req.headers.origin === undefined || req.headers.origin === origin;
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
