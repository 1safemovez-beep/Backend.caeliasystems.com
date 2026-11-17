// Caelia overview + tutor queue for the Motherboard's hidden admin.
// Mounted under /api (owner sign-in required) through chatRouter.
// The backend holds the brain's key; the browser never sees it.
import { Router } from "express";
import { brainCall, brainConfigured } from "../services/brainClient.js";
import { auditLog } from "../middleware/audit.js";
export const caeliaRouter = Router();

const AVATAR_URL = () => String(process.env.AVATAR_URL || "https://caelia-avatar-production.up.railway.app").replace(/\/+$/, "");
const MOTHERBOARD_URL = () => String(process.env.MOTHERBOARD_URL || process.env.CANONICAL_DASHBOARD_URL || "https://motherboard.caeliasystems.com").replace(/\/+$/, "");
const BRAIN_URL = () => String(process.env.CAELIA_BRAIN_URL || "").trim().replace(/\/+$/, "").replace(/\/api$/, "");

async function ping(name, url) {
  if (!url) return { name, ok: false, note: "address not set" };
  const started = Date.now();
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return { name, ok: r.ok, status: r.status, ms: Date.now() - started };
  } catch (e) {
    return { name, ok: false, note: e.name === "AbortError" ? "timed out" : "unreachable", ms: Date.now() - started };
  } finally { clearTimeout(t); }
}

const safeAudit = (action, detail) => { try { auditLog("caelia", "", action, detail); } catch { /* never block */ } };
const relay = (res, r) => res.status(r.ok ? 200 : (r.status || 502)).json(r.ok ? r.data : { ok: false, error: r.error, ...(r.data || {}) });

// GET /api/caelia/overview — services, database, tracker, engines, tutors
caeliaRouter.get("/caelia/overview", async (_req, res, next) => {
  try {
    const [brain, ...services] = await Promise.all([
      brainCall("/api/brain/overview"),
      ping("Brain", BRAIN_URL() ? BRAIN_URL() + "/api/health" : ""),
      ping("Avatar", AVATAR_URL() + "/health"),
      ping("Motherboard", MOTHERBOARD_URL() + "/health"),
    ]);
    services.unshift({ name: "Backend", ok: true, status: 200, ms: 0 });
    res.json({
      ok: true,
      services,
      brainConfigured: brainConfigured(),
      brain: brain.ok ? brain.data : { ok: false, error: brain.error },
      time: new Date().toISOString(),
    });
  } catch (e) { next(e); }
});

// Tutor queue
caeliaRouter.get("/caelia/tutor/proposals", async (req, res) => {
  const status = ["pending", "approved", "rejected"].includes(req.query.status) ? "?status=" + req.query.status : "";
  relay(res, await brainCall("/api/brain/tutor/proposals" + status));
});
caeliaRouter.post("/caelia/tutor/review", async (_req, res) => {
  safeAudit("tutor-review", {});
  relay(res, await brainCall("/api/brain/tutor/review", "POST", {}));
});
caeliaRouter.post("/caelia/tutor/proposals/:id/:action", async (req, res) => {
  const { id, action } = req.params;
  if (!/^[A-Za-z0-9_-]+$/.test(id) || !["approve", "reject"].includes(action)) return res.status(400).json({ ok: false, error: "BAD_REQUEST" });
  safeAudit("tutor-" + action, { id });
  const body = action === "approve" && typeof req.body?.lesson === "string" ? { lesson: req.body.lesson.slice(0, 500) } : {};
  relay(res, await brainCall(`/api/brain/tutor/proposals/${id}/${action}`, "POST", body));
});

// Lessons in her core + Alicia's directives waiting for approval
caeliaRouter.get("/caelia/lessons", async (_req, res) => relay(res, await brainCall("/api/brain/lessons")));
caeliaRouter.post("/caelia/lessons/:id/approve", async (req, res) => {
  if (!/^[A-Za-z0-9_-]+$/.test(req.params.id)) return res.status(400).json({ ok: false, error: "BAD_REQUEST" });
  safeAudit("lesson-approve", { id: req.params.id });
  relay(res, await brainCall(`/api/brain/lessons/${req.params.id}/approve`, "POST", {}));
});
