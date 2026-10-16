const states = new Map();
const configs = new Map();

const DEFAULT_CONFIG = { limit: 10, windowSec: 60 };

const stateKey = (userId, endpoint) => `${userId}:${endpoint}`;

export const getConfig = (endpoint) => configs.get(endpoint) || DEFAULT_CONFIG;

export const setConfig = (endpoint, config) => {
  configs.set(endpoint, config);
};

export const getState = (userId, endpoint, config) => {
  const key = stateKey(userId, endpoint);
  if (!states.has(key)) {
    states.set(key, { tokens: config.limit, lastRefillDate: Date.now() });
  }
  return states.get(key);
};

export const setState = (userId, endpoint, state) => {
  states.set(stateKey(userId, endpoint), state);
};
