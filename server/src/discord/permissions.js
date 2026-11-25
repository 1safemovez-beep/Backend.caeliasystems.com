// Discord permission model — explicit allow-list + explicit deny-list.
// The bot is a Server 2 (motherboard operations) interface. It must NEVER
// touch Server 1 (Caelia Core): no Core/Soul writes, no protected memory,
// no vault reads, no failsafe triggers. Every denied attempt is audit-logged.
import { auditLog } from "../middleware/audit.js";

// Actions the bot is explicitly allowed to perform.
export const ALLOW = new Set([
  "post_message_ops",    // post status/alerts to the Operations channel
  "respond_voice",       // reply in Caelia Voice (text side)
  "respond_private",     // reply in Caelia Private + owner DMs
  "respond_agents",      // reply in AI/Agent Room
  "queue_evaluation",    // !evaluate -> engine job queue (never runs inline)
  "voice_join",          // join a voice channel (presence only)
  "voice_leave",         // leave a voice channel (presence only)
  "status_report",       // !status -> readiness summary
  "ask_forward",         // !ask -> forwards to chat contract (honest when brain unwired)
]);

// Actions explicitly forbidden, no matter who asks.
export const DENY = new Set([
  "core_write",          // never write to Caelia Core/Soul
  "memory_write",        // never write to protected memory containers
  "vault_read",          // never read vault secrets via Discord
  "failsafe_trigger",    // never trigger the failsafe channel
  "delegate",            // never delegate to agents beyond evaluation queueing
  "admin",               // never change backend config/admin state
  "token_access",        // the token itself is never exposed, echoed, or logged
]);

export function isAllowed(action) {
  return ALLOW.has(action) && !DENY.has(action);
}

// ownerId: Alicia's Discord user id (DISCORD_OWNER_ID). Only she may command.
export function isOwner(userId, ownerId) {
  return Boolean(userId && ownerId && String(userId) === String(ownerId));
}

// Enforce + audit. Returns true if allowed; logs and returns false if denied.
export function checkDiscordPermission(action, { userId = "", ownerId = "", channel = "" } = {}) {
  if (DENY.has(action)) {
    auditLog("discord", "", "permission_denied", { action, reason: "deny_list", channel });
    return false;
  }
  if (!ALLOW.has(action)) {
    auditLog("discord", "", "permission_denied", { action, reason: "not_allow_listed", channel });
    return false;
  }
  // Command-type actions are owner-only; passive posting (ops alerts) is
  // system-initiated and checked by the caller instead.
  const ownerOnly = new Set(["queue_evaluation", "status_report", "ask_forward",
    "voice_join", "voice_leave", "respond_voice", "respond_private", "respond_agents"]);
  if (ownerOnly.has(action) && !isOwner(userId, ownerId)) {
    auditLog("discord", "", "permission_denied",
      { action, reason: "not_owner", user: String(userId).slice(0, 24), channel });
    return false;
  }
  return true;
}
