// Tasks service — CRUD for the Active Tasks tracker.
import { all, get, run } from "../db/index.js";

const VALID = ["open", "in_progress", "complete"];

export const taskService = {
  list(status) {
    return status
      ? all("SELECT * FROM tasks WHERE status=? ORDER BY id DESC", status)
      : all("SELECT * FROM tasks ORDER BY id DESC");
  },
  create(title) {
    if (!title?.trim()) throw Object.assign(new Error("title required"), { status: 400, code: "BAD_TITLE" });
    const r = run("INSERT INTO tasks (title, status) VALUES (?, 'open')", title.trim());
    return get("SELECT * FROM tasks WHERE id=?", r.lastInsertRowid);
  },
  update(id, patch) {
    const cur = get("SELECT * FROM tasks WHERE id=?", id);
    if (!cur) throw Object.assign(new Error("not found"), { status: 404, code: "NOT_FOUND" });
    const title = patch.title ?? cur.title;
    const status = patch.status ?? cur.status;
    if (!VALID.includes(status)) throw Object.assign(new Error("bad status"), { status: 400, code: "BAD_STATUS" });
    run("UPDATE tasks SET title=?, status=?, updated_at=datetime('now') WHERE id=?", title, status, id);
    return get("SELECT * FROM tasks WHERE id=?", id);
  },
  remove(id) {
    run("DELETE FROM tasks WHERE id=?", id);
    return { id: Number(id) };
  },
};
