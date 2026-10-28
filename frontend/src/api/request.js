// Shared fetch wrapper used by both API clients. Normalizes network failures
// (service down, CORS blocked) into the same shape as a parsed response, so
// callers only need one branch to handle "something went wrong".

const parseRateLimitHeaders = (headers) => {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const retryAfter = headers.get("retry-after");
  return {
    limit: limit != null ? Number(limit) : null,
    remaining: remaining != null ? Number(remaining) : null,
    reset: reset != null ? Number(reset) : null,
    retryAfter: retryAfter != null ? Number(retryAfter) : null,
  };
};

export const requestJson = async (url, options = {}) => {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    return {
      ok: false,
      networkError: true,
      status: null,
      data: null,
      rateLimit: parseRateLimitHeaders(new Headers()),
    };
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return {
    ok: res.ok,
    networkError: false,
    status: res.status,
    data,
    rateLimit: parseRateLimitHeaders(res.headers),
  };
};
