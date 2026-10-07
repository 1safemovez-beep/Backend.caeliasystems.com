import { Router } from "express";
import multer from "multer";
import { join } from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { all, get, run } from "../db/index.js";
import { config } from "../config.js";
import { audit } from "../middleware/audit.js";
export const filesRouter = Router();

// Metadata lives in the DB; bytes live in STORAGE_DIR (never in the DB).
const upload = multer({
  dest: config.storageDir,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
});

filesRouter.get("/files", (_req, res) => {
  res.json({ ok: true, files: all("SELECT * FROM files_meta ORDER BY id DESC") });
});
filesRouter.post("/files", upload.single("file"), audit("upload", "file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
  const r = run("INSERT INTO files_meta (filename, original_name, mime, size, uploaded_by) VALUES (?,?,?,?,?)",
    req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, "alicia");
  res.json({ ok: true, ...get("SELECT * FROM files_meta WHERE id=?", r.lastInsertRowid) });
});
filesRouter.get("/files/:id/download", (req, res, next) => {
  try {
    const meta = get("SELECT * FROM files_meta WHERE id=?", req.params.id);
    if (!meta) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const p = join(config.storageDir, meta.filename);
    if (!existsSync(p)) return res.status(410).json({ ok: false, error: "FILE_MISSING" });
    const safeName = String(meta.original_name || "download")
      .replace(/[\\\r\n"]/g, "_")
      .replace(/[\\/]/g, "_")
      .slice(0, 180) || "download";
    res.setHeader("content-type", meta.mime || "application/octet-stream");
    res.setHeader("content-disposition", `attachment; filename="${safeName}"`);
    res.setHeader("x-content-type-options", "nosniff");
    createReadStream(p).pipe(res);
  } catch (e) { next(e); }
});
filesRouter.delete("/files/:id", audit("delete", "file"), (req, res) => {
  run("DELETE FROM files_meta WHERE id=?", req.params.id);
  res.json({ ok: true, id: Number(req.params.id), note: "Metadata removed. Bytes in storage/ are cleaned by the host." });
});
