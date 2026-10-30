import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { redisClient } from "../../config/redisConnection.js";

const DEFAULT_CONFIG = { limit: 10, windowSec: 60 };

const stateKey = (userId, endpoint) => `rl:state:${userId}:${endpoint}`;
const configKey = (endpoint) => `rl:config:${endpoint}`;
const metricsKey = (endpoint) => `rl:metrics:${endpoint}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECK_AND_CONSUME_SCRIPT = readFileSync(
  path.join(__dirname, "checkAndConsume.lua"),
  "utf8"
);

// Loaded once at startup; cached by SHA so each /check call is a single
// EVALSHA round trip instead of shipping the script body every time.
let checkAndConsumeSha = await redisClient.scriptLoad(CHECK_AND_CONSUME_SCRIPT);

export const setConfig = async (endpoint, config) => {
  await redisClient.hSet(configKey(endpoint), {
    limit: config.limit,
    windowSec: config.windowSec,
  });
};

// Runs the whole read-refill-decide-write sequence as one atomic Lua
// script, so two concurrent requests on the same key can't both read the
// same tokens and both be allowed.
export const checkAndConsume = async (userId, endpoint) => {
  const keys = [stateKey(userId, endpoint), configKey(endpoint)];
  const args = [String(DEFAULT_CONFIG.limit), String(DEFAULT_CONFIG.windowSec)];

  let reply;
  try {
    reply = await redisClient.evalSha(checkAndConsumeSha, { keys, arguments: args });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NOSCRIPT")) {
      checkAndConsumeSha = await redisClient.scriptLoad(CHECK_AND_CONSUME_SCRIPT);
      reply = await redisClient.eval(CHECK_AND_CONSUME_SCRIPT, { keys, arguments: args });
    } else {
      throw err;
    }
  }

  const [allowedFlag, tokensLeftRaw, retryAfterRaw, limitRaw, windowSecRaw] = reply;
  return {
    allowed: Number(allowedFlag) === 1,
    tokensLeft: Number(tokensLeftRaw),
    retryAfter: retryAfterRaw === "" ? null : Number(retryAfterRaw),
    limit: Number(limitRaw),
    windowSec: Number(windowSecRaw),
  };
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
