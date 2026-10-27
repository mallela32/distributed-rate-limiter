import { redisClient } from "../../config/redisConnection.js";

const DEFAULT_CONFIG = { limit: 10, windowSec: 60 };

const stateKey = (userId, endpoint) => `rl:state:${userId}:${endpoint}`;
const configKey = (endpoint) => `rl:config:${endpoint}`;
const metricsKey = (endpoint) => `rl:metrics:${endpoint}`;

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

const scanKeys = async (pattern) => {
  const keys = [];
  for await (const batch of redisClient.scanIterator({ MATCH: pattern })) {
    keys.push(...batch);
  }
  return keys;
};

export const listConfigs = async () => {
  const keys = await scanKeys("rl:config:*");
  return Promise.all(
    keys.map(async (key) => {
      const endpoint = key.slice("rl:config:".length);
      const config = await redisClient.hGetAll(key);
      return { endpoint, limit: Number(config.limit), windowSec: Number(config.windowSec) };
    })
  );
};

export const deleteConfig = async (endpoint) => {
  await redisClient.del(configKey(endpoint));
};

export const incrementMetric = async (endpoint, field) => {
  await redisClient.hIncrBy(metricsKey(endpoint), field, 1);
};

export const listMetrics = async () => {
  const keys = await scanKeys("rl:metrics:*");
  return Promise.all(
    keys.map(async (key) => {
      const endpoint = key.slice("rl:metrics:".length);
      const data = await redisClient.hGetAll(key);
      return {
        endpoint,
        allowed: Number(data.allowed || 0),
        denied: Number(data.denied || 0),
      };
    })
  );
};
