import { Router } from "express";
import { teachService } from "../services/teachService.js";
import { audit } from "../middleware/audit.js";
import { brainTeach } from "../services/brainClient.js";
export const teachRouter = Router();

// BrainAPI.teach contract: POST /teach { directive, source:"alicia" }
// Owner-only (route sits behind requireAuth). Pipeline:
// information -> process -> verify -> relevance -> permission -> retention
// Also forwards the directive to Caelia's brain so her learning tracer records it
// as "taught by Alicia". The local queue is kept either way.
teachRouter.post("/teach", audit("submit", "teach"), async (req, res, next) => {
  try {
    const { directive } = req.body || {};
    const local = teachService.submit(directive);
    const b = await brainTeach(String(directive || ""), "Alicia");
    res.json({
      ok: true,
      ...local,
      brain: b.ok ? { queued: true, id: b.data?.id } : { queued: false, error: b.error },
    });
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
