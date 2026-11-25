import { Router } from "express";
import { teachService } from "../services/teachService.js";
import { audit } from "../middleware/audit.js";
export const teachRouter = Router();

// BrainAPI.teach contract: POST /teach { directive, source:"alicia" }
// Owner-only (route sits behind requireAuth). Pipeline:
// information -> process -> verify -> relevance -> permission -> retention
teachRouter.post("/teach", audit("submit", "teach"), (req, res, next) => {
  try {
    const { directive } = req.body || {};
    res.json({ ok: true, ...teachService.submit(directive) });
  } catch (e) { next(e); }
});
teachRouter.get("/teach", (req, res) => {
  res.json({ ok: true, queue: teachService.list(req.query.stage) });
});
// Advance one pipeline stage. Permission stage requires { granted:true }.
teachRouter.post("/teach/:id/advance", audit("advance", "teach"), (req, res, next) => {
  try {
    res.json({ ok: true, ...teachService.advance(req.params.id, req.body || {}) });
  } catch (e) { next(e); }
});
