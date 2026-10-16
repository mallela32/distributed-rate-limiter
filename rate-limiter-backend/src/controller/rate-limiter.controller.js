import { checkAndConsumeToken } from "../utils/checkAndConsumeToken.js";
import {
  getConfig,
  setConfig,
  getState,
  setState,
} from "../store/rateLimitStore.js";

export const checkController = (req, res) => {
  const { user_id, endpoint } = req.body;
  const config = getConfig(endpoint);
  const state = getState(user_id, endpoint, config);

  const result = checkAndConsumeToken(state, config);
  setState(user_id, endpoint, {
    tokens: result.tokensLeft,
    lastRefillDate: result.lastRefillDate,
  });

  res.json({
    allowed: result.allowed,
    retry_after: result.retryAfter,
    tokens_left: result.tokensLeft,
  });
};

export const updateSettings = (req, res) => {
  const { endpoint, new_limit, window_sec } = req.body;
  setConfig(endpoint, { limit: new_limit, windowSec: window_sec });
  res.json({ message: "settings updated successfully" });
};
