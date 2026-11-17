// Memory service: short-term context, saved facts, daily summaries.
// Two-tier rule enforced here: source='alicia' (core) vs 'experiential' (sandboxed).
import { all, get, run } from "../db/index.js";

export const memoryService = {
  saveFact(text, category = "general", source = "alicia") {
    if (source !== "alicia" && source !== "experiential")
      throw Object.assign(new Error("bad source"), { status: 400, code: "BAD_SOURCE" });
    const r = run("INSERT INTO memory_facts (text, category, source) VALUES (?,?,?)", text, category, source);
    return { id: Number(r.lastInsertRowid), text, category, source };
  },
  listFacts(source) {
    return source
      ? all("SELECT * FROM memory_facts WHERE source=? ORDER BY id DESC", source)
      : all("SELECT * FROM memory_facts ORDER BY id DESC");
  },
  deleteFact(id) {
    run("DELETE FROM memory_facts WHERE id=?", id);
    return { id };
  },
  setContext(key, value) {
    run(
      "INSERT INTO memory_context (key, value, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')",
      key, value
    );
    return { key, value };
  },
  getContext(key) {
    return key ? get("SELECT * FROM memory_context WHERE key=?", key) : all("SELECT * FROM memory_context");
  },
  saveSummary(date, summary) {
    run(
      "INSERT INTO daily_summaries (date, summary) VALUES (?,?) ON CONFLICT(date) DO UPDATE SET summary=excluded.summary",
      date, summary
    );
    return { date, summary };
  },
  listSummaries() {
    return all("SELECT * FROM daily_summaries ORDER BY date DESC");
  },
  counts() {
    return {
      facts: get("SELECT COUNT(*) n FROM memory_facts").n,
      contextKeys: get("SELECT COUNT(*) n FROM memory_context").n,
      summaries: get("SELECT COUNT(*) n FROM daily_summaries").n,
    };
  },
};
