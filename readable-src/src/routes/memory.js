import { Router } from "express";
import { memoryService } from "../services/memoryService.js";
import { audit } from "../middleware/audit.js";
export const memoryRouter = Router();

// Saved facts (two-tier: ?source=alicia|experiential)
memoryRouter.get("/memory/facts", (req, res) => {
  res.json({ ok: true, facts: memoryService.listFacts(req.query.source) });
});
memoryRouter.post("/memory/facts", audit("create", "memory_fact"), (req, res, next) => {
  try {
    const { text, fact, category, source } = req.body || {};
    const body = text || fact; // accept either field name
    if (!body) return res.status(400).json({ ok: false, error: "TEXT_REQUIRED" });
    res.json({ ok: true, ...memoryService.saveFact(body, category, source || "alicia") });
  } catch (e) { next(e); }
});
memoryRouter.delete("/memory/facts/:id", audit("delete", "memory_fact"), (req, res) => {
  res.json({ ok: true, ...memoryService.deleteFact(req.params.id) });
});
// Short-term context
memoryRouter.get("/memory/context", (req, res) => {
  res.json({ ok: true, context: memoryService.getContext(req.query.key) });
});
memoryRouter.post("/memory/context", audit("set", "memory_context"), (req, res, next) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ ok: false, error: "KEY_REQUIRED" });
    res.json({ ok: true, ...memoryService.setContext(key, value) });
  } catch (e) { next(e); }
});
// Daily summaries
memoryRouter.get("/memory/summaries", (req, res) => {
  res.json({ ok: true, summaries: memoryService.listSummaries() });
});
memoryRouter.post("/memory/summaries", audit("save", "daily_summary"), (req, res, next) => {
  try {
    const { date, summary } = req.body || {};
    if (!date || !summary) return res.status(400).json({ ok: false, error: "DATE_AND_SUMMARY_REQUIRED" });
    res.json({ ok: true, ...memoryService.saveSummary(date, summary) });
  } catch (e) { next(e); }
});
memoryRouter.get("/memory/counts", (_req, res) => {
  res.json({ ok: true, ...memoryService.counts() });
});
