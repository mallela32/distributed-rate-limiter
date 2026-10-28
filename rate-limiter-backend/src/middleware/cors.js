const ALLOWED_HEADERS = "Content-Type, X-User-Id";
const EXPOSED_HEADERS =
  "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After";

export const cors = (req, res, next) => {
  const origin = process.env.CORS_ORIGIN || "http://localhost:5173";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.set("Access-Control-Expose-Headers", EXPOSED_HEADERS);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
};
