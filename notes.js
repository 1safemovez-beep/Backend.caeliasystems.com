import { Router } from "express";
import { all, get, run } from "../db/index.js";
import { audit } from "../middleware/audit.js";
export const notesRouter = Router();

notesRouter.get("/notes", (req, res) => {
  const rows = req.query.category
    ? all("SELECT * FROM notes WHERE category=? ORDER BY id DESC", req.query.category)
    : all("SELECT * FROM notes ORDER BY id DESC");
  res.json({ ok: true, notes: rows });
});
notesRouter.post("/notes", audit("create", "note"), (req, res, next) => {
  try {
    const { title, body, category, pinned } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });
    const r = run("INSERT INTO notes (title, body, category, pinned) VALUES (?,?,?,?)",
      title.trim(), body || "", category || "For You", pinned ? 1 : 0);
    res.json({ ok: true, ...get("SELECT * FROM notes WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});
notesRouter.delete("/notes/:id", audit("delete", "note"), (req, res) => {
  run("DELETE FROM notes WHERE id=?", req.params.id);
  res.json({ ok: true, id: Number(req.params.id) });
});
