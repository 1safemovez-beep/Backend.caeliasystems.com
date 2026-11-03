import { Router } from "express";
import { auditLog } from "../middleware/audit.js";
import { brainThink, replyText, reasoningMode } from "../services/brainClient.js";
export const chatRouter = Router();

// POST /api/chat { message } -> { reply, actions, brainConnected, note }
// Used by the Motherboard dashboard and the Caelia avatar.
// Forwards to the Caelia Brain service (/api/brain/think). Never fakes her words:
// if the brain returns no text, reply is null and `note` says why.
chatRouter.post("/chat", async (req, res, next) => {
  try {
    const { message, source } = req.body || {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "EMPTY_MESSAGE" });
    }
    if (message.length > 4000) return res.status(413).json({ ok: false, error: "MESSAGE_TOO_LONG" });
    auditLog("chat", "", "message", { len: message.length, source: String(source || "motherboard").slice(0, 32) });

    const r = await brainThink(message.trim(), String(source || "motherboard").slice(0, 32));
    if (!r.ok) {
      return res.json({
        ok: true,
        reply: null,
        brainConnected: false,
        error: r.error,
        note: r.error === "BRAIN_URL_NOT_SET" || r.error === "BRAIN_TOKEN_NOT_SET"
          ? "Caelia's brain is not connected yet: set CAELIA_BRAIN_URL and CAELIA_BRAIN_TOKEN on the backend service."
          : r.status === 401
            ? "Caelia's brain refused the backend's key: CAELIA_BRAIN_TOKEN on the backend must match OWNER_TOKEN on the brain service."
            : `Couldn't reach Caelia's brain (${r.error}). Your message was logged.`,
      });
    }
    const result = r.data?.result ?? null;
    const reply = replyText(result);
    const mode = reasoningMode(result);
    res.json({
      ok: true,
      brainConnected: true,
      reply,
      actions: Array.isArray(result?.actions) ? result.actions : [],
      reasoning: mode,
      note: reply
        ? undefined
        : "Caelia's brain received this and logged it. Her reasoning model isn't attached yet, so she has no spoken answer.",
    });
  } catch (e) { next(e); }
});
