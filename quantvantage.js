// QuantVantage evaluator engine adapter — REAL integration.
// The Python evaluator lives bundled at ./python/ and is invoked via
// child_process with JSON in/out (no sidecar to deploy, single process).
// Engines are services Caelia USES under her authority — never part of Core.
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { get, all, run } from "../db/index.js";
import { config } from "../config.js";
import { postOpsAlert } from "../discord/alerts.js";

const here = dirname(fileURLToPath(import.meta.url));
const RUNNER = resolve(here, "python/run_evaluation.py");
const PYTHON = process.env.QV_PYTHON || "python3";

// ---- "What Caelia needs to function" — engine readiness --------------------
export function checkReadiness() {
  const has = (name) => {
    const v = process.env[name] || "";
    return Boolean(v && !v.startsWith("PASTE_"));
  };
  let pythonOk = false;
  try {
    const r = spawnSync(PYTHON, ["--version"], { timeout: 5000 });
    pythonOk = r.status === 0;
  } catch { pythonOk = false; }
  let anthropicOk = false;
  try {
    const r = spawnSync(PYTHON, ["-c", "import anthropic"], { timeout: 8000 });
    anthropicOk = r.status === 0;
  } catch { anthropicOk = false; }
  const keyOk = has("ANTHROPIC_API_KEY");
  const stripeOk = has("STRIPE_SECRETS_KEY");
  const live = pythonOk && anthropicOk && keyOk;
  return {
    engine: "quantvantage",
    live,
    status: live ? "ready" : "needs_setup",
    // names only — never values
    checks: [
      { name: "python3", present: pythonOk, how: "Interpreter for the bundled evaluator." },
      { name: "anthropic python package", present: anthropicOk, how: "pip install -r src/engines/python/requirements.txt" },
      { name: "ANTHROPIC_API_KEY", present: keyOk, how: "Alicia enters it herself at deploy — never in chat/code." },
      { name: "STRIPE_SECRETS_KEY (optional)", present: stripeOk, how: "Only for paid report-unlock verification." },
    ],
  };
}

// ---- Job queue (evaluations table) ------------------------------------------
function createJob(engine, params) {
  const r = run(
    "INSERT INTO evaluations (engine, target_name, mode, status) VALUES (?,?,?,?)",
    engine, params.target_name || "", params.mode || "commercial", "queued"
  );
  return get("SELECT * FROM evaluations WHERE id=?", r.lastInsertRowid);
}
function setJob(id, patch) {
  const keys = Object.keys(patch);
  run(`UPDATE evaluations SET ${keys.map((k) => `${k}=?`).join(", ")}, updated_at=datetime('now') WHERE id=?`,
    ...keys.map((k) => patch[k]), id);
  return get("SELECT * FROM evaluations WHERE id=?", id);
}

function spawnRunner(jobId, params) {
  setJob(jobId, { status: "running" });
  const child = spawn(PYTHON, [RUNNER], { timeout: 1000 * 60 * 5 });
  let out = "", err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  child.on("error", (e) => {
    setJob(jobId, { status: "failed", error: `SPAWN_FAILED: ${String(e.message).slice(0, 300)}` });
    postOpsAlert(`Evaluation job #${jobId} failed to spawn: ${String(e.message).slice(0, 160)}`);
  });
  child.on("close", (code) => {
    try {
      const parsed = JSON.parse(out.trim().split("\n").pop());
      if (parsed.ok) {
        setJob(jobId, { status: "complete", result_json: JSON.stringify(parsed), error: null });
      } else {
        setJob(jobId, { status: code === 3 ? "needs_key" : "failed",
          result_json: JSON.stringify(parsed), error: parsed.error || "ENGINE_FAILED" });
        if (code !== 3) {
          postOpsAlert(`Evaluation job #${jobId} failed: ${(parsed.error || "ENGINE_FAILED").slice(0, 160)}`);
        }
      }
    } catch {
      setJob(jobId, { status: "failed", error: `BAD_RUNNER_OUTPUT: ${err.slice(0, 300) || "exit " + code}` });
      postOpsAlert(`Evaluation job #${jobId} produced bad runner output (exit ${code}).`);
    }
  });
  try { child.stdin.write(JSON.stringify(params)); child.stdin.end(); }
  catch { /* spawn error path handles it */ }
}

// ---- Engine registry entries -------------------------------------------------
export const quantvantageEngine = {
  id: "qv-pro",
  name: "QV Pro Engine",
  mode: "commercial",
  describe() {
    const r = checkReadiness();
    return { id: this.id, name: this.name, mode: this.mode,
      status: r.live ? "ready" : "needs_setup",
      note: r.live ? "Live AI evaluations via bundled Python runner."
                   : "Bundled runner present — needs ANTHROPIC_API_KEY + anthropic package (see /api/engines/readiness)." };
  },
  // Queues an evaluation; returns the job immediately (Caelia polls the job).
  async run(params = {}) {
    if (!params.target_name) {
      return { ok: false, error: "BAD_INPUT", note: "target_name is required." };
    }
    const job = createJob("qv-pro", params);
    setImmediate(() => spawnRunner(job.id, params));
    return { ok: true, job_id: job.id, status: "queued",
      poll: `/api/engines/evaluations/${job.id}`,
      note: "Evaluation queued — poll the job URL for the result." };
  },
};

export const personalEngine = {
  id: "personal-commercial",
  name: "Personal / Commercial Engine",
  mode: "personal",
  describe() {
    const r = checkReadiness();
    return { id: this.id, name: this.name, mode: this.mode,
      status: r.live ? "ready" : "needs_setup",
      note: "Mode-switch engine — same runner, personal lens prompt." };
  },
  async run(params = {}) {
    if (!params.target_name) {
      return { ok: false, error: "BAD_INPUT", note: "target_name is required." };
    }
    const job = createJob("personal-commercial", { ...params, mode: "personal" });
    setImmediate(() => spawnRunner(job.id, { ...params, mode: "personal" }));
    return { ok: true, job_id: job.id, status: "queued",
      poll: `/api/engines/evaluations/${job.id}` };
  },
};

export const engineJobs = {
  get: (id) => get("SELECT * FROM evaluations WHERE id=?", id),
  list: (limit = 20) => all("SELECT * FROM evaluations ORDER BY id DESC LIMIT ?",
    Math.min(Number(limit) || 20, 100)),
};
