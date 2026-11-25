// Central configuration — everything comes from ENV, never hardcoded secrets.
const req = (name, fallback = undefined) => {
  const v = process.env[name] ?? fallback;
  return v;
};

export const config = {
  port: parseInt(req("PORT", "8787"), 10),
  ownerToken: req("OWNER_TOKEN", ""),
  dbPath: req("DB_PATH", "./data/motherboard.sqlite"),
  storageDir: req("STORAGE_DIR", "./storage"),
  // Integration hooks (blank until Kallel wires them)
  caeliaBrainUrl: req("CAELIA_BRAIN_URL", ""),
  credentialVaultRef: req("CREDENTIAL_VAULT_REF", ""),
  qvEngineUrl: req("QV_ENGINE_URL", ""),
  backendPublicUrl: req("BACKEND_PUBLIC_URL", "https://backend.caeliasystems.com"),
  dashboardOrigin: req("DASHBOARD_ORIGIN", "https://motherboard.caeliasystems.com"),
  // Brain (server-to-server only; the token never reaches the browser)
  brainToken: req("CAELIA_BRAIN_TOKEN", ""),
  brainHealthPath: req("CAELIA_BRAIN_HEALTH_PATH", "/api/health"),
  brainChatPath: req("CAELIA_BRAIN_CHAT_PATH", "/api/chat"),
  brainTimeoutMs: parseInt(req("CAELIA_BRAIN_TIMEOUT_MS", "20000"), 10),
  // Tracer (optional; contract unconfirmed — health probe only)
  tracerUrl: req("TRACER_URL", ""),
  tracerToken: req("TRACER_TOKEN", ""),
  // Sessions
  sessionTtlHours: parseInt(req("SESSION_TTL_HOURS", "12"), 10),
  cookieSecure: req("COOKIE_SECURE", process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT ? "true" : "false") === "true",
  rateLimitPerMin: parseInt(req("RATE_LIMIT_PER_MIN", "240"), 10),
};

// Exact browser origins (comma-separated DASHBOARD_ORIGIN). Never "*".
export function allowedOrigins() {
  return String(config.dashboardOrigin).split(",").map((s) => s.trim()).filter(Boolean);
}

export function assertConfigured() {
  if (!config.ownerToken || config.ownerToken.startsWith("PASTE_")) {
    console.warn(
      "[motherboard] WARNING: OWNER_TOKEN is not set. All /api/* routes will reject requests.\n" +
        "  Copy .env.example to .env and set a long random OWNER_TOKEN (Alicia's hands only)."
    );
  }
}
