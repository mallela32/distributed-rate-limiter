export const config = {
  port: process.env.PORT || 3001,
  rateLimiterUrl: process.env.RATE_LIMITER_URL || "http://localhost:4000",
  rateLimiterTimeoutMs: Number(process.env.RATE_LIMITER_TIMEOUT_MS) || 500,
  // "open" lets requests through when the limiter is down, "closed" rejects them.
  rateLimiterFailMode:
    process.env.RATE_LIMITER_FAIL_MODE === "closed" ? "closed" : "open",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
