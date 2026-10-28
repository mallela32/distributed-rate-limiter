export const config = {
  port: process.env.PORT || 3001,
  rateLimiterUrl: process.env.RATE_LIMITER_URL || "http://localhost:4000",
};
