// Discord bot client — the Server 2 interface to Alicia's Discord server.
// Discord is an INTERFACE, not Caelia's brain. The bot token lives in the
// Backend Safe (backend-credentials / discord-bot-token) — never hardcoded,
// never logged, never returned by any endpoint. Graceful states:
//   DISCORD_NEEDS_TOKEN — no token stored yet; everything else keeps running
//   DISCORD_LIB_MISSING — discord.js not installed; install to enable
//   DISCORD_LOGIN_FAILED — bad token; server stays up, status shows the error
import { get } from "../db/index.js";
import { decryptSecret, vaultUnlocked } from "../vault/safe.js";
import { auditLog } from "../middleware/audit.js";
import { resolveChannelMap, logChannelMap, channelKeyFor, resolveSendTarget } from "./channels.js";
import { handleMessage } from "./commands.js";
import { setOpsPoster } from "./alerts.js";

const TOKEN_CONTAINER = "backend-credentials";
const TOKEN_NAME = "discord-bot-token";

const state = {
  status: "offline", // offline | needs_token | lib_missing | login_failed | online
  detail: "",
  guildName: "",
  client: null,
  map: resolveChannelMap(),
  ownerId: (process.env.DISCORD_OWNER_ID || "").trim(),
};

function readTokenFromVault() {
  // Programmatic vault read — same rules as the routes: owner-only conceptually
  // (this IS the backend acting for Alicia), audited, value never logged.
  if (!vaultUnlocked()) return null;
  const row = get(
    `SELECT s.* FROM vault_secrets s
     JOIN vault_containers c ON c.id = s.container_id
     WHERE c.name=? AND s.name=?`,
    TOKEN_CONTAINER, TOKEN_NAME
  );
  if (!row) return null;
  try {
    const value = decryptSecret(row);
    auditLog("discord", "", "token_read_from_vault",
      { container: TOKEN_CONTAINER, name: TOKEN_NAME }); // name only, never value
    return value;
  } catch {
    return null;
  }
}

export function discordState() {
  return {
    ok: true,
    connected: state.status === "online",
    status: state.status,
    detail: state.detail,
    needsToken: state.status === "needs_token",
    guild: state.guildName || null,
    ownerConfigured: Boolean(state.ownerId),
    channels: Object.fromEntries(
      ["voice", "private", "agents", "ops"].map((k) => [
        k, { label: state.map[k].label, configured: state.map[k].configured },
      ])
    ),
  };
}

export async function sendToChannel(target, text) {
  if (state.status !== "online" || !state.client) {
    return { ok: false, error: "DISCORD_OFFLINE" };
  }
  const dest = resolveSendTarget(state.map, target);
  if (!dest) return { ok: false, error: "CHANNEL_NOT_CONFIGURED" };
  try {
    const channel = await state.client.channels.fetch(dest.id);
    if (!channel || !channel.isTextBased()) return { ok: false, error: "NOT_A_TEXT_CHANNEL" };
    await channel.send(String(text).slice(0, 1900));
    auditLog("discord", "", "api_send", { channel: dest.label });
    return { ok: true, channel: dest.label };
  } catch {
    return { ok: false, error: "SEND_FAILED" };
  }
}

export async function initDiscord() {
  state.map = resolveChannelMap();
  logChannelMap(state.map);
  if (!state.ownerId) {
    console.log("[discord] DISCORD_OWNER_ID not set — commands will refuse everyone until Alicia sets it.");
  }

  const token = readTokenFromVault();
  if (!token) {
    state.status = "needs_token";
    state.detail = "DISCORD_NEEDS_TOKEN — store discord-bot-token in the backend-credentials container via POST /api/vault/secrets (Alicia's hands only).";
    console.log(`[discord] ${state.detail}`);
    return state;
  }

  let Discord;
  try {
    Discord = await import("discord.js");
  } catch {
    state.status = "lib_missing";
    state.detail = "DISCORD_LIB_MISSING — npm install discord.js @discordjs/voice to enable.";
    console.log(`[discord] ${state.detail}`);
    return state;
  }

  const client = new Discord.Client({
    intents: [
      Discord.GatewayIntentBits.Guilds,
      Discord.GatewayIntentBits.GuildMessages,
      Discord.GatewayIntentBits.MessageContent,
      Discord.GatewayIntentBits.GuildVoiceStates,
      Discord.GatewayIntentBits.DirectMessages,
    ],
    partials: [Discord.Partials.Channel], // DMs arrive as partial channels
  });

  client.once("ready", async () => {
    state.status = "online";
    state.detail = "";
    const guildId = state.map.guildId;
    const guild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();
    state.guildName = guild?.name || "";
    console.log(`[discord] online as ${client.user.tag}${state.guildName ? ` — guild: ${state.guildName}` : ""}`);
    auditLog("discord", "", "bot_online", { guild: state.guildName || "(unknown)" });
    // Wire Operations alerts to the ops channel poster.
    const ops = state.map.ops;
    if (ops.configured) {
      setOpsPoster(async (text) => {
        const ch = await client.channels.fetch(ops.id);
        if (ch?.isTextBased()) await ch.send(text);
      });
    }
  });

  client.on("messageCreate", async (message) => {
    try {
      if (message.author?.bot) return;
      const isDM = !message.guild;
      if (isDM) {
        await handleMessage({ message, channelKey: "private", isDM: true,
          map: state.map, ownerId: state.ownerId, discord: state });
        return;
      }
      const key = channelKeyFor(state.map, message.channelId);
      if (!key) return; // unmapped channel — stay quiet
      await handleMessage({ message, channelKey: key, isDM: false,
        map: state.map, ownerId: state.ownerId, discord: state });
    } catch { /* a bad message must never crash the bot */ }
  });

  client.on("error", () => { /* stay up; status surface carries errors */ });

  try {
    // Login can hang on a bad token (gateway never answers), so race it
    // against a timeout. Either way the server stays up.
    const LOGIN_TIMEOUT_MS = 20000;
    await Promise.race([
      client.login(token), // token never logged
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("LOGIN_TIMEOUT")), LOGIN_TIMEOUT_MS)),
    ]);
    state.client = client;
  } catch {
    // Login failed or timed out (bad/revoked/unreachable token).
    // Never log the token.
    state.status = "login_failed";
    state.detail = "DISCORD_LOGIN_FAILED — the stored token was rejected or unreachable (20s timeout). Rotate it via POST /api/vault/secrets/:id/rotate (Alicia's hands only).";
    console.log(`[discord] ${state.detail}`);
    try { client.destroy(); } catch { /* noop */ }
  }
  return state;
}

export async function shutdownDiscord() {
  try { await state.client?.destroy(); } catch { /* noop */ }
  state.client = null;
  if (state.status === "online") state.status = "offline";
}
