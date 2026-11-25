// Caelia Motherboard Backend — entry point.
// Alicia is the owner. All /api/* routes are owner-authenticated (Bearer token
// from OWNER_TOKEN env). Only /health is public.
// Caelia's Core/Soul/Brain arrives via Kallel's integration — this package is
// the infrastructure it plugs into. No brain content is invented here.
import express from "express";
import { config, assertConfigured, allowedOrigins } from "./config.js";
import { migrate } from "./db/index.js";
import { requireAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { systemRouter } from "./routes/system.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { startScheduler } from "./services/automationService.js";
import { checkReadiness } from "./engines/quantvantage.js";

import { healthRouter } from "./routes/health.js";
import { statusRouter } from "./routes/status.js";
import { chatRouter } from "./routes/chat.js";
import { memoryRouter } from "./routes/memory.js";
import { tasksRouter } from "./routes/tasks.js";
import { notesRouter } from "./routes/notes.js";
import { filesRouter } from "./routes/files.js";
import { automationsRouter } from "./routes/automations.js";
import { analyticsRouter } from "./routes/analytics.js";
import { enginesRouter } from "./routes/engines.js";
import { teachRouter } from "./routes/teach.js";
import { failsafeRouter } from "./routes/failsafe.js";
import { overrideRouter } from "./routes/override.js";
import { agentsRouter } from "./routes/agents.js";
import { bridgeRouter } from "./routes/bridge.js";
import { learningRouter } from "./routes/learning.js";
import { adminRouter } from "./routes/admin.js";
import { voiceRouter } from "./routes/voice.js";
import { auditRouter } from "./routes/audit.js";
import { vaultRouter } from "./routes/vault.js";
import { discordRouter } from "./routes/discord.js";
import { initDiscord } from "./discord/bot.js";

migrate();
assertConfigured();

const app = express();

// Canonical backend routing. The public Caelia site and Motherboard are
// separate applications. Cloudflare handles the public-domain routing; this
// process owns only backend.caeliasystems.com. The backend root is a friendly
// redirect to the Motherboard, while API and health endpoints stay on the
// backend host.
const canonicalDashboard = process.env.CANONICAL_DASHBOARD_URL || "https://motherboard.caeliasystems.com";
app.use((req, res, next) => {
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  if (host === "backend.caeliasystems.com" && req.path === "/") {
    return res.redirect(302, canonicalDashboard);
  }
  next();
});

app.use(express.json({ limit: "2mb" }));

// Behind Railway's proxy: trust one hop so req.ip is the client (rate limits, audit).
app.set("trust proxy", 1);

// CORS: exact configured dashboard origins only, with credentials for the session cookie.
const origins = allowedOrigins();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("cache-control", "no-store");
  if (req.method === "OPTIONS") {
    if (origin && !origins.includes(origin)) return res.sendStatus(403);
    return res.sendStatus(204);
  }
  next();
});

app.use(rateLimit({ max: config.rateLimitPerMin }));

app.use(healthRouter); // public
app.use(authRouter); // POST /auth/login | /auth/logout, GET /auth/session
// Public liveness for the dashboard's connection indicator (no data).
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "caelia-motherboard-backend", time: new Date().toISOString() }));
app.get("/status", requireAuth); // status page now needs a session
app.use(statusRouter);
app.use("/api", requireAuth); // everything below is owner-only
app.use("/api", systemRouter);
app.use("/api", chatRouter);
app.use("/api", memoryRouter);
app.use("/api", tasksRouter);
app.use("/api", notesRouter);
app.use("/api", filesRouter);
app.use("/api", automationsRouter);
app.use("/api", analyticsRouter);
app.use("/api", enginesRouter);
app.use("/api", teachRouter);
app.use("/api", failsafeRouter);
app.use("/api", overrideRouter);
app.use("/api", agentsRouter);
app.use("/api", bridgeRouter);
app.use("/api", learningRouter);
app.use("/api", adminRouter);
app.use("/api", voiceRouter);
app.use("/api", auditRouter);
app.use("/api", vaultRouter);
app.use("/api", discordRouter);

app.use(notFound);
app.use(errorHandler);

startScheduler();

// Discord bot boots in the background and degrades gracefully:
// no token -> DISCORD_NEEDS_TOKEN, bad token -> login_failed, everything
// else keeps running. It never blocks the server or crashes it.
initDiscord().then((s) => {
  const mark = s.status === "online" ? "✓" : "✗";
  console.log(`    discord ......... ${s.status} ${mark}`);
}).catch((e) => {
  console.log(`    discord ......... init error (non-fatal): ${String(e.message).slice(0, 120)}`);
});

app.listen(config.port, () => {
  const r = checkReadiness();
  const mark = (ok) => (ok ? "✓" : "✗");
  console.log(`
  ◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈
    CAELIA MOTHERBOARD BACKEND — owner: Alicia
  ◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈
    port ............ :${config.port}
    status page ..... /status        (owner session)
    health .......... /health        (public)
    api ............. /api/*         (owner Bearer token)
    engine .......... QuantVantage ${r.live ? "LIVE ✓" : "bundled, needs setup"}
  ┌ What Caelia needs to function ──────────────
${r.checks.map((c) => `  │  ${mark(c.present)} ${c.name}`).join("\n")}
  └─────────────────────────────────────────────
  `);
});
