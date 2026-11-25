import { Router } from "express";
import { config } from "../config.js";
import { auditLog } from "../middleware/audit.js";
import { brainClient } from "../services/brainClient.js";
export const chatRouter = Router();

// POST /api/chat { message } -> { ok, brainConnected, reply, actions }
// Forwards to the Brain with the server-held credential. Never fabricates a reply.
chatRouter.post("/chat", async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ ok: false, error: "EMPTY_MESSAGE" });
    auditLog("chat", "", "message", { len: message.length });
    if (!config.caeliaBrainUrl) {
      return res.json({
        ok: true, reply: null, brainConnected: false,
        note: "Caelia's brain backend is not connected yet. Your message is saved and will reach her when the backend is live.",
      });
    }
    const r = await brainClient.chat(message);
    if (!r.ok) {
      auditLog("chat", "", "brain_error", { error: r.error, upstreamStatus: r.upstreamStatus });
      return res.status(502).json({ ok: false, brainConnected: false, error: r.error, upstreamStatus: r.upstreamStatus,
        note: "The backend could not get a reply from the Brain." });
    }
    const d = r.data || {};
    res.json({ ok: true, brainConnected: true, reply: d.reply ?? d.message ?? d.response ?? null, actions: d.actions ?? [], ms: r.ms });
  } catch (e) { next(e); }
});
