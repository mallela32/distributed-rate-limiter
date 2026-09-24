export const checkAndConsumeToken = (state, config) => {
  const currentTime = Date.now();
  const elapsedTime = (currentTime - state.lastRefillDate) / 1000;
  const refillRate = config.limit / config.windowSec;
  const newTokens = state.tokens + elapsedTime * refillRate;
  const clampedTokens = Math.min(newTokens, config.limit);
  const tokensRequired = 1;

  if (clampedTokens >= tokensRequired) {
    return {
      allowed: true,
      tokensLeft: clampedTokens - tokensRequired,
      lastRefillDate: currentTime,
      retryAfter: null,
    };
  } else {
    return {
      allowed: false,
      retryAfter: Math.ceil((1 - clampedTokens) / refillRate),
      tokensLeft: state.tokens,
      lastRefillDate: state.lastRefillDate,
    };
  }
};
