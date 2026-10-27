import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAndConsumeToken } from "./checkAndConsumeToken.js";

const config = { limit: 5, windowSec: 10 };

test("allows a request when under the limit", () => {
  const state = { tokens: 3, lastRefillDate: Date.now() };
  const result = checkAndConsumeToken(state, config);
  assert.equal(result.allowed, true);
  assert.equal(result.tokensLeft, 2);
  assert.equal(result.retryAfter, null);
});

test("allows a request when exactly at one token", () => {
  const state = { tokens: 1, lastRefillDate: Date.now() };
  const result = checkAndConsumeToken(state, config);
  assert.equal(result.allowed, true);
  assert.equal(result.tokensLeft, 0);
});

test("denies a request when over the limit and leaves state untouched", () => {
  const state = { tokens: 0, lastRefillDate: Date.now() };
  const result = checkAndConsumeToken(state, config);
  assert.equal(result.allowed, false);
  assert.equal(result.tokensLeft, state.tokens);
  assert.equal(result.lastRefillDate, state.lastRefillDate);
  assert.ok(result.retryAfter > 0);
});

test("refills tokens lazily as time elapses, up to capacity", () => {
  const tenSecondsAgo = Date.now() - 10_000;
  const state = { tokens: 0, lastRefillDate: tenSecondsAgo };
  const result = checkAndConsumeToken(state, config);
  // 10s elapsed at 0.5 tokens/sec = 5 tokens refilled, clamped to the
  // 5-token capacity, minus the 1 consumed by this request.
  assert.equal(result.allowed, true);
  assert.equal(result.tokensLeft, 4);
});

test("does not refill past the bucket capacity", () => {
  const anHourAgo = Date.now() - 60 * 60 * 1000;
  const state = { tokens: 0, lastRefillDate: anHourAgo };
  const result = checkAndConsumeToken(state, config);
  assert.equal(result.allowed, true);
  assert.equal(result.tokensLeft, config.limit - 1);
});

test("independent keys do not affect each other", () => {
  const now = Date.now();
  const stateA = { tokens: 0, lastRefillDate: now };
  const stateB = { tokens: 5, lastRefillDate: now };

  const resultA = checkAndConsumeToken(stateA, config);
  const resultB = checkAndConsumeToken(stateB, config);

  assert.equal(resultA.allowed, false);
  assert.equal(resultB.allowed, true);
  assert.equal(resultB.tokensLeft, 4);
});
