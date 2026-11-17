// CORS for browser pages (Motherboard and others) that call the backend directly.
// DASHBOARD_ORIGIN may list several exact origins, comma-separated, e.g.
//   https://motherboard.caeliasystems.com,https://caeliasystems.com
// Browsers accept only ONE origin per response, so we answer with the caller's
// origin when it is on the list. Callers not on the list get no CORS header
// (the browser then blocks them). Server-to-server calls are unaffected.
const DEFAULT_ORIGIN = "https://motherboard.caeliasystems.com";

export function allowedOrigins(raw = process.env.DASHBOARD_ORIGIN) {
  const list = String(raw || DEFAULT_ORIGIN)
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, ""))
    .filter(Boolean);
  return list.length ? list : [DEFAULT_ORIGIN];
}

export function cors(req, res, next) {
  const list = allowedOrigins();
  const origin = String(req.headers.origin || "").replace(/\/+$/, "");
  let allow = null;
  if (list.includes("*")) allow = "*"; // dev convenience only — avoid in production
  else if (origin && list.includes(origin)) allow = origin;
  else if (!origin) allow = list[0]; // non-browser callers: same as before
  if (allow) res.setHeader("access-control-allow-origin", allow);
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
