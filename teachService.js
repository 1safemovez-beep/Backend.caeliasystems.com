// Teaching intake pipeline: Information -> Process -> Verify -> Relevance -> Permission -> Retention.
// Protection rules: source is ALWAYS 'alicia' (owner-only route). Nothing here
// writes to core identity — teaching lands in memory_facts / teach_queue only.
// Kallel's integration moves 'retention'-stage items into Caelia's learning.
import { all, get, run } from "../db/index.js";
import { memoryService } from "./memoryService.js";
import { auditLog } from "../middleware/audit.js";

const STAGES = ["information", "process", "verify", "relevance", "permission", "retention"];

export const teachService = {
  submit(directive) {
    if (!directive?.trim()) throw Object.assign(new Error("directive required"), { status: 400, code: "BAD_DIRECTIVE" });
    const r = run("INSERT INTO teach_queue (directive, source, stage) VALUES (?, 'alicia', 'information')", directive.trim());
    const item = get("SELECT * FROM teach_queue WHERE id=?", r.lastInsertRowid);
    auditLog("teach", item.id, "submit", { stage: "information" });
    return item;
  },
  // Advance one stage. 'permission' requires explicit grant (granted=true),
  // otherwise the item is held — never auto-retained.
  advance(id, { granted = false, note = "" } = {}) {
    const cur = get("SELECT * FROM teach_queue WHERE id=?", id);
    if (!cur) throw Object.assign(new Error("not found"), { status: 404, code: "NOT_FOUND" });
    const i = STAGES.indexOf(cur.stage);
    if (cur.stage === "retention") return cur;
    const next = STAGES[i + 1];
    if (next === "permission" && !granted) {
      run("UPDATE teach_queue SET stage='held', note=? WHERE id=?", note || "awaiting Alicia's permission", id);
      auditLog("teach", id, "held", { reason: "permission not granted" });
      return get("SELECT * FROM teach_queue WHERE id=?", id);
    }
    if (next === "retention") {
      // Retention = saved as an Alicia-sourced memory fact (core learning tier).
      memoryService.saveFact(cur.directive, "teaching", "alicia");
      run("UPDATE teach_queue SET stage='retention', note=?, processed_at=datetime('now') WHERE id=?", note, id);
    } else {
      run("UPDATE teach_queue SET stage=?, note=? WHERE id=?", next, note, id);
    }
    auditLog("teach", id, "advance", { from: cur.stage, to: next });
    return get("SELECT * FROM teach_queue WHERE id=?", id);
  },
  list(stage) {
    return stage
      ? all("SELECT * FROM teach_queue WHERE stage=? ORDER BY id DESC", stage)
      : all("SELECT * FROM teach_queue ORDER BY id DESC");
  },
};
