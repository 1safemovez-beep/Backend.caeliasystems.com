// Central error handler — consistent JSON, no stack leaks in production.
export function errorHandler(err, req, res, _next) {
  console.error("[motherboard] error:", err.message);
  res.status(err.status || 500).json({
    ok: false,
    error: err.code || "INTERNAL_ERROR",
    note: "Something went wrong on the motherboard backend.",
  });
}

export function notFound(req, res) {
  res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.path });
}
