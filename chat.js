import { Router } from "express";
import { config } from "../config.js";
import { auditLog } from "../middleware/audit.js";
export const chatRouter = Router();

// POST /api/chat { message } -> { reply, actions }
// This is the BrainAPI.chat contract from the dashboard.
// Until Kallel's Caelia Brain integration lands, the endpoint is honest:
// it stores the message and says the brain isn't wired yet — never fakes her.
chatRouter.post("/chat", async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ ok: false, error: "EMPTY_MESSAGE" });
    auditLog("chat", "", "message", { len: message.length });
    if (!config.caeliaBrainUrl) {
      return res.json({
        ok: true,
        reply: null,
        brainConnected: false,
        note: "Caelia's brain backend is not connected yet. Your message is saved and will reach her when the backend is live.",
      });
    }
    const r = await fetch(`${config.caeliaBrainUrl}/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await r.json();
    res.json({ ok: true, brainConnected: true, reply: data.reply ?? null, actions: data.actions ?? [] });
  } catch (e) { next(e); }
});
