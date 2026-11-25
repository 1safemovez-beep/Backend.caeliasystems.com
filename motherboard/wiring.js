/* CAELIA MOTHERBOARD — live backend wiring (additive; no layout/design changes).
   Loaded AFTER the dashboard's inline scripts. Uses their globals: state, save,
   renderCounters, renderActivity, toast, BrainAPI.
   Security: no token is ever stored in the browser. The owner types OWNER_TOKEN once
   into the Admin Panel; the backend verifies it and sets an HttpOnly session cookie. */
(function () {
  "use strict";
  const BASE = (window.CAELIA_BACKEND_URL || "https://backend.caeliasystems.com").replace(/\/+$/, "");
  sessionStorage.removeItem("caelia_owner_token"); // legacy: never keep a token in the browser

  const NOTES = {
    BRAIN_NOT_CONFIGURED: "Brain URL is not configured on the backend.",
    BRAIN_UNREACHABLE: "The backend cannot reach Caelia's Brain.",
    BRAIN_TIMEOUT: "Caelia's Brain took too long to answer.",
    BRAIN_AUTH_REJECTED: "The Brain rejected the backend's credential.",
    BRAIN_UPSTREAM_ERROR: "The Brain returned an error.",
    UNAUTHORIZED: "Owner session required — sign in from the Admin Panel.",
    RATE_LIMITED: "Too many requests — wait a moment.",
    BAD_ORIGIN: "Request origin was refused by the backend.",
  };
  const ENGINE_IDS = { personal: "personal-commercial", qvpro: "qv-pro" };

  const live = (window.CaeliaLive = { status: "connecting", authenticated: false, system: null, summary: null });
  let timer = null;

  /* ---------- connection state badge (small, fixed, non-intrusive) ---------- */
  const badge = document.createElement("div");
  badge.id = "backendBadge";
  badge.setAttribute("role", "status");
  badge.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:50;font:600 10px system-ui,sans-serif;letter-spacing:.5px;padding:3px 8px;border-radius:10px;background:#120a2ecc;border:1px solid #3b1f7a;color:#cfc6ff;pointer-events:none";
  document.body.appendChild(badge);
  const LABEL = {
    connecting: ["#ffb347", "BACKEND · CONNECTING"],
    online: ["#22ff88", "BACKEND · LIVE"],
    auth_required: ["#ffb347", "BACKEND · SIGN IN (ADMIN)"],
    degraded: ["#ffb347", "BACKEND · DEGRADED"],
    offline: ["#ff5577", "BACKEND · OFFLINE — RETRYING"],
  };
  function setStatus(s) {
    const was = live.status;
    live.status = s;
    const [c, t] = LABEL[s];
    badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:6px"></span>${t}`;
    document.documentElement.dataset.backend = s;
    if (was === "offline" && (s === "online" || s === "auth_required")) toast("Backend reconnected");
    if (was !== "offline" && s === "offline" && was !== "connecting") toast("Backend disconnected — working locally, retrying");
  }

  /* ---------- request layer ---------- */
  async function req(path, { method = "GET", body, form } = {}) {
    const init = { method, credentials: "include", headers: {} };
    if (form) init.body = form;
    else if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(BASE + path, init); }
    catch (e) { return { ok: false, status: 0, error: "BACKEND_UNAVAILABLE", note: "Cannot reach the backend (network, DNS or CORS)." }; }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { live.authenticated = false; setStatus("auth_required"); }
    if (!res.ok || data.ok === false) {
      const code = data.error || `HTTP ${res.status}`;
      return { ...data, ok: false, status: res.status, error: code, note: NOTES[code] || data.note || code };
    }
    return { ...data, ok: true, status: res.status };
  }

  Object.assign(BrainAPI, {
    endpoint: BASE + "/api",
    get token() { return ""; },
    setToken() { /* tokens are never kept client-side */ },
    request: (path, body, method = "POST") => req("/api" + path, { method, body }),
    async health() { const r = await req("/api/health"); this.connected = r.ok; return r; },
    async login(token) { return req("/auth/login", { method: "POST", body: { token } }); },
    async logout() { const r = await req("/auth/logout", { method: "POST" }); live.authenticated = false; return r; },
    systemStatus: () => req("/api/system/status"),
    summary: () => req("/api/dashboard/summary"),
    saveFact: (text) => req("/api/memory/facts", { method: "POST", body: { text } }),
    deleteFact: (id) => req(`/api/memory/facts/${encodeURIComponent(id)}`, { method: "DELETE" }),
    uploadFile(file) { const f = new FormData(); f.append("file", file); return req("/api/files", { method: "POST", form: f }); },
    async downloadFile(meta) {
      const res = await fetch(`${BASE}/api/files/${meta.id}/download`, { credentials: "include" });
      if (!res.ok) return toast("Download failed (HTTP " + res.status + ")");
      const a = document.createElement("a"); a.href = URL.createObjectURL(await res.blob()); a.download = meta.n; a.click();
    },
    async runEngine(id, params) {
      const target = (params && (params.q || params.target_name)) || "Untitled evaluation";
      const r = await req(`/api/engines/${encodeURIComponent(ENGINE_IDS[id] || id)}/run`, { method: "POST", body: { target_name: target, context_notes: target } });
      r.note = r.ok ? (r.note || `Evaluation ${r.status === 200 ? "accepted" : "queued"} (${r.engine}).`) : r.note;
      return r;
    },
  });

  /* ---------- hydrate panels from the live backend ---------- */
  function ago(ts) { const d = new Date(ts.replace(" ", "T") + "Z"); return isNaN(d) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  const ICON = { memory_fact: "🧠", file: "📄", chat: "💬", engine: "🧊", teach: "📚", failsafe: "🛟", agent: "🤖", bridge: "▦" };
  async function hydrate() {
    const h = await BrainAPI.health();
    if (!h.ok) { live.authenticated = false; setStatus("offline"); return schedule(15000); }
    const s = await BrainAPI.summary();
    if (s.status === 401) { setStatus("auth_required"); return schedule(30000); }
    if (!s.ok) { setStatus("degraded"); return schedule(15000); }
    live.authenticated = true; live.summary = s;
    state.counters.files = s.counters.files;
    state.counters.memory = s.counters.memory;
    state.counters.automations = s.counters.automations;
    state.facts = s.facts.map((f) => ({ id: f.id, text: f.text, ts: Date.parse(f.created_at.replace(" ", "T") + "Z") || Date.now() }));
    state.files = s.files.map((f) => ({ id: f.id, n: f.name, t: "file", s: f.size, data: null }));
    if (s.activity.length) state.activity = s.activity.map((a) => ({ i: ICON[a.entity] || "•", t: `${a.action} · ${a.entity}`, time: ago(a.created_at) }));
    save(); renderCounters(); renderActivity();
    const sys = await BrainAPI.systemStatus();
    if (sys.ok) {
      live.system = sys;
      if (Array.isArray(state.requirements) && sys.engines?.checks)
        state.requirements = sys.engines.checks.map((c) => ({ n: c.name, st: c.present ? "ready" : "needs" }));
      state.requirements && save();
      setStatus(sys.database.ok && sys.brain.ok ? "online" : "degraded");
    } else setStatus("degraded");
    schedule(30000);
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(hydrate, ms); }
  window.CaeliaHydrate = hydrate;

  /* ---------- Admin Panel: sign in / out (capture phase, replaces token-in-browser flow) ---------- */
  document.addEventListener("click", async (e) => {
    const id = e.target && e.target.id;
    if (id !== "brainConnect" && id !== "brainDisconnect") return;
    e.stopImmediatePropagation();
    const st = document.getElementById("brainStatus"), inp = document.getElementById("brainToken");
    if (id === "brainDisconnect") { await BrainAPI.logout(); setStatus("auth_required"); st.textContent = "○ Signed out."; return; }
    st.textContent = "… signing in";
    const r = await BrainAPI.login(inp.value.trim());
    inp.value = ""; // never keep the token around
    if (!r.ok) { st.textContent = "○ Sign-in failed — " + r.note; toast("Sign-in failed"); return; }
    st.textContent = "● Signed in — loading live data"; toast("Owner session started");
    await hydrate();
    const sys = live.system;
    st.textContent = sys
      ? `● Backend live · database ${sys.database.ok ? "ok" : "DOWN"} · Brain ${sys.brain.ok ? "ok" : sys.brain.error} · Tracer ${sys.tracer.ok ? "ok" : sys.tracer.error}`
      : "● Signed in — status unavailable";
  }, true);
  const crystal = document.getElementById("crystalBtn");
  if (crystal) crystal.addEventListener("click", () => setTimeout(() => {
    const inp = document.getElementById("brainToken"), st = document.getElementById("brainStatus");
    if (inp) { inp.value = ""; inp.placeholder = "Owner token (sent once, never stored)"; }
    if (st) st.textContent = { online: "● Backend live — signed in", auth_required: "○ Backend reachable — sign in", offline: "○ Backend not reachable — retrying", degraded: "◐ Backend up, a downstream is failing", connecting: "… connecting" }[live.status];
  }, 120));

  hydrate();
})();
