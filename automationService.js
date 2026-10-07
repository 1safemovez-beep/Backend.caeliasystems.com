// Automations service — create/toggle/run, plus a simple in-process scheduler.
// Heavy/24-7 scheduling moves to the deployed host later; this keeps the
// contract stable for Kallel's integration.
import { all, get, run } from "../db/index.js";
import { auditLog } from "../middleware/audit.js";

export const automationService = {
  list() { return all("SELECT * FROM automations ORDER BY id"); },
  create({ name, category, schedule }) {
    if (!name?.trim()) throw Object.assign(new Error("name required"), { status: 400, code: "BAD_NAME" });
    const r = run("INSERT INTO automations (name, category, schedule) VALUES (?,?,?)",
      name.trim(), category || "work productivity", schedule || "");
    return get("SELECT * FROM automations WHERE id=?", r.lastInsertRowid);
  },
  toggle(id) {
    const cur = get("SELECT * FROM automations WHERE id=?", id);
    if (!cur) throw Object.assign(new Error("not found"), { status: 404, code: "NOT_FOUND" });
    run("UPDATE automations SET enabled=? WHERE id=?", cur.enabled ? 0 : 1, id);
    return get("SELECT * FROM automations WHERE id=?", id);
  },
  runNow(id) {
    const cur = get("SELECT * FROM automations WHERE id=?", id);
    if (!cur) throw Object.assign(new Error("not found"), { status: 404, code: "NOT_FOUND" });
    run("UPDATE automations SET last_run=datetime('now') WHERE id=?", id);
    auditLog("automation", id, "run", { name: cur.name });
    // Real automation bodies plug in here (Kallel/integration).
    return { ...get("SELECT * FROM automations WHERE id=?", id), ran: true, note: "Automation body executes in the integration layer." };
  },
};

// Minimal ticker: marks due automations. Real schedules (cron) belong on the host.
export function startScheduler(intervalMs = 60000) {
  setInterval(() => {
    try {
      const due = all("SELECT * FROM automations WHERE enabled=1 AND schedule != ''");
      for (const a of due) auditLog("automation", a.id, "tick", { name: a.name, note: "scheduler tick — body runs in integration layer" });
    } catch { /* never crash the server on a tick */ }
  }, intervalMs).unref();
}
