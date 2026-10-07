// Discord API — owner-only management surface for the Discord bot.
// The bot itself is a Server 2 interface: it can post, respond, and queue
// evaluations. It can NEVER read the vault, touch Core/Soul, or trigger
// failsafe (enforced in src/discord/permissions.js).
import { Router } from "express";
import { audit } from "../middleware/audit.js";
import { discordState, sendToChannel } from "../discord/bot.js";
import { resolveChannelMap } from "../discord/channels.js";

export const discordRouter = Router();

// GET /api/discord/status — connection state, guild, mapped channels.
// Names + booleans only; the token is never exposed here.
discordRouter.get("/discord/status", (_req, res) => {
  res.json(discordState());
});

// GET /api/discord/channels — Alicia's planned channel map.
discordRouter.get("/discord/channels", (_req, res) => {
  const map = resolveChannelMap();
  res.json({
    ok: true,
    guildId: map.guildId ? "(set)" : "",
    channels: ["voice", "private", "agents", "ops"].map((k) => ({
      key: k, label: map[k].label, configured: map[k].configured,
    })),
    note: "Set DISCORD_GUILD_ID and DISCORD_CHANNEL_* in the environment. See .env.example.",
  });
});

// POST /api/discord/send { channel: "ops"|"voice"|"private"|"agents"|<id>, text }
discordRouter.post("/discord/send", audit("send", "discord_message"), (req, res, next) => {
  (async () => {
    try {
      const { channel, text } = req.body || {};
      if (!channel || !String(text || "").trim())
        return res.status(400).json({ ok: false, error: "CHANNEL_AND_TEXT_REQUIRED" });
      const r = await sendToChannel(channel, text);
      if (!r.ok) return res.status(503).json({ ok: false, error: r.error });
      res.json({ ok: true, ...r });
    } catch (e) { next(e); }
  })();
});
