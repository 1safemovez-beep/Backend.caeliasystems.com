-- Caelia Motherboard — SQLite schema
-- File-based, zero-config. Created automatically on first boot.
-- Protection rules baked in: core identity is NEVER a table here;
-- learning tables are separate from identity by design.

PRAGMA journal_mode = WAL;

-- Saved facts: Alicia's teaching (source='alicia') and sandboxed
-- experiential learning (source='experiential'). Core vs experiential
-- is a column, never a guess.
CREATE TABLE IF NOT EXISTS memory_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  source TEXT NOT NULL DEFAULT 'alicia' CHECK (source IN ('alicia','experiential')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Short-term / current-conversation context (key/value)
CREATE TABLE IF NOT EXISTS memory_context (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily session summaries
CREATE TABLE IF NOT EXISTS daily_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','complete')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  category TEXT DEFAULT 'For You',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- File metadata; bytes live in STORAGE_DIR, never in the DB
CREATE TABLE IF NOT EXISTS files_meta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL DEFAULT 'alicia',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'work productivity',
  enabled INTEGER NOT NULL DEFAULT 1,
  schedule TEXT DEFAULT '',
  last_run TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Engine registry (personal/commercial, QV Pro, future engines)
CREATE TABLE IF NOT EXISTS engines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'evaluation',
  mode TEXT DEFAULT 'personal',
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','ready','offline')),
  config_json TEXT DEFAULT '{}'
);

-- Agent registry (Fawn, Nova, future agents)
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'registered'
);

-- Satellites: connected apps/tools (bridge slots)
CREATE TABLE IF NOT EXISTS satellites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  url TEXT DEFAULT '',
  slot INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sensory bridge: heartbeats pushed by satellites (Worth/Status/Revenue + metrics)
CREATE TABLE IF NOT EXISTS bridge_heartbeats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  satellite_id INTEGER REFERENCES satellites(id),
  worth TEXT DEFAULT '',
  status TEXT DEFAULT '',
  revenue TEXT DEFAULT '',
  metrics_json TEXT DEFAULT '{}',
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Action bridge: dispatched actions (vault_ref is a NAME, never a secret)
CREATE TABLE IF NOT EXISTS bridge_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  satellite_id INTEGER REFERENCES satellites(id),
  action TEXT NOT NULL,
  params_json TEXT DEFAULT '{}',
  vault_ref TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  result_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Delegation switchboard: tasks bridged to Fawn/Nova
CREATE TABLE IF NOT EXISTS delegations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  task_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delegated' CHECK (status IN ('delegated','in_progress','complete','failed')),
  progress_json TEXT DEFAULT '{}',
  result_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Teaching intake pipeline: Information -> Process -> Verify -> Relevance -> Permission -> Retention
CREATE TABLE IF NOT EXISTS teach_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  directive TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'alicia' CHECK (source IN ('alicia')),
  stage TEXT NOT NULL DEFAULT 'information' CHECK (stage IN ('information','process','verify','relevance','permission','retention','held')),
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

-- Crisis failsafe channel: priority prompts, bypass normal queue
CREATE TABLE IF NOT EXISTS failsafe_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Command override: cancel/replace bad public commands
CREATE TABLE IF NOT EXISTS overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('cancel','replace')),
  replacement TEXT DEFAULT '',
  by_actor TEXT NOT NULL DEFAULT 'alicia',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hidden admin: money matters
CREATE TABLE IF NOT EXISTS money_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  due_date TEXT DEFAULT '',
  paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS money_revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hidden admin: soul/ethics lessons (Alicia's teaching only — never outside ideology)
CREATE TABLE IF NOT EXISTS soul_lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'alicia',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hidden admin: private discussions
CREATE TABLE IF NOT EXISTS private_discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  body TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hidden admin: role/representation control
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  directives_json TEXT DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hidden admin: Tom's secret box + token safe + safe folder are METADATA ONLY.
-- Contents never live in code or the DB. Names only, never values.
CREATE TABLE IF NOT EXISTS vault_meta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  box TEXT NOT NULL CHECK (box IN ('toms_box','token_safe','safe_folder')),
  name TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log: EVERY mutating action lands here (who, what, when).
-- This is the auditability Caelia's protection framework requires.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT DEFAULT '',
  detail_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_heartbeat_sat ON bridge_heartbeats(satellite_id, received_at);

-- Backend Safe: encrypted secret vault (AES-256-GCM, key from VAULT_MASTER_KEY).
-- Values are encrypted at rest; list endpoints return NAMES ONLY.
CREATE TABLE IF NOT EXISTS vault_containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard','toms_box')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS vault_secrets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id INTEGER NOT NULL REFERENCES vault_containers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at TEXT,
  UNIQUE(container_id, name)
);
CREATE INDEX IF NOT EXISTS idx_vault_secrets_container ON vault_secrets(container_id);
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engine TEXT NOT NULL,
  target_name TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'commercial',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed','needs_key')),
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
