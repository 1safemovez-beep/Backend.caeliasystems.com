// Discord voice hooks — presence only (join/leave/mute state).
// Real speech-to-text and spoken output stay STUBBED for Kallel's integration.
// Hook points (for Kallel):
//   - onVoiceAudio(userId, pcmStream): feed user speech -> STT -> brain input
//   - speakInVoice(connection, text): brain reply -> TTS -> voice channel audio
// Until those land, the bot joins/leaves honestly and says voice I/O
// isn't wired yet — it never pretends to hear or speak.
import { auditLog } from "../middleware/audit.js";

let voiceLib = null; // lazy: @discordjs/voice (optional dep)
async function loadVoice() {
  if (voiceLib) return voiceLib;
  try {
    voiceLib = await import("@discordjs/voice");
    return voiceLib;
  } catch {
    return null; // voice presence unavailable; text side keeps working
  }
}

const connections = new Map(); // guildId -> voice connection

export async function joinVoiceChannel(guild, channelId, { adapterCreator } = {}) {
  const lib = await loadVoice();
  if (!lib) {
    return { ok: false, error: "VOICE_LIB_MISSING",
      note: "Install @discordjs/voice for voice presence. Text commands keep working." };
  }
  try {
    const connection = lib.joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: adapterCreator || guild.voiceAdapterCreator,
    });
    connections.set(guild.id, connection);
    connection.on("error", () => { /* presence only; stay quiet */ });
    auditLog("discord", guild.id, "voice_join", { channel: String(channelId).slice(0, 12) });
    return { ok: true, note: "Joined voice (presence only). Speech in/out is stubbed for Kallel's integration." };
  } catch (e) {
    return { ok: false, error: "VOICE_JOIN_FAILED", note: String(e.message).slice(0, 200) };
  }
}

export function leaveVoiceChannel(guildId) {
  const lib = voiceLib;
  const connection = connections.get(guildId);
  if (!connection) return { ok: false, error: "NOT_IN_VOICE" };
  try {
    if (lib) lib.getVoiceConnection(guildId)?.destroy();
    else connection.destroy?.();
  } catch { /* best effort */ }
  connections.delete(guildId);
  auditLog("discord", guildId, "voice_leave", {});
  return { ok: true };
}

export function inVoice(guildId) {
  return connections.has(guildId);
}

// ---- Kallel hook points (stubs) -------------------------------------------
// onVoiceAudio(userId, pcmStream):
//   TODO(Kallel): pipe pcmStream through STT, send transcript to the Brain
//   chat contract, then speakInVoice() the reply. Never store raw audio
//   outside the ephemeral stream; never send audio to Core/Soul directly.
// speakInVoice(connection, text):
//   TODO(Kallel): TTS `text` -> audio resource -> connection.play().
//   Voice output must go through the same permission boundary as text:
//   Server 2 interface only; the Brain decides what is said.
export const VOICE_STT_TTS = "STUBBED_FOR_KALLEL";
