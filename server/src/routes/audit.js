import { Router } from "express";
import { all } from "../db/index.js";
export const auditRouter = Router();
// Audit log query — owner only. The auditability Caelia's protection
// framework requires: who did what, when.
auditRouter.get("/audit", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
  const rows = req.query.entity
    ? all("SELECT * FROM audit_log WHERE entity=? ORDER BY id DESC LIMIT ?", req.query.entity, limit)
    : all("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", limit);
  res.json({ ok: true, entries: rows });
});
