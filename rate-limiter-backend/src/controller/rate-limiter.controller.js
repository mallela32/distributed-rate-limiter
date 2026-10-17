import { checkAndConsumeToken } from "../utils/checkAndConsumeToken.js";
import {
  getConfig,
  setConfig,
  getState,
  setState,
} from "../store/rateLimitStore.js";

export const checkController = async (req, res) => {
  const { user_id, endpoint } = req.body;
  const config = await getConfig(endpoint);
  const state = await getState(user_id, endpoint, config);

  const result = checkAndConsumeToken(state, config);
  await setState(user_id, endpoint, {
    tokens: result.tokensLeft,
    lastRefillDate: result.lastRefillDate,
  });

  res.json({
    allowed: result.allowed,
    retry_after: result.retryAfter,
    tokens_left: result.tokensLeft,
  });
};

export const updateSettings = async (req, res) => {
  const { endpoint, new_limit, window_sec } = req.body;
  await setConfig(endpoint, { limit: new_limit, windowSec: window_sec });
  res.json({ message: "settings updated successfully" });
};
