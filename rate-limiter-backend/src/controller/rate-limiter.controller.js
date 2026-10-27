import { checkAndConsumeToken } from "../utils/checkAndConsumeToken.js";
import { logger } from "../utils/logger.js";
import {
  getConfig,
  setConfig,
  getState,
  setState,
  listConfigs,
  deleteConfig,
  incrementMetric,
  listMetrics,
} from "../store/rateLimitStore.js";

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

const isPositiveNumber = (value) => typeof value === "number" && value > 0;

export const checkController = async (req, res) => {
  const { user_id, endpoint } = req.body ?? {};
  if (!isNonEmptyString(user_id) || !isNonEmptyString(endpoint)) {
    return res
      .status(400)
      .json({ error: "user_id and endpoint are required strings" });
  }

  const config = await getConfig(endpoint);
  const state = await getState(user_id, endpoint, config);
  const result = checkAndConsumeToken(state, config);

  // A denial leaves the stored state untouched, so only persist on success.
  if (result.allowed) {
    await setState(user_id, endpoint, {
      tokens: result.tokensLeft,
      lastRefillDate: result.lastRefillDate,
    });
  }
  await incrementMetric(endpoint, result.allowed ? "allowed" : "denied");
  logger.info("check", { user_id, endpoint, allowed: result.allowed });

  const tokensLeft = Math.floor(result.tokensLeft);
  const refillRate = config.limit / config.windowSec;
  const secondsUntilFull = (config.limit - result.tokensLeft) / refillRate;

  res.set({
    "X-RateLimit-Limit": String(config.limit),
    "X-RateLimit-Remaining": String(tokensLeft),
    "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000 + secondsUntilFull)),
  });
  if (!result.allowed) {
    res.set("Retry-After", String(result.retryAfter));
  }

  res.status(result.allowed ? 200 : 429).json({
    allowed: result.allowed,
    retry_after: result.retryAfter,
    tokens_left: tokensLeft,
  });
};

export const updateSettings = async (req, res) => {
  const { endpoint, new_limit, window_sec } = req.body ?? {};
  if (
    !isNonEmptyString(endpoint) ||
    !isPositiveNumber(new_limit) ||
    !isPositiveNumber(window_sec)
  ) {
    return res.status(400).json({
      error: "endpoint, new_limit and window_sec are required",
    });
  }
  await setConfig(endpoint, { limit: new_limit, windowSec: window_sec });
  res.json({ message: "settings updated successfully" });
};

export const listRules = async (req, res) => {
  const rules = await listConfigs();
  res.json({ rules });
};

export const deleteRule = async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!isNonEmptyString(endpoint)) {
    return res.status(400).json({ error: "endpoint is required" });
  }
  await deleteConfig(endpoint);
  res.json({ message: "rule deleted" });
};

export const getMetrics = async (req, res) => {
  const metrics = await listMetrics();
  res.json({ metrics });
};
