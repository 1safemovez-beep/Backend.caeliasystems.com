// Small in-memory fixed-window limiter (single replica). Keyed by client IP.
export function rateLimit({ windowMs = 60_000, max = 240, name = "api" } = {}) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip}`;
    let h = hits.get(key);
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    h.n += 1;
    if (h.n > max) {
      res.setHeader("retry-after", String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ ok: false, error: "RATE_LIMITED" });
    }
    next();
  };
}
