import { Router } from "express";
import { automationService } from "../services/automationService.js";
import { audit } from "../middleware/audit.js";
export const automationsRouter = Router();

automationsRouter.get("/automations", (_req, res) => {
  res.json({ ok: true, automations: automationService.list() });
});
automationsRouter.post("/automations", audit("create", "automation"), (req, res, next) => {
  try { res.json({ ok: true, ...automationService.create(req.body || {}) }); }
  catch (e) { next(e); }
});
automationsRouter.post("/automations/:id/toggle", audit("toggle", "automation"), (req, res, next) => {
  try { res.json({ ok: true, ...automationService.toggle(req.params.id) }); }
  catch (e) { next(e); }
});
automationsRouter.post("/automations/:id/run", audit("run", "automation"), (req, res, next) => {
  try { res.json({ ok: true, ...automationService.runNow(req.params.id) }); }
  catch (e) { next(e); }
});
