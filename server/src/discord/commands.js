// Discord command handling — owner-only, every command audited.
// Alicia (DISCORD_OWNER_ID) is the only commander. Anyone else gets a polite
// refusal and the attempt is audit-logged. The bot never fakes Caelia.
import { config } from "../config.js";
import { auditLog } from "../middleware/audit.js";
import { checkDiscordPermission } from "./permissions.js";
import { checkReadiness, quantvantageEngine } from "../engines/quantvantage.js";
import { joinVoiceChannel, leaveVoiceChannel, inVoice } from "./voice.js";

const PREFIX = "!";

function politeRefusal() {
  return "Sorry — I only take commands from Alicia. 💜";
}

function helpText() {
  return [
    "**Caelia Discord commands** (Alicia only)",
    "`!status` — backend + engine readiness",
    "`!evaluate <app name>` — queue a commercial evaluation",
    "`!ask <question>` — ask Caelia (honest while her brain is being wired)",
    "`!join-voice` / `!leave-voice` — voice channel presence",
    "`!help` — this list",
  ].join("\n");
}

async function cmdStatus() {
  const r = checkReadiness();
  const lines = r.checks.map((c) => `${c.present ? "🟢" : "🔴"} ${c.name}`);
  return [
    `**Backend:** online · engine **${r.live ? "LIVE" : "needs setup"}**`,
    ...lines,
  ].join("\n");
}

async function cmdEvaluate(args) {
  const target = args.join(" ").trim();
  if (!target) return "Usage: `!evaluate <app name>`";
  const res = await quantvantageEngine.run({ target_name: target, source: "discord" });
  if (!res.ok) return `Couldn't queue that: ${res.error}`;
  return `✅ Evaluation queued for **${target}** (job #${res.job_id}). I'll post here when it's done — or check the motherboard.`;
}

async function cmdAsk(args) {
  const question = args.join(" ").trim();
  if (!question) return "Usage: `!ask <your question>`";
  // Same contract as POST /api/chat: honest while the brain is unwired.
  if (!config.caeliaBrainUrl) {
    return "Caelia's brain isn't wired into me yet — Kallel is doing that part. " +
      "Your question is saved and will reach her when the backend is live. 💜";
  }
  try {
    const r = await fetch(`${config.caeliaBrainUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: question, source: "discord" }),
    });
    const data = await r.json();
    return data.reply || "Caelia didn't return a reply.";
  } catch {
    return "Couldn't reach Caelia's brain right now — the question is saved.";
  }
}

// Main entry: called by bot.js on every message in a mapped channel or owner DM.
export async function handleMessage({ message, channelKey, isDM, map, ownerId, discord }) {
  const authorId = message.author?.id || "";
  const text = (message.content || "").trim();
  const owner = ownerId && String(authorId) === String(ownerId);

  if (!text.startsWith(PREFIX)) return; // not a command — stay quiet

  const [cmd, ...args] = text.slice(PREFIX.length).split(/\s+/);
  const action = cmd.toLowerCase();
  const channel = isDM ? "dm" : channelKey;

  if (!owner) {
    await message.reply(politeRefusal()).catch(() => {});
    auditLog("discord", "", "command_refused", { cmd: action, channel, user: authorId.slice(0, 12) });
    return;
  }

  const need = {
    status: "status_report",
    evaluate: "queue_evaluation",
    ask: "ask_forward",
    "join-voice": "voice_join",
    "leave-voice": "voice_leave",
    help: "status_report",
  }[action];

  if (!need) {
    await message.reply(helpText()).catch(() => {});
    return;
  }
  if (!checkDiscordPermission(need, { userId: authorId, ownerId, channel })) {
    await message.reply(politeRefusal()).catch(() => {});
    return;
  }

  auditLog("discord", "", "command", { cmd: action, channel, args_len: args.join(" ").length });
  let reply;
  try {
    switch (action) {
      case "status": reply = await cmdStatus(); break;
      case "evaluate": reply = await cmdEvaluate(args); break;
      case "ask": reply = await cmdAsk(args); break;
      case "join-voice": {
        const ch = map.voice;
        if (!ch.configured) { reply = "Caelia Voice channel isn't configured yet (DISCORD_CHANNEL_VOICE)."; break; }
        const guild = message.guild;
        if (!guild) { reply = "Voice join needs a server channel, not DMs."; break; }
        const r = await joinVoiceChannel(guild, ch.id);
        reply = r.ok ? "🎙️ Joined Caelia Voice (presence only — speech in/out is stubbed for Kallel's integration)."
                     : `Couldn't join voice: ${r.error}`;
        break;
      }
      case "leave-voice": {
        const guild = message.guild;
        const r = guild ? leaveVoiceChannel(guild.id) : { ok: false };
        reply = r.ok ? "Left the voice channel. 💜" : "I'm not in a voice channel.";
        break;
      }
      default: reply = helpText();
    }
  } catch (e) {
    reply = "Something hiccuped on my end — check the Operations channel.";
  }
  await message.reply(reply.slice(0, 1900)).catch(() => {});
  void discord; void inVoice;
}
