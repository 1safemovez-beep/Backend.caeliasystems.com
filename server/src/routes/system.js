import { Router } from "express";
import { get, all, run } from "../db/index.js";
import { brainClient } from "../services/brainClient.js";
import { tracerHealth } from "../services/tracerClient.js";
import { checkReadiness } from "../engines/quantvantage.js";
export const systemRouter = Router();

// Authenticated: probes every downstream (database, Brain, Tracer) live.
// Returns names + status only; no URLs with credentials, no secret values.
systemRouter.get("/system/status", async (_req, res) => {
  let database;
  const t0 = Date.now();
  try {
    run("INSERT INTO memory_context (key, value, updated_at) VALUES ('_probe', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')", String(t0));
    const row = get("SELECT value FROM memory_context WHERE key='_probe'");
    database = { ok: row?.value === String(t0), kind: "sqlite", ms: Date.now() - t0, readWrite: true };
  } catch (e) { database = { ok: false, error: "DB_ERROR" }; }
  const [brain, tracer] = await Promise.all([brainClient.health(), tracerHealth()]);
  const pick = (r) => ({ ok: r.ok, error: r.error, upstreamStatus: r.upstreamStatus, ms: r.ms });
  res.json({
    ok: true,
    backend: { ok: true, time: new Date().toISOString() },
    database,
    brain: pick(brain),
    tracer: pick(tracer),
    engines: checkReadiness(),
  });
});

// One call that hydrates every dashboard panel from real tables.
systemRouter.get("/dashboard/summary", (_req, res) => {
  const n = (sql) => get(sql).n;
  res.json({
    ok: true,
    counters: {
      files: n("SELECT COUNT(*) n FROM files_meta"),
      memory: n("SELECT COUNT(*) n FROM memory_facts"),
      tasks: n("SELECT COUNT(*) n FROM tasks"),
      automations: n("SELECT COUNT(*) n FROM automations"),
      engines: n("SELECT COUNT(*) n FROM engines"),
      agents: n("SELECT COUNT(*) n FROM agents"),
    },
    engines: all("SELECT name, type, mode, status FROM engines"),
    agents: all("SELECT name, role, status FROM agents"),
    facts: all("SELECT id, text, category, source, created_at FROM memory_facts ORDER BY id DESC LIMIT 20"),
    files: all("SELECT id, original_name AS name, size, created_at FROM files_meta ORDER BY id DESC LIMIT 20"),
    activity: all("SELECT action, entity, created_at FROM audit_log WHERE entity != 'auth' ORDER BY id DESC LIMIT 15"),
  });
});
