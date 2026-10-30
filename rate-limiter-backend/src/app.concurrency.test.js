import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "./app.js";
import { redisClient } from "../config/redisConnection.js";

let server;
let baseUrl;

const testEndpoint = "/__concurrency-test__";
const testUser = "concurrency-test-user";
const limit = 20;
// Window is long enough that no refill happens while the burst runs.
const windowSec = 3600;
const burstSize = 150;

before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

after(async () => {
  await redisClient.del(`rl:state:${testUser}:${testEndpoint}`);
  await redisClient.del(`rl:config:${testEndpoint}`);
  await redisClient.del(`rl:metrics:${testEndpoint}`);
  server.close();
  await redisClient.quit();
});

test("concurrent checks on the same key allow exactly `limit` requests", async () => {
  const settingsRes = await fetch(`${baseUrl}/rate-limiter/update-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: testEndpoint, new_limit: limit, window_sec: windowSec }),
  });
  assert.equal(settingsRes.status, 200);

  const check = () =>
    fetch(`${baseUrl}/rate-limiter/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: testUser, endpoint: testEndpoint }),
    });

  const responses = await Promise.all(Array.from({ length: burstSize }, check));
  const bodies = await Promise.all(responses.map((res) => res.json()));

  const allowed = bodies.filter((body) => body.allowed === true);
  const denied = bodies.filter((body) => body.allowed === false);

  assert.equal(allowed.length, limit);
  assert.equal(denied.length, burstSize - limit);
  for (const body of bodies) {
    assert.ok(body.tokens_left >= 0, `tokens_left went negative: ${body.tokens_left}`);
  }

  const state = await redisClient.hGetAll(`rl:state:${testUser}:${testEndpoint}`);
  assert.ok(Number(state.tokens) >= 0, `stored token count went negative: ${state.tokens}`);
});
