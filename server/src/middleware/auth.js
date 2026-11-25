// Owner-only auth. Two accepted credentials, both verified server-side:
//   1. Session cookie (browser): issued by POST /auth/login after the owner
//      types OWNER_TOKEN once. HttpOnly, so frontend JS can never read it.
//   2. Authorization: Bearer <OWNER_TOKEN> (scripts / server-to-server).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config, allowedOrigins } from "../config.js";
import { run, get } from "../db/index.js";
import { auditLog } from "./audit.js";

export const COOKIE = "caelia_session";
const sha = (v) => createHash("sha256").update(v).digest("hex");

export function tokenMatches(candidate) {
  if (!config.ownerToken || config.ownerToken.startsWith("PASTE_") || !candidate) return false;
  const a = createHash("sha256").update(String(candidate)).digest();
  const b = createHash("sha256").update(config.ownerToken).digest();
  return timingSafeEqual(a, b);
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

export function createSession(req) {
  const id = randomBytes(32).toString("hex");
  run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  run("INSERT INTO sessions (id_hash, expires_at, ip) VALUES (?, datetime('now', ?), ?)",
    sha(id), `+${config.sessionTtlHours} hours`, req.ip || "");
  return id;
}
export const sessionCookie = (id, maxAgeSec) =>
  `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${config.cookieSecure ? "; Secure" : ""}`;

export function sessionValid(req) {
  const id = readCookie(req, COOKIE);
  if (!id) return false;
  return !!get("SELECT 1 AS ok FROM sessions WHERE id_hash=? AND expires_at > datetime('now')", sha(id));
}
export function destroySession(req) {
  const id = readCookie(req, COOKIE);
  if (id) run("DELETE FROM sessions WHERE id_hash=?", sha(id));
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (bearer && tokenMatches(bearer)) { req.actor = "alicia"; req.authVia = "bearer"; return next(); }
  if (sessionValid(req)) {
    // Cookie auth is ambient, so mutating requests must come from the dashboard origin (CSRF).
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (!origin || !allowedOrigins().includes(origin)) {
        return res.status(403).json({ ok: false, error: "BAD_ORIGIN" });
      }
    }
    req.actor = "alicia"; req.authVia = "session"; return next();
  }
  try { auditLog("auth", "", "denied", { path: req.path, ip: req.ip }); } catch { /* never break the request */ }
  return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
}
