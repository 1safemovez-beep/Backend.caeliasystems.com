import { Router } from "express";
import { tokenMatches, createSession, destroySession, sessionValid, sessionCookie } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { auditLog } from "../middleware/audit.js";
import { config, allowedOrigins } from "../config.js";
export const authRouter = Router();

// Strict limiter on credential guessing: 8 attempts / 15 min / IP.
const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 8, name: "login" });
const originOk = (req) => { const o = req.headers.origin; return !o || allowedOrigins().includes(o); };

// POST /auth/login { token } -> sets HttpOnly session cookie. The token is
// checked server-side and never stored in the browser.
authRouter.post("/auth/login", loginLimit, (req, res) => {
  if (!originOk(req)) return res.status(403).json({ ok: false, error: "BAD_ORIGIN" });
  if (!tokenMatches(req.body?.token)) {
    auditLog("auth", "", "login_failed", { actor: "anonymous", ip: req.ip });
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  const id = createSession(req);
  auditLog("auth", "", "login", { ip: req.ip });
  res.setHeader("set-cookie", sessionCookie(id, config.sessionTtlHours * 3600));
  res.json({ ok: true, expiresInHours: config.sessionTtlHours });
});
authRouter.post("/auth/logout", (req, res) => {
  if (!originOk(req)) return res.status(403).json({ ok: false, error: "BAD_ORIGIN" });
  destroySession(req);
  res.setHeader("set-cookie", sessionCookie("", 0));
  res.json({ ok: true });
});
authRouter.get("/auth/session", (req, res) => res.json({ ok: true, authenticated: sessionValid(req) }));
