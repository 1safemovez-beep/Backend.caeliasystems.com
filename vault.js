// Backend Safe API — encrypted vault (AES-256-GCM) for real secrets.
// Five containers: caelia-tokens, caelia-keys, motherboard-keys,
// backend-credentials, and Tom's box (Alicia's personal box, strictest access).
// Rules: values NEVER appear in list responses or logs; every read/write/
// rotate/delete is audited; the vault fails closed without VAULT_MASTER_KEY.
import { Router } from "express";
import { all, get, run } from "../db/index.js";
import { audit, auditLog } from "../middleware/audit.js";
import { encryptSecret, decryptSecret, vaultUnlocked, TOMS_BOX } from "../vault/safe.js";

export const vaultRouter = Router();

const MAX_VALUE_BYTES = 16 * 1024;

function containerByName(name) {
  return get("SELECT * FROM vault_containers WHERE name=?", name);
}

// Names-only projection — encrypted_value / iv / auth_tag never leave the DB.
const NAME_ONLY = `s.id, s.name, c.name AS container, s.created_at, s.updated_at, s.rotated_at
  FROM vault_secrets s JOIN vault_containers c ON c.id = s.container_id`;

// POST /api/vault/unlock — validates the master key is set. Never returns it.
vaultRouter.post("/vault/unlock", (req, res) => {
  if (!vaultUnlocked())
    return res.status(503).json({
      ok: false, error: "VAULT_LOCKED",
      note: "VAULT_MASTER_KEY is not set. Set it in the environment (Alicia's hands only), then unlock.",
    });
  const names = all("SELECT name FROM vault_containers ORDER BY id").map((r) => r.name);
  res.json({ ok: true, unlocked: true, containers: names });
});

// GET /api/vault/containers — the five containers (structure only, no secrets).
vaultRouter.get("/vault/containers", (_req, res) => {
  const rows = all(
    `SELECT c.id, c.name, c.kind, c.description,
       (SELECT COUNT(*) FROM vault_secrets s WHERE s.container_id = c.id) AS secret_count,
       c.created_at
     FROM vault_containers c ORDER BY c.id`
  );
  res.json({ ok: true, containers: rows });
});

// ---- generic secret handlers (container chosen by body/query) ----
function storeSecret(containerName, req, res, next) {
  try {
    const { name, value } = req.body || {};
    const container = containerByName(containerName);
    if (!container) return res.status(404).json({ ok: false, error: "CONTAINER_NOT_FOUND" });
    if (!name || typeof value !== "string" || !value.length)
      return res.status(400).json({ ok: false, error: "NAME_AND_VALUE_REQUIRED" });
    if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES)
      return res.status(400).json({ ok: false, error: "VALUE_TOO_LARGE" });
    if (!vaultUnlocked())
      return res.status(503).json({ ok: false, error: "VAULT_LOCKED" });
    const enc = encryptSecret(value);
    const r = run(
      `INSERT INTO vault_secrets (container_id, name, encrypted_value, iv, auth_tag, updated_at)
       VALUES (?,?,?,?,?, datetime('now'))
       ON CONFLICT(container_id, name) DO UPDATE SET
         encrypted_value=excluded.encrypted_value, iv=excluded.iv, auth_tag=excluded.auth_tag,
         updated_at=datetime('now')`,
      container.id, name, enc.encrypted_value, enc.iv, enc.auth_tag
    );
    const id = Number(r.lastInsertRowid) || get(
      "SELECT id FROM vault_secrets WHERE container_id=? AND name=?", container.id, name).id;
    auditLog("vault_secret", id, containerName === TOMS_BOX ? "toms_box_store" : "vault_store",
      { container: containerName, name });
    res.json({ ok: true, id, container: containerName, name });
  } catch (e) { next(e); }
}

function listSecrets(containerName, _req, res, next) {
  try {
    if (!vaultUnlocked())
      return res.status(503).json({ ok: false, error: "VAULT_LOCKED" });
    const rows = containerName
      ? all(`SELECT ${NAME_ONLY} WHERE c.name=? ORDER BY s.name`, containerName)
      : all(`SELECT ${NAME_ONLY} ORDER BY c.name, s.name`);
    res.json({ ok: true, secrets: rows }); // names only — never values
  } catch (e) { next(e); }
}

function retrieveSecret(containerName, req, res, next) {
  try {
    if (!vaultUnlocked())
      return res.status(503).json({ ok: false, error: "VAULT_LOCKED" });
    const row = containerName
      ? get(`SELECT s.*, c.name AS container FROM vault_secrets s
             JOIN vault_containers c ON c.id = s.container_id
             WHERE s.id=? AND c.name=?`, req.params.id, containerName)
      : get(`SELECT s.*, c.name AS container FROM vault_secrets s
             JOIN vault_containers c ON c.id = s.container_id WHERE s.id=?`, req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: "SECRET_NOT_FOUND" });
    const value = decryptSecret(row);
    // Explicit audit — detail carries the name, NEVER the value.
    auditLog("vault_secret", row.id,
      row.container === TOMS_BOX ? "toms_box_read" : "vault_read",
      { container: row.container, name: row.name });
    res.json({ ok: true, id: row.id, container: row.container, name: row.name, value,
      rotated_at: row.rotated_at });
  } catch (e) { next(e); }
}

function rotateSecret(containerName, req, res, next) {
  try {
    const { value } = req.body || {};
    if (typeof value !== "string" || !value.length)
      return res.status(400).json({ ok: false, error: "VALUE_REQUIRED" });
    if (!vaultUnlocked())
      return res.status(503).json({ ok: false, error: "VAULT_LOCKED" });
    const row = get(
      `SELECT s.id, s.container_id FROM vault_secrets s
       JOIN vault_containers c ON c.id = s.container_id
       WHERE s.id=? ${containerName ? "AND c.name=?" : ""}`,
      ...(containerName ? [req.params.id, containerName] : [req.params.id]));
    if (!row) return res.status(404).json({ ok: false, error: "SECRET_NOT_FOUND" });
    const enc = encryptSecret(value);
    run(`UPDATE vault_secrets SET encrypted_value=?, iv=?, auth_tag=?,
         updated_at=datetime('now'), rotated_at=datetime('now') WHERE id=?`,
      enc.encrypted_value, enc.iv, enc.auth_tag, row.id);
    auditLog("vault_secret", row.id,
      containerName === TOMS_BOX ? "toms_box_rotate" : "vault_rotate",
      { container: containerName || "any", name: "(withheld)" });
    res.json({ ok: true, id: row.id, rotated: true });
  } catch (e) { next(e); }
}

function deleteSecret(containerName, req, res, next) {
  try {
    if (!vaultUnlocked())
      return res.status(503).json({ ok: false, error: "VAULT_LOCKED" });
    const row = get(
      `SELECT s.id, s.name, c.name AS container FROM vault_secrets s
       JOIN vault_containers c ON c.id = s.container_id
       WHERE s.id=? ${containerName ? "AND c.name=?" : ""}`,
      ...(containerName ? [req.params.id, containerName] : [req.params.id]));
    if (!row) return res.status(404).json({ ok: false, error: "SECRET_NOT_FOUND" });
    run("DELETE FROM vault_secrets WHERE id=?", row.id);
    auditLog("vault_secret", row.id,
      row.container === TOMS_BOX ? "toms_box_delete" : "vault_delete",
      { container: row.container, name: row.name });
    res.json({ ok: true, id: row.id, deleted: true });
  } catch (e) { next(e); }
}

// POST /api/vault/secrets { container, name, value }
vaultRouter.post("/vault/secrets", audit("store", "vault_secret"), (req, res, next) => {
  const container = (req.body || {}).container;
  if (!container) return res.status(400).json({ ok: false, error: "CONTAINER_REQUIRED" });
  storeSecret(container, req, res, next);
});
// GET /api/vault/secrets?container=NAME — NAMES ONLY, never values
vaultRouter.get("/vault/secrets", (req, res, next) =>
  listSecrets(req.query.container || null, req, res, next));
// GET /api/vault/secrets/:id — single value, owner only, audited
vaultRouter.get("/vault/secrets/:id", (req, res, next) => retrieveSecret(null, req, res, next));
// POST /api/vault/secrets/:id/rotate { value }
vaultRouter.post("/vault/secrets/:id/rotate", audit("rotate", "vault_secret"),
  (req, res, next) => rotateSecret(null, req, res, next));
// DELETE /api/vault/secrets/:id
vaultRouter.delete("/vault/secrets/:id", audit("delete", "vault_secret"),
  (req, res, next) => deleteSecret(null, req, res, next));

// ---- Tom's box: dedicated endpoints so it's unmistakable in the API ----
vaultRouter.post("/vault/toms-box/secrets", audit("store", "toms_box"),
  (req, res, next) => storeSecret(TOMS_BOX, req, res, next));
vaultRouter.get("/vault/toms-box/secrets", (req, res, next) =>
  listSecrets(TOMS_BOX, req, res, next));
vaultRouter.get("/vault/toms-box/secrets/:id", (req, res, next) =>
  retrieveSecret(TOMS_BOX, req, res, next));
vaultRouter.post("/vault/toms-box/secrets/:id/rotate", audit("rotate", "toms_box"),
  (req, res, next) => rotateSecret(TOMS_BOX, req, res, next));
vaultRouter.delete("/vault/toms-box/secrets/:id", audit("delete", "toms_box"),
  (req, res, next) => deleteSecret(TOMS_BOX, req, res, next));
