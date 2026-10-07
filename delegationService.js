// Delegation service — the Delegation Switchboard.
// Caelia (Lead AI) bridges specialized tasks to Fawn/Nova in their own
// containers, monitors progress, returns the final result.
// Protection: delegation NEVER transfers unrestricted authority — every
// delegation is scoped, logged, and revocable by Alicia.
import { all, get, run } from "../db/index.js";
import { auditLog } from "../middleware/audit.js";
import { agents } from "../agents/index.js";

const VALID_AGENTS = ["fawn", "nova"];

export const delegationService = {
  list() { return all("SELECT * FROM delegations ORDER BY id DESC"); },
  delegate(agent, task) {
    agent = String(agent || "").toLowerCase();
    if (!VALID_AGENTS.includes(agent))
      throw Object.assign(new Error("unknown agent"), { status: 400, code: "BAD_AGENT" });
    if (!task) throw Object.assign(new Error("task required"), { status: 400, code: "BAD_TASK" });
    const handler = agents[agent];
    const accepted = handler.accept(task); // agent validates scope; may refuse
    const r = run("INSERT INTO delegations (agent, task_json, status) VALUES (?,?,?)",
      agent, JSON.stringify(task), accepted.accepted ? "delegated" : "failed");
    const row = get("SELECT * FROM delegations WHERE id=?", r.lastInsertRowid);
    auditLog("delegation", row.id, "delegate", { agent, accepted: accepted.accepted });
    return { ...row, agent_response: accepted };
  },
  progress(id, progress) {
    const cur = get("SELECT * FROM delegations WHERE id=?", id);
    if (!cur) throw Object.assign(new Error("not found"), { status: 404, code: "NOT_FOUND" });
    run("UPDATE delegations SET status='in_progress', progress_json=?, updated_at=datetime('now') WHERE id=?",
      JSON.stringify(progress || {}), id);
    return get("SELECT * FROM delegations WHERE id=?", id);
  },
  complete(id, result) {
    const cur = get("SELECT * FROM delegations WHERE id=?", id);
    if (!cur) throw Object.assign(new Error("not found"), { status: 404, code: "NOT_FOUND" });
    run("UPDATE delegations SET status='complete', result_json=?, updated_at=datetime('now') WHERE id=?",
      JSON.stringify(result || {}), id);
    auditLog("delegation", id, "complete", { agent: cur.agent });
    return get("SELECT * FROM delegations WHERE id=?", id);
  },
};
