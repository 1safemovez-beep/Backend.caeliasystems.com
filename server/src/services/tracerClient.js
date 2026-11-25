// Tracer probe. The Tracer's API contract has not been confirmed, so this only
// reports reachability of TRACER_URL (GET /health). No events are invented.
import { config } from "../config.js";

export async function tracerHealth() {
  if (!config.tracerUrl) return { ok: false, error: "TRACER_NOT_CONFIGURED" };
  const started = Date.now();
  try {
    const r = await fetch(config.tracerUrl.replace(/\/+$/, "") + "/health", {
      headers: config.tracerToken ? { authorization: `Bearer ${config.tracerToken}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    return r.ok ? { ok: true, ms: Date.now() - started } : { ok: false, error: "TRACER_UPSTREAM_ERROR", upstreamStatus: r.status };
  } catch (e) { return { ok: false, error: "TRACER_UNREACHABLE", detail: e.cause?.code || e.name }; }
}
