// Owner-only auth. Accepts either:
//   - the long OWNER_TOKEN (servers and tools), or
//   - a device pass from signing in with OWNER_PASSWORD (Motherboard, avatar).
// All /api/* routes require: Authorization: Bearer <token or pass>
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { verifySession } from "../services/session.js";

function tokenMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (tokenMatches(token, config.ownerToken)) {
    req.actor = "alicia";
    return next();
  }
  const session = verifySession(token);
  if (session) {
    req.actor = "alicia";
    req.session = session;
    return next();
  }
  return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
}
