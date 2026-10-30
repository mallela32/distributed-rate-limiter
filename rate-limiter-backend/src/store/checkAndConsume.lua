-- Atomic check-and-consume for the token bucket algorithm.
-- Mirrors utils/checkAndConsumeToken.js; kept in sync by hand.
--
-- KEYS[1] = state key   (rl:state:<user>:<endpoint>, hash: tokens, lastRefillDate)
-- KEYS[2] = config key  (rl:config:<endpoint>, hash: limit, windowSec)
-- ARGV[1] = default limit
-- ARGV[2] = default windowSec

local stateKey = KEYS[1]
local configKey = KEYS[2]
local defaultLimit = tonumber(ARGV[1])
local defaultWindowSec = tonumber(ARGV[2])

local configRaw = redis.call("HMGET", configKey, "limit", "windowSec")
local limit = configRaw[1] and tonumber(configRaw[1]) or defaultLimit
local windowSec = configRaw[2] and tonumber(configRaw[2]) or defaultWindowSec
local refillRate = limit / windowSec

local timeParts = redis.call("TIME")
local now = tonumber(timeParts[1]) * 1000 + math.floor(tonumber(timeParts[2]) / 1000)

local stateRaw = redis.call("HMGET", stateKey, "tokens", "lastRefillDate")
local tokens
local lastRefillDate
if stateRaw[1] then
  tokens = tonumber(stateRaw[1])
  lastRefillDate = tonumber(stateRaw[2])
else
  tokens = limit
  lastRefillDate = now
end

local elapsedSec = (now - lastRefillDate) / 1000
local refilled = tokens + elapsedSec * refillRate
local clamped = math.min(refilled, limit)

local allowed
local tokensLeft
local retryAfter
-- Idle buckets are reclaimed after twice the time needed to refill from
-- empty, with a 60s floor, so they don't linger in Redis forever.
local ttlSec = math.max(60, math.ceil((limit / refillRate) * 2))

if clamped >= 1 then
  allowed = true
  tokensLeft = clamped - 1
  retryAfter = false
  redis.call("HSET", stateKey, "tokens", tostring(tokensLeft), "lastRefillDate", tostring(now))
  redis.call("EXPIRE", stateKey, ttlSec)
else
  allowed = false
  tokensLeft = tokens
  retryAfter = math.ceil((1 - clamped) / refillRate)
end

return {
  allowed and 1 or 0,
  tostring(tokensLeft),
  retryAfter and tostring(retryAfter) or "",
  tostring(limit),
  tostring(windowSec),
}
