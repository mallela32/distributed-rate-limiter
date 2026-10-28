import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRateLimiterClient } from "./rateLimiterClient.js";

let server;
let baseUrl;
let handler;

before(async () => {
  server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

const reply = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

test("maps an allowed response and its headers", async () => {
  let received;
  handler = (req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      received = { url: req.url, body: JSON.parse(raw) };
      reply(
        res,
        200,
        { allowed: true, retry_after: null, tokens_left: 4 },
        { "X-RateLimit-Limit": "5", "X-RateLimit-Remaining": "4" },
      );
    });
  };
  const client = createRateLimiterClient({ baseUrl, timeoutMs: 500 });

  const result = await client.checkRateLimit({ userId: "u1", endpoint: "/api/login" });

  assert.equal(received.url, "/rate-limiter/check");
  assert.deepEqual(received.body, { user_id: "u1", endpoint: "/api/login" });
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfter, null);
  assert.equal(result.tokensLeft, 4);
  assert.equal(result.headers["X-RateLimit-Limit"], "5");
});

test("treats a 429 as a normal denied result", async () => {
  handler = (req, res) =>
    reply(res, 429, { allowed: false, retry_after: 9, tokens_left: 0 });
  const client = createRateLimiterClient({ baseUrl, timeoutMs: 500 });

  const result = await client.checkRateLimit({ userId: "u1", endpoint: "/api/login" });

  assert.equal(result.allowed, false);
  assert.equal(result.retryAfter, 9);
});

test("throws when the limiter returns a server error", async () => {
  handler = (req, res) => reply(res, 500, { error: "boom" });
  const client = createRateLimiterClient({ baseUrl, timeoutMs: 500 });

  await assert.rejects(
    client.checkRateLimit({ userId: "u1", endpoint: "/api/login" }),
    /status 500/,
  );
});

test("throws when the limiter is too slow", async () => {
  handler = (req, res) => {
    setTimeout(() => reply(res, 200, { allowed: true }), 400);
  };
  const client = createRateLimiterClient({ baseUrl, timeoutMs: 50 });

  await assert.rejects(
    client.checkRateLimit({ userId: "u1", endpoint: "/api/login" }),
  );
});

test("throws when the limiter is unreachable", async () => {
  const client = createRateLimiterClient({
    baseUrl: "http://localhost:1",
    timeoutMs: 500,
  });

  await assert.rejects(
    client.checkRateLimit({ userId: "u1", endpoint: "/api/login" }),
  );
});
