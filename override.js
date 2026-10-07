import { Router } from "express";
import { all, get, run } from "../db/index.js";
import { audit } from "../middleware/audit.js";
export const overrideRouter = Router();

// Hidden admin override (Spec 16): Alicia can cancel or replace a bad
// public command. Every override is audit-logged.
overrideRouter.post("/override", audit("override", "command"), (req, res, next) => {
  try {
    const { target, action, replacement } = req.body || {};
    if (!target || !["cancel", "replace"].includes(action))
      return res.status(400).json({ ok: false, error: "TARGET_AND_ACTION_REQUIRED" });
    if (action === "replace" && !replacement)
      return res.status(400).json({ ok: false, error: "REPLACEMENT_REQUIRED" });
    const r = run("INSERT INTO overrides (target, action, replacement, by_actor) VALUES (?,?,?,?)",
      target, action, replacement || "", "alicia");
    res.json({ ok: true, ...get("SELECT * FROM overrides WHERE id=?", r.lastInsertRowid) });
  } catch (e) { next(e); }
});
overrideRouter.get("/override", (_req, res) => {
  res.json({ ok: true, overrides: all("SELECT * FROM overrides ORDER BY id DESC LIMIT 50") });
});
