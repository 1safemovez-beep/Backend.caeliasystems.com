import { Router } from "express";
import { all, get, run } from "../db/index.js";
import { delegationService } from "../services/delegationService.js";
import { audit, auditLog } from "../middleware/audit.js";
export const bridgeRouter = Router();

// ---- (1) SENSORY BRIDGE (input) ----
// Satellites push heartbeats: Worth / Status / Revenue + metrics.
// POST /api/bridge/heartbeat { satellite, worth, status, revenue, metrics }
bridgeRouter.post("/bridge/heartbeat", audit("heartbeat", "satellite"), (req, res, next) => {
  try {
    const { satellite, worth, status, revenue, metrics } = req.body || {};
    if (!satellite) return res.status(400).json({ ok: false, error: "SATELLITE_REQUIRED" });
    let sat = get("SELECT * FROM satellites WHERE name=?", satellite);
    if (!sat) {
      const r = run("INSERT INTO satellites (name) VALUES (?)", satellite);
      sat = get("SELECT * FROM satellites WHERE id=?", r.lastInsertRowid);
    }
    const r = run(
      "INSERT INTO bridge_heartbeats (satellite_id, worth, status, revenue, metrics_json) VALUES (?,?,?,?,?)",
      sat.id, worth || "", status || "", revenue || "", JSON.stringify(metrics || {})
    );
    res.json({ ok: true, id: Number(r.lastInsertRowid), satellite: sat.name });
  } catch (e) { next(e); }
});
bridgeRouter.get("/bridge/heartbeats", (req, res) => {
  const rows = all(
    `SELECT h.*, s.name AS satellite FROM bridge_heartbeats h
     JOIN satellites s ON s.id = h.satellite_id
     ORDER BY h.received_at DESC LIMIT 100`
  );
  res.json({ ok: true, heartbeats: rows });
});

// ---- (2) ACTION BRIDGE (output) ----
// Dispatch an action to a satellite. vault_ref is a vault NAME, never a secret.
// Raw credentials are NEVER accepted here — rejected if they look like one.
const SECRET_HINT = /(api[_-]?key|secret|password|token|bearer)/i;
bridgeRouter.post("/bridge/action", audit("dispatch", "bridge_action"), (req, res, next) => {
  try {
    const { satellite, action, params, vault_ref } = req.body || {};
    if (!satellite || !action) return res.status(400).json({ ok: false, error: "SATELLITE_AND_ACTION_REQUIRED" });
    const blob = JSON.stringify({ params, vault_ref });
    if (SECRET_HINT.test(blob) && /[A-Za-z0-9_\-]{24,}/.test(blob))
      return res.status(400).json({ ok: false, error: "RAW_SECRET_REJECTED", note: "Pass a vault reference name, never a raw secret." });
    const sat = get("SELECT * FROM satellites WHERE name=?", satellite);
    const r = run(
      "INSERT INTO bridge_actions (satellite_id, action, params_json, vault_ref, status) VALUES (?,?,?,?, 'queued')",
      sat?.id || null, action, JSON.stringify(params || {}), vault_ref || ""
    );
    auditLog("bridge_action", r.lastInsertRowid, "queued", { satellite, action });
    res.json({ ok: true, id: Number(r.lastInsertRowid), status: "queued",
      note: "Action queued. Execution against the satellite happens in the integration layer." });
  } catch (e) { next(e); }
});
bridgeRouter.get("/bridge/actions", (_req, res) => {
  res.json({ ok: true, actions: all("SELECT * FROM bridge_actions ORDER BY id DESC LIMIT 100") });
});

// ---- (3) DELEGATION SWITCHBOARD ----
// POST /api/bridge/delegate { agent: "fawn"|"nova", task }
bridgeRouter.post("/bridge/delegate", audit("delegate", "bridge"), (req, res, next) => {
  try {
    res.json({ ok: true, ...delegationService.delegate(req.body?.agent, req.body?.task) });
  } catch (e) { next(e); }
});
