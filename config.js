// Central configuration — everything comes from ENV, never hardcoded secrets.
const req = (name, fallback = undefined) => process.env[name] ?? fallback;

export const config = {
  port: parseInt(req("PORT", "8787"), 10),
  ownerToken: req("OWNER_TOKEN", ""),
  dbPath: req("DB_PATH", "./data/motherboard.sqlite"),
  storageDir: req("STORAGE_DIR", "./storage"),
  caeliaBrainUrl: req("CAELIA_BRAIN_URL", ""),
  credentialVaultRef: req("CREDENTIAL_VAULT_REF", ""),
  qvEngineUrl: req("QV_ENGINE_URL", ""),
  // Comma-separated exact browser origins. No wildcard in production.
  dashboardOrigins: req("DASHBOARD_ORIGINS", req("DASHBOARD_ORIGIN", "")),
  maxBodyBytes: req("MAX_BODY_BYTES", "2mb"),
};

export function allowedOrigins() {
  return config.dashboardOrigins
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertConfigured() {
  if (!config.ownerToken || config.ownerToken.startsWith("PASTE_")) {
    console.warn(
      "[motherboard] WARNING: OWNER_TOKEN is not set. All /api/* routes will reject requests.\n" +
      "  Copy .env.example to .env and set a long random OWNER_TOKEN (Alicia's hands only)."
    );
  } else if (config.ownerToken.length < 32) {
    console.warn("[motherboard] WARNING: OWNER_TOKEN is shorter than the recommended 32 characters.");
  }
  if (!allowedOrigins().length) {
    console.warn("[motherboard] WARNING: DASHBOARD_ORIGINS is not set; browser CORS will be denied except same-origin.");
  }
}
