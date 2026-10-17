import { redisClient } from "../../config/redisConnection.js";

const DEFAULT_CONFIG = { limit: 10, windowSec: 60 };

const stateKey = (userId, endpoint) => `rl:state:${userId}:${endpoint}`;
const configKey = (endpoint) => `rl:config:${endpoint}`;

// Naive Redis access: separate read/write round trips per call, so two
// concurrent requests on the same key can both read stale state. Known
// limitation, fixed later with an atomic Lua script (see README).

export const getConfig = async (endpoint) => {
  const config = await redisClient.hGetAll(configKey(endpoint));
  if (Object.keys(config).length === 0) {
    return DEFAULT_CONFIG;
  }
  return { limit: Number(config.limit), windowSec: Number(config.windowSec) };
};

export const setConfig = async (endpoint, config) => {
  await redisClient.hSet(configKey(endpoint), {
    limit: config.limit,
    windowSec: config.windowSec,
  });
};

export const getState = async (userId, endpoint, config) => {
  const key = stateKey(userId, endpoint);
  const state = await redisClient.hGetAll(key);
  if (Object.keys(state).length === 0) {
    const freshState = { tokens: config.limit, lastRefillDate: Date.now() };
    await redisClient.hSet(key, freshState);
    return freshState;
  }
  return {
    tokens: Number(state.tokens),
    lastRefillDate: Number(state.lastRefillDate),
  };
};

export const setState = async (userId, endpoint, state) => {
  await redisClient.hSet(stateKey(userId, endpoint), state);
};
