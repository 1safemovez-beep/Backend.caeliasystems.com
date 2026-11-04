// Simple sign-in for Alicia: one memorable password (OWNER_PASSWORD) instead of
// typing the long OWNER_TOKEN. A correct password gives the device a signed pass
// that lasts SESSION_DAYS (default 90).
//
// Safety:
//  - The pass is signed with a key made from OWNER_TOKEN + OWNER_PASSWORD, so
//    changing either one instantly signs out every device.
//  - 5 wrong passwords from one address → that address is locked for 15 minutes.
//  - 30 wrong passwords in an hour from anywhere → all sign-ins pause for an hour.
import { createHmac, createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { config } from "../config.js";

const DAYS = Number(process.env.SESSION_DAYS || 90);
const PER_IP_MAX = 5, PER_IP_WINDOW = 15 * 60_000;
const GLOBAL_MAX = 30, GLOBAL_WINDOW = 60 * 60_000;

// Ignore spaces/quotes accidentally saved around the password in Railway.
const password = () => String(process.env.OWNER_PASSWORD || "").trim().replace(/^(["'])(.*)\1$/, "$2");
export const passwordConfigured = () => password().length > 0 && !!config.ownerToken;

function key() {
  return createHmac("sha256", String(config.ownerToken || ""))
    .update("caelia-session:" + password())
    .digest();
}
const b64 = (buf) => Buffer.from(buf).toString("base64url");

export function issueSession(device = "") {
  const now = Date.now();
  const payload = { v: 1, sid: randomUUID(), iat: now, exp: now + DAYS * 86_400_000, dev: String(device).slice(0, 40) };
  const body = b64(JSON.stringify(payload));
  const sig = b64(createHmac("sha256", key()).update(body).digest());
  return { token: "cs1." + body + "." + sig, expiresAt: new Date(payload.exp).toISOString() };
}

export function verifySession(token) {
  if (!passwordConfigured() || typeof token !== "string" || !token.startsWith("cs1.")) return null;
  const [, body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", key()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

export function passwordMatches(given) {
  if (!passwordConfigured() || typeof given !== "string") return false;
  // Compare fixed-length hashes so timing doesn't reveal anything.
  // Ignore spaces a phone or copy-paste added before/after the password.
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(password()).digest();
  return timingSafeEqual(a, b);
}

// ---- lockout ----
const perIp = new Map();
let globalFails = [];
// Prefer addresses set by Cloudflare / Railway's proxy over ones a client could fake.
// (The 30-per-hour limit for everyone still applies if someone fakes an address.)
export function clientIp(req) {
  const h = req.headers || {};
  if (h["cf-connecting-ip"]) return String(h["cf-connecting-ip"]).trim();
  if (h["x-real-ip"]) return String(h["x-real-ip"]).trim();
  const xff = String(h["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : String(req.socket?.remoteAddress || "unknown");
}
export function lockedOut(ip) {
  const now = Date.now();
  globalFails = globalFails.filter((t) => now - t < GLOBAL_WINDOW);
  if (globalFails.length >= GLOBAL_MAX) return { locked: true, scope: "all", retryAfterSec: Math.ceil((GLOBAL_WINDOW - (now - globalFails[0])) / 1000) };
  const e = perIp.get(ip);
  if (e && now - e.start < PER_IP_WINDOW && e.count >= PER_IP_MAX) {
    return { locked: true, scope: "ip", retryAfterSec: Math.ceil((PER_IP_WINDOW - (now - e.start)) / 1000) };
  }
  return { locked: false };
}
export function recordFailure(ip) {
  const now = Date.now();
  globalFails.push(now);
  const e = perIp.get(ip);
  if (!e || now - e.start > PER_IP_WINDOW) perIp.set(ip, { start: now, count: 1 });
  else e.count += 1;
}
export function clearFailures(ip) { perIp.delete(ip); }
