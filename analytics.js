import { Router } from "express";
import { analyticsService } from "../services/analyticsService.js";
export const analyticsRouter = Router();

// Bottom boxes: aggregated analytics from all connected satellites (incl. mall)
analyticsRouter.get("/analytics/overview", (_req, res) => {
  res.json({ ok: true, ...analyticsService.overview() });
});
analyticsRouter.get("/analytics/satellites", (_req, res) => {
  res.json({ ok: true, satellites: analyticsService.satellites() });
});
// Caelia's OWN learning/activity/performance (Spec 17)
analyticsRouter.get("/analytics/caelia", (_req, res) => {
  res.json({ ok: true, ...analyticsService.caelia() });
});
