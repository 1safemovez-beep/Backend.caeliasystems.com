import { Router } from "express";
import { all } from "../db/index.js";
import { quantvantageEngine, personalEngine, checkReadiness, engineJobs } from "../engines/quantvantage.js";
import { audit } from "../middleware/audit.js";
export const enginesRouter = Router();

const registry = { "qv-pro": quantvantageEngine, "personal-commercial": personalEngine };

enginesRouter.get("/engines", (_req, res) => {
  const dbEngines = all("SELECT * FROM engines");
  res.json({
    ok: true,
    engines: dbEngines.map((e) => ({ ...e, live: registry[e.name]?.describe?.() || null })),
  });
});

// "What Caelia needs to function" — engine readiness tracker (names only, never values)
enginesRouter.get("/engines/readiness", (_req, res) => {
  res.json({ ok: true, readiness: checkReadiness() });
});

// Queue a commercial evaluation: POST /api/engines/evaluate { target_name, context_notes?, engine? }
// Caelia (post-integration) triggers evaluations here — this is her evaluation contract.
enginesRouter.post("/engines/evaluate", audit("evaluate", "engine"), async (req, res, next) => {
  try {
    const body = req.body || {};
    const eng = registry[body.engine] || quantvantageEngine;
    const result = await eng.run(body);
    if (!result.ok) return res.status(400).json(result);
    res.status(202).json({ ok: true, engine: eng.id, ...result });
  } catch (e) { next(e); }
});

// Evaluation jobs
enginesRouter.get("/engines/evaluations", (req, res) => {
  res.json({ ok: true, evaluations: engineJobs.list(req.query.limit) });
});
enginesRouter.get("/engines/evaluations/:id", (req, res) => {
  const job = engineJobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  let result = null;
  try { result = job.result_json ? JSON.parse(job.result_json) : null; } catch { /* keep null */ }
  res.json({ ok: true, job: { ...job, result_json: undefined, result } });
});

// BrainAPI.runEngine contract: POST /engines/{id}/run
enginesRouter.post("/engines/:id/run", audit("run", "engine"), async (req, res, next) => {
  try {
    const eng = registry[req.params.id];
    if (!eng) return res.status(404).json({ ok: false, error: "UNKNOWN_ENGINE" });
    const result = await eng.run(req.body?.params || req.body || {});
    if (!result.ok && result.error === "BAD_INPUT") return res.status(400).json({ ok: true, engine: eng.id, ...result });
    res.json({ ok: true, engine: eng.id, ...result });
  } catch (e) { next(e); }
});
