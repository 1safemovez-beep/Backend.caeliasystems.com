// Audit middleware: every mutating request (POST/PATCH/PUT/DELETE) is logged.
// This is the auditability Caelia's protection framework requires.
import { run } from "../db/index.js";

export function audit(action, entity) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = (body) => {
      try {
        if (body && body.ok !== false) {
          run(
            "INSERT INTO audit_log (actor, action, entity, entity_id, detail_json) VALUES (?,?,?,?,?)",
            req.actor || "unknown",
            action,
            entity,
            String(body.id ?? req.params.id ?? ""),
            JSON.stringify({ method: req.method, path: req.path }).slice(0, 2000)
          );
        }
      } catch { /* audit must never break the request */ }
      return origJson(body);
    };
    next();
  };
}

export function auditLog(entity, entityId, action, detail = {}) {
  run(
    "INSERT INTO audit_log (actor, action, entity, entity_id, detail_json) VALUES (?,?,?,?,?)",
    "alicia",
    action,
    entity,
    String(entityId ?? ""),
    JSON.stringify(detail).slice(0, 2000)
  );
}
