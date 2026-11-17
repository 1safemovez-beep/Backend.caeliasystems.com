import { Router } from "express";
import { auditLog } from "../middleware/audit.js";
import {
  passwordConfigured, passwordMatches, issueSession, verifySession,
  clientIp, lockedOut, recordFailure, clearFailures,
} from "../services/session.js";
export const loginRouter = Router();

function safeAudit(action, detail) {
  try { auditLog("login", "", action, detail); } catch { /* never block sign-in */ }
}

// POST /api/login { password, device? } -> { ok, token, expiresAt }
loginRouter.post("/api/login", (req, res) => {
  const ip = clientIp(req);
  if (!passwordConfigured()) {
    return res.status(503).json({ ok: false, error: "PASSWORD_NOT_SET", note: "Set OWNER_PASSWORD on the backend service in Railway." });
  }
  const lock = lockedOut(ip);
  if (lock.locked) {
    res.setHeader("retry-after", String(lock.retryAfterSec));
    safeAudit("locked", { ip, scope: lock.scope });
    return res.status(429).json({ ok: false, error: "TOO_MANY_TRIES", retryAfterSec: lock.retryAfterSec,
      note: `Too many wrong passwords. Try again in ${Math.ceil(lock.retryAfterSec / 60)} minutes.` });
  }
  const { password, device } = req.body || {};
  if (!passwordMatches(password)) {
    recordFailure(ip);
    safeAudit("failed", { ip });
    return res.status(401).json({ ok: false, error: "WRONG_PASSWORD" });
  }
  clearFailures(ip);
  const s = issueSession(device);
  safeAudit("signed-in", { ip, device: String(device || "").slice(0, 40) });
  res.json({ ok: true, token: s.token, expiresAt: s.expiresAt });
});

// GET /api/session -> is this device's pass still good?
loginRouter.get("/api/session", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const s = verifySession(token);
  if (!s) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  res.json({ ok: true, expiresAt: new Date(s.exp).toISOString() });
});
