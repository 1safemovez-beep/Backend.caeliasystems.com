// Backend Safe — encrypted vault for real secrets.
// AES-256-GCM via Node's built-in crypto. The master key comes ONLY from
// VAULT_MASTER_KEY in the environment; if it is missing the vault refuses
// to unlock (fail closed). Nothing here ever logs or returns raw values.
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

const ALG = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;

// Fail closed: no master key, no crypto. Checked on every operation.
function masterKey() {
  const raw = process.env.VAULT_MASTER_KEY;
  if (!raw || raw.startsWith("PASTE_")) return null;
  // scrypt stretches Alicia's passphrase into a proper 256-bit key.
  return scryptSync(raw, "caelia-backend-safe-v1", KEY_LEN);
}

function locked() {
  const e = new Error("Backend Safe is locked — VAULT_MASTER_KEY is not set.");
  e.status = 503;
  e.code = "VAULT_LOCKED";
  return e;
}

export function vaultUnlocked() {
  return masterKey() !== null;
}

export function encryptSecret(plaintext) {
  const key = masterKey();
  if (!key) throw locked();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return {
    encrypted_value: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret({ encrypted_value, iv, auth_tag }) {
  const key = masterKey();
  if (!key) throw locked();
  try {
    const decipher = createDecipheriv(ALG, key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(auth_tag, "base64"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(encrypted_value, "base64")),
      decipher.final(),
    ]);
    return out.toString("utf8");
  } catch {
    const e = new Error("Vault decryption failed — wrong key or corrupted data.");
    e.status = 500;
    e.code = "VAULT_DECRYPT_FAILED";
    throw e;
  }
}

// The five containers. Tom's box is Alicia's personal box: strictest access,
// owner-only, and every touch is audited (enforced in the routes layer).
export const CONTAINERS = [
  { name: "caelia-tokens", kind: "standard", description: "Caelia service tokens" },
  { name: "caelia-keys", kind: "standard", description: "Caelia API keys" },
  { name: "motherboard-keys", kind: "standard", description: "Motherboard integration keys" },
  { name: "backend-credentials", kind: "standard", description: "Database / server / service credentials" },
  { name: "toms-box", kind: "toms_box", description: "Alicia's personal secret box — owner only, always audited" },
];

export const TOMS_BOX = "toms-box";
