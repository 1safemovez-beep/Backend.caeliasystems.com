// SQLite connection (node:sqlite — built into Node 22.5+, no native build step).
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { CONTAINERS } from "../vault/safe.js";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.cwd(), config.dbPath);
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

export function migrate() {
  const schema = readFileSync(resolve(here, "schema.sql"), "utf8");
  db.exec(schema);
  seed();
}

function seed() {
  // Idempotent seed: only inserts when tables are empty.
  const has = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n > 0;
  if (!has("engines")) {
    const ins = db.prepare("INSERT INTO engines (name,type,mode,status) VALUES (?,?,?,?)");
    ins.run("personal-commercial", "evaluation", "personal", "registered");
    ins.run("qv-pro", "evaluation", "commercial", "registered");
  }
  if (!has("agents")) {
    const ins = db.prepare("INSERT INTO agents (name,role,status) VALUES (?,?,?)");
    ins.run("fawn", "Builder agent — design", "registered");
    ins.run("nova", "Mall AI host", "registered");
  }
  if (!has("satellites")) {
    const ins = db.prepare("INSERT INTO satellites (name,url,slot) VALUES (?,?,?)");
    ins.run("QuantVantage AI Pro", "https://quantvantageai.com", 1);
    ins.run("Art AI Studio", "https://alicias-art-ai-studio.com", 2);
    ins.run("Persona Mall", "", 3);
  }
  if (!has("automations")) {
    const ins = db.prepare("INSERT INTO automations (name,category,enabled) VALUES (?,?,?)");
    ins.run("Morning briefing", "work productivity", 1);
    ins.run("Revenue digest", "money handling", 0);
  }
  if (!existsSync(config.storageDir)) mkdirSync(config.storageDir, { recursive: true });
  if (!has("vault_containers")) {
    const ins = db.prepare("INSERT INTO vault_containers (name, kind, description) VALUES (?,?,?)");
    for (const c of CONTAINERS) ins.run(c.name, c.kind, c.description);
    // Seeded EMPTY — Alicia enters real secret values herself at deploy time.
  }
}

// Tiny row helpers
export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
