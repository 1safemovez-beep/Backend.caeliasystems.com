// Server-side client for Caelia's Brain. The Brain's owner credential
// (CAELIA_BRAIN_TOKEN) lives only in this process's environment.
import { config } from "../config.js";

const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

async function call(path, { method = "GET", body } = {}) {
  if (!config.caeliaBrainUrl) return fail("BRAIN_NOT_CONFIGURED");
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (config.brainToken) headers.authorization = `Bearer ${config.brainToken}`;
  const started = Date.now();
  try {
    const r = await fetch(config.caeliaBrainUrl.replace(/\/+$/, "") + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(config.brainTimeoutMs),
    });
    const data = await r.json().catch(() => ({}));
    const ms = Date.now() - started;
    if (r.status === 401 || r.status === 403) return fail("BRAIN_AUTH_REJECTED", { upstreamStatus: r.status, ms });
    if (!r.ok) return fail("BRAIN_UPSTREAM_ERROR", { upstreamStatus: r.status, ms });
    return { ok: true, data, ms, upstreamStatus: r.status };
  } catch (e) {
    return fail(e.name === "TimeoutError" ? "BRAIN_TIMEOUT" : "BRAIN_UNREACHABLE", { detail: e.cause?.code || e.name });
  }
}

export const brainClient = {
  health: () => call(config.brainHealthPath),
  chat: (message) => call(config.brainChatPath, { method: "POST", body: { message } }),
};
