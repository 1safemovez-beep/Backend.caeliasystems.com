# Caelia Motherboard — Backend

Server-side foundation for the QuantVantageAI / Caelia motherboard dashboard.
Built Oct 3, 2026 by AJ. **Alicia is the owner.**

This is the handoff package for Kallel's Caelia integration: the complete
backend + infrastructure. Kallel + Alicia then place Caelia (Brain, Core,
identity, directives, protected memory, permissions) into it.

## What it is

- **Server:** Node.js + Express (Node ≥ 22.5). Single entry `src/index.js`.
- **Database:** SQLite via `node:sqlite` (built in — no native build step).
  File-based, zero-config, travels inside the deployment.
- **Auth:** owner-only. `Authorization: Bearer <OWNER_TOKEN>` on every
  `/api/*` route. Only `/health` is public.
- **No secrets in code.** Placeholders + `.env.example` only. Alicia types
  real values at deploy time.

## Run locally

```bash
cd motherboard-backend-2026-10-03
cp .env.example .env
# set OWNER_TOKEN in .env to a long random string (Alicia's hands only)
./start.sh        # or: npm install && npm start
# For live AI evaluations (optional at dev time):
#   pip install -r src/engines/python/requirements.txt
#   and set ANTHROPIC_API_KEY in .env (Alicia's key, her hands only)
```

Server listens on `:8787` (or `$PORT`). Health check:

```bash
curl localhost:8787/health
curl localhost:8787/status   # dark-neon status page (public, non-sensitive)
```

Authenticated example (replace TOKEN):

```bash
curl -H "Authorization: Bearer TOKEN" localhost:8787/api/tasks
```

## API contract (implements the dashboard's BrainAPI)

| Dashboard BrainAPI | Backend endpoint |
|---|---|
| `chat(message)` | `POST /api/chat` → `{reply, actions}` (honest offline until Brain wired) |
| `teach(directive)` | `POST /api/teach` → teaching pipeline queue |
| `failsafe(prompt)` | `POST /api/failsafe` → priority channel, bypasses queue |
| `runEngine(id, params)` | `POST /api/engines/:id/run` |
| `speak(text)` | `POST /api/voice/speak` (browser speech until voice server) |

Plus the full motherboard surface:

- **Memory** — `GET/POST /api/memory/facts`, `DELETE /api/memory/facts/:id`,
  `GET/POST /api/memory/context`, `GET/POST /api/memory/summaries`
  (two-tier: `source=alicia` core vs `source=experiential` sandboxed)
- **Tasks** — `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`
- **Notes** — `GET/POST /api/notes`, `DELETE /api/notes/:id`
- **Files** — `GET/POST /api/files` (multipart upload → `storage/`), `GET /api/files/:id/download`
- **Automations** — `GET/POST /api/automations`, `POST /api/automations/:id/toggle|run`
- **Analytics** — `GET /api/analytics/overview|satellites|caelia`
- **Engines** — `GET /api/engines` (registry: `qv-pro` commercial, `personal-commercial`),
  `GET /api/engines/readiness` (**"What Caelia needs to function"** tracker —
  python3 / anthropic package / `ANTHROPIC_API_KEY` / `STRIPE_SECRETS_KEY`, names only),
  `POST /api/engines/evaluate` { target_name, context_notes?, ad_price_note?,
  commercial_price_note?, engine? } → `202 { job_id, poll }` (queued; poll the job URL),
  `GET /api/engines/evaluations` (recent jobs), `GET /api/engines/evaluations/:id`
  (job + result). Without `ANTHROPIC_API_KEY` the job completes as `needs_key`
  with an honest checklist — **nothing is faked**. The old hardcoded
  `evaluator_engine.py` (78/81/76/58 for every input) is deliberately NOT in the
  pipeline. Live path: bundled Python runner → Claude (claude-sonnet-4-5) with the
  production evaluation prompt → score extraction → verdict → markdown report,
  stored in the `evaluations` table.

### Caelia's evaluation contract (for Kallel's integration)

When Caelia is connected, she triggers evaluations exactly like any owner client:

```
POST /api/engines/evaluate            Authorization: Bearer <OWNER_TOKEN>
{ "target_name": "Premium Tool Bazaar",
  "context_notes": "…", "engine": "qv-pro" }      # or "personal-commercial"
→ 202 { "job_id": 7, "poll": "/api/engines/evaluations/7" }

GET /api/engines/evaluations/7
→ { "job": { "status": "complete",
             "result": { "scores": {...}, "verdict": "…",
                         "report_markdown": "…" } } }
```

Protection: evaluations are a *service* Caelia uses under Alicia's authority —
they never write to Core, memory tiers, or the vault. Every run is audit-logged.
- **Bridges (Spec 41)** —
  `POST /api/bridge/heartbeat` (sensory: Worth/Status/Revenue),
  `POST /api/bridge/action` (action: vault *reference* only, raw secrets rejected),
  `POST /api/bridge/delegate` (switchboard → Fawn/Nova)
- **Agents** — `GET /api/agents`, `POST /api/agents/:name/delegate`,
  `POST /api/agents/delegations/:id/progress|complete`
- **Learning** — `GET /api/learning/metrics` (core/experiential/ethics %)
- **Hidden admin** — `/api/admin/roles`, `/api/admin/money`, `/api/admin/soul`
  (Alicia's ethics teaching only), `/api/admin/discussions`, `/api/admin/vault`
  (Tom's box / token safe / safe folder — **metadata only, never values**)
- **Backend Safe (encrypted vault)** — real AES-256-GCM secret storage:
  `POST /api/vault/unlock`,
  `GET /api/vault/containers` (the 5 containers),
  `POST /api/vault/secrets` { container, name, value },
  `GET /api/vault/secrets?container=` (**names only, never values**),
  `GET /api/vault/secrets/:id` (single value — owner only, audited),
  `POST /api/vault/secrets/:id/rotate`, `DELETE /api/vault/secrets/:id`,
  plus dedicated `/api/vault/toms-box/secrets*` endpoints for Tom's box.
  Fails closed (503 `VAULT_LOCKED`) without `VAULT_MASTER_KEY`.
- **Audit** — `GET /api/audit` (who did what, when — every mutation is logged)

## What's stubbed for Kallel's integration

- `POST /api/chat` — returns honest `brainConnected:false` until `CAELIA_BRAIN_URL` is set.
- Engine `run` — LIVE via the bundled Python runner when `ANTHROPIC_API_KEY` is set
  (+ `anthropic` pip package). Without the key, jobs complete as `needs_key` with
  an honest checklist. `QV_ENGINE_URL` remains as the optional external-engine
  override for Kallel.
- Fawn/Nova `accept()` — delegation contract is real; runtimes attach in integration.
- Voice server — browser speech until the voice server attaches.
- Learning percentages — core % is live; experiential/ethics compute in integration.
- Discord voice STT/TTS — the bot joins/leaves voice (presence only); hook points
  `onVoiceAudio` / `speakInVoice` in `src/discord/voice.js` are stubbed for Kallel.

## Discord bot (interface, not the brain)

Discord is a **Server 2 interface** to Alicia's existing "caelia server" — it is
NOT Caelia's brain and it never touches Server 1 (Core/Soul/protected memory).

**What the bot does:** posts system alerts to the Operations channel; answers
Alicia-only commands (`!status`, `!evaluate <app>`, `!ask <question>`,
`!join-voice` / `!leave-voice`, `!help`) in Caelia Voice, Caelia Private,
AI/Agent Room, and her DMs; queues evaluations through the real engine job
queue. `!ask` forwards through the same honest chat contract — it never fakes
a Caelia reply while the brain is unwired.

**What the bot can NEVER do:** read the vault, write Core/Soul/memory, trigger
failsafe, delegate to agents beyond evaluation queueing, or change backend
config. Every denied attempt is audit-logged. Non-owner users get a polite
refusal.

**Setup (Alicia's hands only):**
1. Create the bot at [discord.com/developers](https://discord.com/developers) →
   New Application → Bot → copy the token. Keep her server's gaming identity —
   the bot joins it as-is.
2. Invite it with minimal scopes: `bot` + `applications.commands`, permissions:
   Send Messages, Read Message History, Connect + Speak (voice presence only).
   Invite URL: `https://discord.com/oauth2/authorize?client_id=<APP_ID>&permissions=3148800&scope=bot`
3. Enable **Developer Mode** (Discord Settings → Advanced), then right-click the
   server → Copy Server ID → `DISCORD_GUILD_ID`; right-click each channel →
   Copy Channel ID → the four `DISCORD_CHANNEL_*` values; right-click your own
   name → Copy User ID → `DISCORD_OWNER_ID`.
4. Store the token in the Backend Safe (never in `.env`, never in chat):
   `POST /api/vault/secrets` with
   `{ "container": "backend-credentials", "name": "discord-bot-token", "value": "<token>" }`.
5. Restart the backend. `GET /api/discord/status` shows `online`.

Without a stored token the bot reports `DISCORD_NEEDS_TOKEN` and everything
else keeps running. A rejected token reports `DISCORD_LOGIN_FAILED` without
crashing; rotate it via `POST /api/vault/secrets/:id/rotate`.

**Management API (owner only):** `GET /api/discord/status`,
`GET /api/discord/channels`, `POST /api/discord/send { channel, text }`
(channel = `ops` | `voice` | `private` | `agents` or a raw channel id).

## Protection boundaries (do not bypass)

- Teaching endpoints accept `source='alicia'` only; nothing writes core identity.
- Delegation never transfers unrestricted authority — scoped, logged, revocable.
- `/api/bridge/action` rejects raw secrets; only vault reference names.
- `/api/admin/vault` stores names only, never values (display metadata).
- The Backend Safe (`/api/vault/*`) stores AES-256-GCM-encrypted values;
  list endpoints return names only, reads/writes/rotates/deletes are audited,
  and the vault fails closed without `VAULT_MASTER_KEY`.
- The Discord bot is a Server 2 interface only: allow-listed to post ops
  alerts, respond to Alicia, and queue evaluations. Deny-listed from vault
  reads, Core/Soul/memory writes, failsafe triggers, and delegation.
  The bot token lives in the vault (`backend-credentials`/`discord-bot-token`)
  and is never logged, echoed, or returned by any endpoint.
- Every mutation writes to `audit_log`.

## Caelia domain routing

The backend is intended to run at `https://backend.caeliasystems.com`.
The Motherboard dashboard is canonical at `https://motherboard.caeliasystems.com`.
The apex domains `https://caeliasystems.com` and `https://www.caeliasystems.com` should be redirected to the Motherboard dashboard at the DNS/proxy layer (Cloudflare), while this backend also contains a defensive redirect for requests that reach it directly.

Required environment values:

```env
BACKEND_PUBLIC_URL=https://backend.caeliasystems.com
CANONICAL_DASHBOARD_URL=https://motherboard.caeliasystems.com
DASHBOARD_ORIGIN=https://motherboard.caeliasystems.com
```

Recommended Cloudflare DNS record:

- `backend` → the hostname provided by the always-on backend host (proxied through Cloudflare when supported).

Do not put `OWNER_TOKEN`, `VAULT_MASTER_KEY`, Anthropic keys, Stripe keys, Discord bot tokens, or other secrets into DNS, Git, `wrangler.toml`, or frontend code.

## Deploy

- **Always-on host (recommended):** `Dockerfile` included. Mount `.env` as a
  secret (never bake it into the image). Point the dashboard's
  `BrainAPI.endpoint` at `https://<host>/api` and set `connected:true`.
- **Cloudflare Workers:** see `wrangler.toml` — it's a sketch. The D1/R2/Hono
  port is Kallel's call during integration.

## Layout

```
src/
  index.js            entry point
  config.js           ENV config (no secrets in code)
  db/                 node:sqlite connection + schema.sql + seed
  middleware/         auth (owner token), audit (who/what/when), error
  routes/             health, chat, memory, tasks, notes, files, automations,
                      analytics, engines, teach, failsafe, override, agents,
                      bridge, learning, admin, voice, audit, vault, discord
  vault/              safe.js (AES-256-GCM Backend Safe, 5 containers incl. Tom's box)
  discord/            bot.js (discord.js client, token from vault), channels.js,
                      commands.js (Alicia-only: status/evaluate/ask/voice/help),
                      voice.js (presence join/leave; STT/TTS stubbed for Kallel),
                      permissions.js (allow/deny lists), alerts.js (ops channel)
  services/           memory, tasks, automations (+scheduler), analytics,
                      teach (pipeline), delegation
  agents/             fawn.js, nova.js (delegation contract stubs)
  engines/            quantvantage.js (real adapter: readiness + job queue +
                      child_process runner),
                      python/ (run_evaluation.py headless CLI, scoring.py,
                      requirements.txt — bundled QuantVantage evaluator)
data/                 SQLite file (created on boot)
storage/              uploaded file bytes
```

## Alicia supplies at deploy time

- `OWNER_TOKEN` — long random string, her hands only, never in chat.
- `VAULT_MASTER_KEY` — long random passphrase that unlocks the Backend Safe
  (the 5 vault containers + Tom's box). Without it the vault fails closed.
  Her hands only, never in chat, never committed. She enters the REAL secret
  values herself at deploy via `POST /api/vault/secrets` — the package ships
  with all containers EMPTY.
- `ANTHROPIC_API_KEY` — enables LIVE AI evaluations via the bundled runner.
  Without it the engine honestly reports `ENGINE_NEEDS_KEY`. Her hands only,
  never in chat, never committed. Also `pip install -r src/engines/python/requirements.txt`
  on the host for the `anthropic` package.
- `STRIPE_SECRETS_KEY` (optional) — only for paid report-unlock verification.
- `CAELIA_BRAIN_URL`, `QV_ENGINE_URL` — when Kallel's integration lands
  (`QV_ENGINE_URL` is now an optional external override; the bundled runner is the default).
- `CREDENTIAL_VAULT_REF` — a vault *name*, never a secret value.
- Discord: `DISCORD_OWNER_ID` (her Discord user ID), `DISCORD_GUILD_ID`, and the
  four `DISCORD_CHANNEL_*` IDs (see the Discord setup steps above). The bot
  token itself goes into the Backend Safe via `POST /api/vault/secrets`
  (`backend-credentials` / `discord-bot-token`) — never into `.env`.
