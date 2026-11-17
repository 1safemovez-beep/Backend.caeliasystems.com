import { Router } from "express";
import { delegationService } from "../services/delegationService.js";
import { all } from "../db/index.js";
import { audit } from "../middleware/audit.js";
export const agentsRouter = Router();

// Agent registry
agentsRouter.get("/agents", (_req, res) => {
  res.json({ ok: true, agents: all("SELECT * FROM agents") });
});
// Delegation switchboard entries (also reachable via /api/bridge/delegate)
agentsRouter.get("/agents/delegations", (req, res) => {
  res.json({ ok: true, delegations: delegationService.list() });
});
agentsRouter.post("/agents/:name/delegate", audit("delegate", "agent"), (req, res, next) => {
  try {
    res.json({ ok: true, ...delegationService.delegate(req.params.name, req.body?.task) });
  } catch (e) { next(e); }
});
agentsRouter.post("/agents/delegations/:id/progress", audit("progress", "delegation"), (req, res, next) => {
  try {
    res.json({ ok: true, ...delegationService.progress(req.params.id, req.body?.progress) });
  } catch (e) { next(e); }
});
agentsRouter.post("/agents/delegations/:id/complete", audit("complete", "delegation"), (req, res, next) => {
  try {
    res.json({ ok: true, ...delegationService.complete(req.params.id, req.body?.result) });
  } catch (e) { next(e); }
});
