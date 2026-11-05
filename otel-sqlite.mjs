// OpenTelemetry CLIENT spans for node:sqlite, which no instrumentation package covers.
// Loaded with --import next to the auto-instrumentation register module (see extract-and-start.sh).
import { DatabaseSync, StatementSync } from "node:sqlite";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("caelia-node-sqlite");

function traced(sql, operation, fn) {
  const op = operation || String(sql).trim().split(/\s+/)[0].toUpperCase() || "QUERY";
  return tracer.startActiveSpan(
    op,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system": "sqlite",
        "db.namespace": "main",
        "db.operation.name": op,
        "db.query.text": String(sql).slice(0, 1000),
      },
    },
    (span) => {
      try {
        return fn();
      } catch (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

for (const method of ["run", "get", "all"]) {
  const original = StatementSync.prototype[method];
  StatementSync.prototype[method] = function (...args) {
    return traced(this.sourceSQL, undefined, () => original.apply(this, args));
  };
}

const originalExec = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function (sql) {
  return traced(sql, "EXEC", () => originalExec.call(this, sql));
};
