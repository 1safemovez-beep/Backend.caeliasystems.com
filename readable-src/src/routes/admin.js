import { Router } from "express";
import { all, get, run } from "../db/index.js";
import { audit } from "../middleware/audit.js";
export const adminRouter = Router();
// Hidden admin mini-dashboard backend (Spec 1-3, 9, 11, 19, 27-31).
// Owner-only. Everything here is Alicia's private domain.

// Role / representation control (Spec 11)
adminRouter.get("/admin/roles", (_req, res) => {
  res.json({ ok: true, roles: all("SELECT * FROM roles ORDER BY id DESC") });
});
adminRouter.post("/admin/roles", audit("create", "role"), (req, res, next) => {
  try {
    const { name, directives, active } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ ok: false, error: "NAME_REQUIRED" });
    if (active) run("UPDATE roles SET active=0");
    const r = run("INSERT INTO roles (name, directives_json, active) VALUES (?,?,?)",
      name.trim(), JSON.stringify(directives || {}), active ? 1 : 0);
    res.json({ ok: true, ...get("SELECT * FROM roles WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});

// Money matters (Spec 19) — bills + revenue
adminRouter.get("/admin/money", (_req, res) => {
  res.json({
    ok: true,
    bills: all("SELECT * FROM money_bills ORDER BY id DESC"),
    revenue: all("SELECT * FROM money_revenue ORDER BY id DESC"),
  });
});
adminRouter.post("/admin/money/bills", audit("create", "bill"), (req, res, next) => {
  try {
    const { description, amount, due_date } = req.body || {};
    if (!description) return res.status(400).json({ ok: false, error: "DESCRIPTION_REQUIRED" });
    const r = run("INSERT INTO money_bills (description, amount, due_date) VALUES (?,?,?)",
      description, Number(amount) || 0, due_date || "");
    res.json({ ok: true, ...get("SELECT * FROM money_bills WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});
adminRouter.post("/admin/money/bills/:id/pay", audit("pay", "bill"), (req, res) => {
  run("UPDATE money_bills SET paid=1 WHERE id=?", req.params.id);
  res.json({ ok: true, id: Number(req.params.id), paid: true });
});
adminRouter.post("/admin/money/revenue", audit("create", "revenue"), (req, res, next) => {
  try {
    const { source, amount, date } = req.body || {};
    if (!source) return res.status(400).json({ ok: false, error: "SOURCE_REQUIRED" });
    const r = run("INSERT INTO money_revenue (source, amount, date) VALUES (?,?,?)",
      source, Number(amount) || 0, date || new Date().toISOString().slice(0, 10));
    res.json({ ok: true, ...get("SELECT * FROM money_revenue WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});

// Soul button — ethics/morality lessons, Alicia's teaching ONLY (Spec 31).
// No outside ideology can enter here: route is owner-only by construction.
adminRouter.get("/admin/soul", (_req, res) => {
  res.json({ ok: true, lessons: all("SELECT * FROM soul_lessons ORDER BY id DESC") });
});
adminRouter.post("/admin/soul", audit("create", "soul_lesson"), (req, res, next) => {
  try {
    const { lesson } = req.body || {};
    if (!lesson?.trim()) return res.status(400).json({ ok: false, error: "LESSON_REQUIRED" });
    const r = run("INSERT INTO soul_lessons (lesson, source) VALUES (?, 'alicia')", lesson.trim());
    res.json({ ok: true, ...get("SELECT * FROM soul_lessons WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});

// Private discussions (Spec 11)
adminRouter.get("/admin/discussions", (_req, res) => {
  res.json({ ok: true, discussions: all("SELECT * FROM private_discussions ORDER BY id DESC") });
});
adminRouter.post("/admin/discussions", audit("create", "discussion"), (req, res, next) => {
  try {
    const { topic, body } = req.body || {};
    if (!topic?.trim()) return res.status(400).json({ ok: false, error: "TOPIC_REQUIRED" });
    const r = run("INSERT INTO private_discussions (topic, body) VALUES (?,?)", topic.trim(), body || "");
    res.json({ ok: true, ...get("SELECT * FROM private_discussions WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});

// Tom's secret box / token safe / safe folder — METADATA ONLY (Spec 3).
// Names only, never values. Contents never touch code or DB.
adminRouter.get("/admin/vault", (req, res) => {
  const rows = req.query.box
    ? all("SELECT * FROM vault_meta WHERE box=? ORDER BY id DESC", req.query.box)
    : all("SELECT * FROM vault_meta ORDER BY id DESC");
  res.json({ ok: true, entries: rows, note: "Metadata only. Values live in Alicia's vault, never here." });
});
adminRouter.post("/admin/vault", audit("create", "vault_meta"), (req, res, next) => {
  try {
    const { box, name, note } = req.body || {};
    if (!["toms_box", "token_safe", "safe_folder"].includes(box))
      return res.status(400).json({ ok: false, error: "BAD_BOX" });
    if (!name?.trim()) return res.status(400).json({ ok: false, error: "NAME_REQUIRED" });
    const r = run("INSERT INTO vault_meta (box, name, note) VALUES (?,?,?)", box, name.trim(), note || "");
    res.json({ ok: true, ...get("SELECT * FROM vault_meta WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});
adminRouter.delete("/admin/vault/:id", audit("delete", "vault_meta"), (req, res) => {
  run("DELETE FROM vault_meta WHERE id=?", req.params.id);
  res.json({ ok: true, id: Number(req.params.id) });
});
