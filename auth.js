// Owner-only auth. Alicia's token lives in ENV, never in code.
// All /api/* routes require: Authorization: Bearer <token>.
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

const failures = new Map();
const WINDOW_MS = 60_000;
const MAX_FAILURES = 20;

function clientKey(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0].trim();
}

function tokenMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function rateLimited(key) {
  const now = Date.now();
  const item = failures.get(key);
  if (!item || now - item.started > WINDOW_MS) {
    failures.set(key, { started: now, count: 0 });
    return false;
  }
  return item.count >= MAX_FAILURES;
}

function recordFailure(key) {
  const now = Date.now();
  const item = failures.get(key);
  if (!item || now - item.started > WINDOW_MS) {
    failures.set(key, { started: now, count: 1 });
  } else {
    item.count += 1;
  }
}

export function requireAuth(req, res, next) {
  const key = clientKey(req);
  if (rateLimited(key)) {
    res.setHeader("retry-after", "60");
    return res.status(429).json({ ok: false, error: "AUTH_RATE_LIMITED" });
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!tokenMatches(token, config.ownerToken)) {
    recordFailure(key);
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  failures.delete(key);
  req.actor = "alicia";
  next();
}
