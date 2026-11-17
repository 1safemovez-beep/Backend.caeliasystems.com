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
};

export function assertConfigured() {
  if (!config.ownerToken || config.ownerToken.startsWith("PASTE_")) {
    console.warn(
      "[motherboard] WARNING: OWNER_TOKEN is not set. All /api/* routes will reject requests.\n" +
        "  Copy .env.example to .env and set a long random OWNER_TOKEN (Alicia's hands only)."
    );
  }
}
