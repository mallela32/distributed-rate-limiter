import { config } from "../config.js";
import { createRateLimiterClient } from "../rateLimiterClient.js";

const identifyCaller = (req) => req.get("x-user-id") || req.ip;

export const createRateLimitMiddleware = ({ check, failMode }) => {
  return async (req, res, next) => {
    const endpoint = `${req.baseUrl}${req.path}`;

    let result;
    try {
      result = await check({ userId: identifyCaller(req), endpoint });
    } catch (err) {
      console.error("rate limiter unavailable:", err.message);
      if (failMode === "closed") {
        return res.status(503).json({ error: "rate limiter unavailable" });
      }
      return next();
    }

    for (const [name, value] of Object.entries(result.headers ?? {})) {
      if (value != null) res.set(name, value);
    }

    if (!result.allowed) {
      if (result.retryAfter != null) {
        res.set("Retry-After", String(result.retryAfter));
      }
      return res
        .status(429)
        .json({ error: "rate limit exceeded", retry_after: result.retryAfter });
    }

    next();
  };
};

const client = createRateLimiterClient({
  baseUrl: config.rateLimiterUrl,
  timeoutMs: config.rateLimiterTimeoutMs,
});

export const rateLimit = createRateLimitMiddleware({
  check: client.checkRateLimit,
  failMode: config.rateLimiterFailMode,
});
