import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "./app.js";
import { redisClient } from "../config/redisConnection.js";

let server;
let baseUrl;

const testEndpoint = "/__integration-test__";
const testUser = "integration-test-user";

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

test("update-settings then check respects the new limit", async () => {
  const settingsRes = await fetch(`${baseUrl}/rate-limiter/update-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: testEndpoint, new_limit: 2, window_sec: 60 }),
  });
  assert.equal(settingsRes.status, 200);

  const check = async () =>
    fetch(`${baseUrl}/rate-limiter/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: testUser, endpoint: testEndpoint }),
    });

  const first = await check();
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.allowed, true);
  assert.equal(firstBody.tokens_left, 1);

  const second = await check();
  assert.equal(second.status, 200);

  const third = await check();
  assert.equal(third.status, 429);
  const thirdBody = await third.json();
  assert.equal(thirdBody.allowed, false);
  assert.ok(third.headers.get("retry-after"));
});

test("check rejects missing fields with 400", async () => {
  const res = await fetch(`${baseUrl}/rate-limiter/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: testUser }),
  });
  assert.equal(res.status, 400);
});

test("rules can be listed and deleted", async () => {
  const listRes = await fetch(`${baseUrl}/rate-limiter/rules`);
  const { rules } = await listRes.json();
  assert.ok(rules.some((rule) => rule.endpoint === testEndpoint));

  const deleteRes = await fetch(`${baseUrl}/rate-limiter/delete-rule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: testEndpoint }),
  });
  assert.equal(deleteRes.status, 200);

  const listAfter = await fetch(`${baseUrl}/rate-limiter/rules`);
  const { rules: rulesAfter } = await listAfter.json();
  assert.ok(!rulesAfter.some((rule) => rule.endpoint === testEndpoint));
});

test("metrics reflect allowed and denied checks", async () => {
  const res = await fetch(`${baseUrl}/rate-limiter/metrics`);
  const { metrics } = await res.json();
  const entry = metrics.find((metric) => metric.endpoint === testEndpoint);
  assert.ok(entry);
  assert.ok(entry.allowed >= 2);
  assert.ok(entry.denied >= 1);
});

test("responses carry CORS headers and preflight succeeds", async () => {
  const res = await fetch(`${baseUrl}/rate-limiter/rules`);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.ok(res.headers.get("access-control-expose-headers").includes("X-RateLimit-Remaining"));

  const preflight = await fetch(`${baseUrl}/rate-limiter/check`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
});
