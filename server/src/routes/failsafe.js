import { Router } from "express";
import { all, get, run } from "../db/index.js";
import { auditLog } from "../middleware/audit.js";
import { postOpsAlert } from "../discord/alerts.js";
export const failsafeRouter = Router();

// BrainAPI.failsafe contract: POST /failsafe — priority channel that
// bypasses the normal queue. Alicia can reach Caelia even in a crisis.
// Logged immediately; delivery flag flips when the Brain integration
// acknowledges (Kallel).
failsafeRouter.post("/failsafe", (req, res, next) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt?.trim()) return res.status(400).json({ ok: false, error: "PROMPT_REQUIRED" });
    const r = run("INSERT INTO failsafe_log (prompt) VALUES (?)", prompt.trim());
    const row = get("SELECT * FROM failsafe_log WHERE id=?", r.lastInsertRowid);
    auditLog("failsafe", row.id, "prompt", { priority: true });
    // Operations alert: the Discord bot posts this to the Operations channel
    // when connected (no-op otherwise). Never includes the prompt text.
    postOpsAlert(`Failsafe prompt #${row.id} logged with priority at ${row.created_at}.`);
    res.json({ ok: true, ...row, note: "Failsafe prompt logged with priority. Delivery confirms when Caelia's Brain is connected." });
  } catch (e) { next(e); }
});
failsafeRouter.get("/failsafe", (_req, res) => {
  res.json({ ok: true, log: all("SELECT * FROM failsafe_log ORDER BY id DESC LIMIT 50") });
});
