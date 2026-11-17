import { Router } from "express";
import { taskService } from "../services/taskService.js";
import { audit } from "../middleware/audit.js";
export const tasksRouter = Router();

tasksRouter.get("/tasks", (req, res) => {
  res.json({ ok: true, tasks: taskService.list(req.query.status) });
});
tasksRouter.post("/tasks", audit("create", "task"), (req, res, next) => {
  try { res.json({ ok: true, ...taskService.create(req.body?.title) }); }
  catch (e) { next(e); }
});
tasksRouter.patch("/tasks/:id", audit("update", "task"), (req, res, next) => {
  try { res.json({ ok: true, ...taskService.update(req.params.id, req.body || {}) }); }
  catch (e) { next(e); }
});
tasksRouter.delete("/tasks/:id", audit("delete", "task"), (req, res) => {
  res.json({ ok: true, ...taskService.remove(req.params.id) });
});
