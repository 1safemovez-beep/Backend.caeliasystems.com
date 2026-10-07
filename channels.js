// Discord channel routing — maps Alicia's planned channels from ENV.
// Channel IDs are config, not secrets; resolved at boot and logged by name.
// Planned layout on Alicia's "caelia server":
//   Caelia Voice   — talk to Caelia (voice + text side)
//   Caelia Private — owner-only voice/text
//   AI/Agent Room  — agent chatter / delegation notices
//   Operations     — system + maintenance alerts (backend posts here)
const CHANNEL_DEFS = [
  { key: "voice",   env: "DISCORD_CHANNEL_VOICE",   label: "Caelia Voice" },
  { key: "private", env: "DISCORD_CHANNEL_PRIVATE", label: "Caelia Private" },
  { key: "agents",  env: "DISCORD_CHANNEL_AGENTS",  label: "AI/Agent Room" },
  { key: "ops",     env: "DISCORD_CHANNEL_OPS",     label: "Operations" },
];

export function resolveChannelMap() {
  const map = { guildId: process.env.DISCORD_GUILD_ID || "" };
  for (const def of CHANNEL_DEFS) {
    const id = (process.env[def.env] || "").trim();
    map[def.key] = { id, label: def.label, env: def.env, configured: Boolean(id) };
  }
  return map;
}

// Log the map with names only (ids are config, shown truncated for sanity).
export function logChannelMap(map) {
  const bits = CHANNEL_DEFS.map((d) => {
    const c = map[d.key];
    return `${c.label}=${c.configured ? c.id.slice(0, 6) + "…" : "not set"}`;
  });
  console.log(`[discord] channels: ${bits.join("  ")}`);
}

// Which logical channel does a Discord channel id belong to? null = unmapped.
export function channelKeyFor(map, channelId) {
  for (const def of CHANNEL_DEFS) {
    if (map[def.key].id && map[def.key].id === String(channelId)) return def.key;
  }
  return null;
}

// Resolve a send target: "ops"|"voice"|"private"|"agents" or a raw channel id.
export function resolveSendTarget(map, target) {
  const t = String(target || "").toLowerCase();
  if (map[t] && map[t].id) return { id: map[t].id, label: map[t].label };
  if (/^\d{8,}$/.test(t)) return { id: t, label: "raw channel id" };
  return null;
}
