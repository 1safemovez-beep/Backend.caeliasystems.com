import { Router } from "express";
import { all, get } from "../db/index.js";
import { checkReadiness } from "../engines/quantvantage.js";
export const statusRouter = Router();

// Public status page — STRICTLY non-sensitive data only.
// No secret values, no vault contents, no owner info. Names + counts only.
statusRouter.get("/status", (_req, res) => {
  const readiness = checkReadiness();
  const counts = {
    tasks: get("SELECT COUNT(*) n FROM tasks").n,
    memory: get("SELECT COUNT(*) n FROM memory_facts").n,
    evaluations: get("SELECT COUNT(*) n FROM evaluations").n,
    evaluations_complete: get("SELECT COUNT(*) n FROM evaluations WHERE status='complete'").n,
    heartbeats: get("SELECT COUNT(*) n FROM bridge_heartbeats").n,
    delegations: get("SELECT COUNT(*) n FROM delegations").n,
    audit_events: get("SELECT COUNT(*) n FROM audit_log").n,
    vault_containers: all("SELECT name, kind FROM vault_containers").map((c) => c.name),
    vault_secrets: get("SELECT COUNT(*) n FROM vault_secrets").n,
  };
  const recentEval = all("SELECT id, engine, target_name, mode, status, created_at FROM evaluations ORDER BY id DESC LIMIT 5");
  const recentAudit = all("SELECT action, entity, created_at FROM audit_log ORDER BY id DESC LIMIT 8");
  const dot = (ok) => ok ? "#22ff88" : "#ff5577";
  const rows = readiness.checks.map((c) =>
    `<div class="check"><span class="d" style="background:${dot(c.present)}"></span><b>${c.name}</b><span>${c.present ? "ready" : "missing"}</span></div>`).join("");
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Caelia Motherboard — Backend Status</title>
<style>
body{background:#070510;color:#cfc6ff;font-family:system-ui,sans-serif;margin:0;padding:24px}
.wrap{max-width:900px;margin:0 auto}
h1{color:#fff;text-shadow:0 0 18px #8a2be2;font-size:22px}
.card{background:#120a2e;border:1px solid #3b1f7a;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 0 24px #8a2be233}
.k{color:#9d8cff;font-size:12px;text-transform:uppercase;letter-spacing:1px}
.v{font-size:26px;color:#fff}
.check{display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid #241547}
.d{width:10px;height:10px;border-radius:50%;box-shadow:0 0 8px currentColor}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
table{width:100%;font-size:13px;border-collapse:collapse}
td{padding:5px 4px;border-bottom:1px solid #241547}
.note{color:#7d6fb0;font-size:12px}
a{color:#b48cff}
</style></head><body><div class="wrap">
<h1>◈ Caelia Motherboard Backend</h1>
<div class="card"><div class="k">Engine status</div>
<div class="v" style="color:${readiness.live ? "#22ff88" : "#ffb347"}">${readiness.live ? "● LIVE" : "● NEEDS SETUP"}</div>
<div class="note">QuantVantage evaluation engine — ${readiness.live ? "live AI evaluations" : "bundled runner present; awaiting keys"}</div></div>
<div class="card"><div class="k">What Caelia needs to function</div>${rows}</div>
<div class="card"><div class="k">Activity</div><div class="grid">
<div><div class="k">tasks</div><div class="v">${counts.tasks}</div></div>
<div><div class="k">memory facts</div><div class="v">${counts.memory}</div></div>
<div><div class="k">evaluations</div><div class="v">${counts.evaluations}</div></div>
<div><div class="k">heartbeats</div><div class="v">${counts.heartbeats}</div></div>
<div><div class="k">delegations</div><div class="v">${counts.delegations}</div></div>
<div><div class="k">audit events</div><div class="v">${counts.audit_events}</div></div>
</div></div>
<div class="card"><div class="k">Backend Safe</div>
<div class="note">containers: ${counts.vault_containers.join(" · ")} — ${counts.vault_secrets} secrets stored (names only shown)</div></div>
<div class="card"><div class="k">Recent evaluations</div><table>
${recentEval.map((e) => `<tr><td>#${e.id}</td><td>${e.engine}</td><td>${e.target_name || "—"}</td><td>${e.mode}</td><td>${e.status}</td></tr>`).join("") || '<tr><td class="note">none yet</td></tr>'}
</table></div>
<div class="card"><div class="k">Audit tail</div><table>
${recentAudit.map((a) => `<tr><td>${a.action}</td><td>${a.entity}</td><td>${a.created_at}</td></tr>`).join("") || '<tr><td class="note">none yet</td></tr>'}
</table></div>
<div class="note">Full API is owner-authenticated. <a href="/health">/health</a> · <a href="/api/engines/readiness">engine readiness (auth)</a></div>
</div></body></html>`);
});
