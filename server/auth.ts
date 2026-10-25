import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ApiError, type Config } from "./config";
function cookies(req: IncomingMessage) {
  return Object.fromEntries(
    (req.headers.cookie ?? "").split(";").map((p) => p.trim().split("=")),
  );
}
function signature(value: string, c: Config) {
  return createHmac("sha256", c.sessionSecret).update(value).digest("hex");
}
function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
function cookie(res: ServerResponse, name: string, value: string, c: Config) {
  const existing = res.getHeader("Set-Cookie");
  const all = Array.isArray(existing)
    ? existing
    : existing
      ? [String(existing)]
      : [];
  res.setHeader("Set-Cookie", [
    ...all,
    `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${c.serverless ? "; Secure" : ""}`,
  ]);
}
export function session(req: IncomingMessage, res: ServerResponse, c: Config) {
  if (!c.sessionSecret)
    throw new ApiError(
      503,
      "Backend SESSION_SECRET is not configured. Offline demo remains available.",
    );
  const raw = cookies(req).backstop_session ?? "";
  const [id, mac] = raw.split(".");
  if (id && /^[a-f0-9-]{36}$/.test(id) && equal(mac ?? "", signature(id, c)))
    return id;
  const created = randomUUID();
  cookie(res, "backstop_session", created + "." + signature(created, c), c);
  return created;
}
export function isOperator(req: IncomingMessage, owner: string, c: Config) {
  const local =
    !c.serverless &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket?.remoteAddress ?? "",
    );
  return (
    local ||
    equal(
      cookies(req).backstop_operator ?? "",
      signature("operator:" + owner, c),
    )
  );
}
export function requireOperator(
  req: IncomingMessage,
  owner: string,
  c: Config,
) {
  if (!isOperator(req, owner, c))
    throw new ApiError(
      403,
      "A demo-operator session is required for live paid integrations. The offline demo is still available.",
    );
}
export function unlockOperator(
  req: IncomingMessage,
  res: ServerResponse,
  owner: string,
  c: Config,
  token: unknown,
) {
  checkOrigin(req, c);
  if (
    typeof token !== "string" ||
    !c.operatorToken ||
    !equal(token, c.operatorToken)
  )
    throw new ApiError(403, "Invalid demo-operator token.");
  cookie(res, "backstop_operator", signature("operator:" + owner, c), c);
}
export function checkOrigin(req: IncomingMessage, c: Config) {
  const origin = req.headers.origin;
  if (!origin) return;
  const allowed = [new URL(c.appOrigin).origin];
  if (!c.serverless)
    allowed.push(
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3001",
      "http://localhost:3001",
    );
  if (!allowed.includes(origin))
    throw new ApiError(403, "Cross-origin mutation refused.");
}
