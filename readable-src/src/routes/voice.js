import { Router } from "express";
import { config } from "../config.js";
import { auditLog } from "../middleware/audit.js";
export const voiceRouter = Router();

// Voice server hooks (Spec 15). Browser-side speech works in the dashboard;
// a dedicated voice server attaches here in integration.
voiceRouter.get("/voice/status", (_req, res) => {
  res.json({ ok: true, server: "not_attached",
    note: "Voice server attaches in Caelia integration. Dashboard uses browser speech meanwhile." });
});
voiceRouter.post("/voice/speak", (req, res) => {
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ ok: false, error: "TEXT_REQUIRED" });
  auditLog("voice", "", "speak", { len: text.length });
  res.json({ ok: true, queued: true,
    note: "Spoken via dashboard speech synthesis until the voice server attaches." });
});
