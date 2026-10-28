export const createRateLimiterClient = ({ baseUrl, timeoutMs }) => {
  const checkRateLimit = async ({ userId, endpoint }) => {
    const res = await fetch(`${baseUrl}/rate-limiter/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, endpoint }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    // 200 means allowed and 429 means denied. Anything else is the limiter failing.
    if (res.status !== 200 && res.status !== 429) {
      throw new Error(`rate limiter responded with status ${res.status}`);
    }

    const body = await res.json();
    return {
      allowed: body.allowed,
      retryAfter: body.retry_after,
      tokensLeft: body.tokens_left,
      headers: {
        "X-RateLimit-Limit": res.headers.get("x-ratelimit-limit"),
        "X-RateLimit-Remaining": res.headers.get("x-ratelimit-remaining"),
        "X-RateLimit-Reset": res.headers.get("x-ratelimit-reset"),
      },
    };
  };

  return { checkRateLimit };
};
