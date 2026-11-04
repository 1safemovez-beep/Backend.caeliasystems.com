import { Router } from "express";
import { brainConfigured, brainHealth } from "../services/brainClient.js";
import { loginRouter } from "./login.js";
import { passwordConfigured } from "../services/session.js";
export const healthRouter = Router();

// Sign-in routes are public (they sit before the /api auth gate).
healthRouter.use(loginRouter);

// Public — no auth. Load balancers and uptime checks hit this.
healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "caelia-motherboard-backend", version: "1.0.0", time: new Date().toISOString() });
});

// Public, non-sensitive: the Motherboard and avatar call this to show
// whether the backend and Caelia's brain are connected. No secrets returned.
healthRouter.get("/api/health", async (_req, res) => {
  const configured = brainConfigured();
  const h = configured.url ? await brainHealth() : { ok: false, error: "BRAIN_URL_NOT_SET" };
  res.json({
    ok: true,
    service: "caelia-motherboard-backend",
    time: new Date().toISOString(),
    passwordSignIn: passwordConfigured(),
    brain: {
      urlSet: configured.url,
      tokenSet: configured.token,
      reachable: !!h.ok,
      authConfigured: h.ok ? !!h.data?.authConfigured : undefined,
      error: h.ok ? undefined : h.error,
    },
  });
});
