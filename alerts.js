// Operations alerts — backend system events auto-posted to the Operations
// channel when the bot is connected. Posting is system-initiated (not a user
// command); the permission model still gates it via "post_message_ops".
// Call sites: failsafe prompts, engine job failures, audit anomalies.
// Safe to call when disconnected — it no-ops.
import { auditLog } from "../middleware/audit.js";

let poster = null; // set by bot.js once the client is ready

export function setOpsPoster(fn) {
  poster = fn;
}

export async function postOpsAlert(text) {
  if (!poster) return { ok: false, error: "DISCORD_OFFLINE" };
  try {
    const clean = String(text || "").slice(0, 1800);
    if (!clean) return { ok: false, error: "EMPTY" };
    await poster(`🔔 **Ops alert**\n${clean}`);
    auditLog("discord", "", "ops_alert_posted", { len: clean.length });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "POST_FAILED" };
  }
}
