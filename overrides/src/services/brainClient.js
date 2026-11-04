// Caelia Brain client — the one place the backend talks to the brain service.
// Brain service: caeliasystems-brain (Railway). Its owner-only API lives under /api/brain/*.
//   CAELIA_BRAIN_URL   = the brain's public or private Railway URL (no trailing /api)
//   CAELIA_BRAIN_TOKEN = the brain service's OWNER_TOKEN (server-side only, never in the browser)
import { config } from "../config.js";

const TIMEOUT_MS = Number(process.env.CAELIA_BRAIN_TIMEOUT_MS || 75000);

function base() {
  return String(config.caeliaBrainUrl || process.env.CAELIA_BRAIN_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
}
function token() {
  return String(process.env.CAELIA_BRAIN_TOKEN || "").trim();
}

export function brainConfigured() {
  return { url: !!base(), token: !!token() };
}

async function call(path, { method = "GET", body, auth = true } = {}) {
  const url = base();
  if (!url) return { ok: false, status: 0, error: "BRAIN_URL_NOT_SET" };
  if (auth && !token()) return { ok: false, status: 0, error: "BRAIN_TOKEN_NOT_SET" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = { "content-type": "application/json" };
    if (auth) headers.authorization = "Bearer " + token();
    const r = await fetch(url + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: data.error || `BRAIN_HTTP_${r.status}`, data };
    return { ok: true, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === "AbortError" ? "BRAIN_TIMEOUT" : "BRAIN_UNREACHABLE", note: String(e.message).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

// Pull spoken text out of a brain result if the brain produced any.
// The brain is honest: until a reasoning model is attached (MODEL_HOOK) it returns
// no words, and we never invent words on her behalf.
export function replyText(result) {
  if (!result || typeof result !== "object") return null;
  const candidates = [
    result.reply, result.text, result.response, result.answer,
    result.loop?.reply, result.loop?.reasoning?.reply, result.loop?.reasoning?.text,
  ];
  const hit = candidates.find((v) => typeof v === "string" && v.trim());
  return hit ? hit.trim() : null;
}

export function reasoningMode(result) {
  return result?.loop?.reasoning?.mode || null;
}

export function brainHealth() {
  return call("/api/health", { auth: false });
}
export function brainThink(input, source = "motherboard") {
  return call("/api/brain/think", { method: "POST", body: { input, source } });
}
export function brainTeach(directive, source = "Alicia") {
  return call("/api/brain/teach", { method: "POST", body: { directive, source } });
}
