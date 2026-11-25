import { Router } from "express";
export const healthRouter = Router();
// Public — no auth. Load balancers and uptime checks hit this.
healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "caelia-motherboard-backend", version: "1.0.0", time: new Date().toISOString() });
});
