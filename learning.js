import { Router } from "express";
import { analyticsService } from "../services/analyticsService.js";
export const learningRouter = Router();

// Learning numbers/percentages for the dashboard orbs (Spec 26)
learningRouter.get("/learning/metrics", (_req, res) => {
  const caelia = analyticsService.caelia();
  res.json({
    ok: true,
    core: caelia.learning.retentionPct,           // core learning %
    experiential: 0,                              // experiential % — computed in integration
    ethics: 0,                                    // ethics % — computed from soul lessons in integration
    detail: caelia.learning,
    note: "Experiential/ethics percentages compute live once Caelia's Brain is integrated.",
  });
});
