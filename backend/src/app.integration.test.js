import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createRateLimiterClient } from "./rateLimiterClient.js";
import { createRateLimitMiddleware } from "./middleware/rateLimit.js";

const limiterDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../rate-limiter-backend",
);

const testBase = "/__integration-test__";
const testEndpoint = `${testBase}/ping`;
const testUser = "backend-integration-user";

let limiter;
let limiterUrl;
let servers = [];

const freePort = () =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const startLimiter = (port) =>
  new Promise((resolve, reject) => {
    limiter = spawn(process.execPath, ["index.js"], {
      cwd: limiterDir,
      env: { ...process.env, PORT: String(port) },
    });
    const timer = setTimeout(
      () => reject(new Error("rate limiter did not start")),
      8000,
    );
    limiter.once("error", reject);
    limiter.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Server is running")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

const startBackend = async ({ baseUrl, failMode }) => {
  const client = createRateLimiterClient({ baseUrl, timeoutMs: 500 });
  const app = express();
  const router = express.Router();
  router.use(createRateLimitMiddleware({ check: client.checkRateLimit, failMode }));
  router.get("/ping", (req, res) => res.json({ ok: true }));
  app.use(testBase, router);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  return `http://localhost:${server.address().port}`;
};

const redisDel = (...keys) =>
  new Promise((resolve) => {
    execFile("redis-cli", ["del", ...keys], () => resolve());
  });

before(async () => {
  const port = await freePort();
  limiterUrl = `http://localhost:${port}`;
  await startLimiter(port);
});

after(async () => {
  servers.forEach((s) => s.close());
  if (limiter) limiter.kill();
  await redisDel(
    `rl:config:${testEndpoint}`,
    `rl:state:${testUser}:${testEndpoint}`,
    `rl:metrics:${testEndpoint}`,
  );
});

test("a rule on the real limiter turns the third request into a 429", async () => {
  const settings = await fetch(`${limiterUrl}/rate-limiter/update-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: testEndpoint, new_limit: 2, window_sec: 60 }),
  });
  assert.equal(settings.status, 200);

  const backendUrl = await startBackend({ baseUrl: limiterUrl, failMode: "open" });
  const hit = () =>
    fetch(`${backendUrl}${testEndpoint}`, { headers: { "X-User-Id": testUser } });

  const first = await hit();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-ratelimit-limit"), "2");
  assert.equal(first.headers.get("x-ratelimit-remaining"), "1");

  assert.equal((await hit()).status, 200);

  const third = await hit();
  assert.equal(third.status, 429);
  assert.ok(Number(third.headers.get("retry-after")) > 0);
  const body = await third.json();
  assert.equal(body.error, "rate limit exceeded");
});

test("a different caller has its own bucket", async () => {
  const backendUrl = await startBackend({ baseUrl: limiterUrl, failMode: "open" });
  const res = await fetch(`${backendUrl}${testEndpoint}`, {
    headers: { "X-User-Id": `${testUser}-other` },
  });
  assert.equal(res.status, 200);
  await redisDel(`rl:state:${testUser}-other:${testEndpoint}`);
});

test("with the limiter unreachable, fail-open serves and fail-closed returns 503", async () => {
  const deadUrl = `http://localhost:${await freePort()}`;

  const openUrl = await startBackend({ baseUrl: deadUrl, failMode: "open" });
  const open = await fetch(`${openUrl}${testEndpoint}`);
  assert.equal(open.status, 200);

  const closedUrl = await startBackend({ baseUrl: deadUrl, failMode: "closed" });
  const closed = await fetch(`${closedUrl}${testEndpoint}`);
  assert.equal(closed.status, 503);
});

test("app.js responses carry CORS headers and preflight succeeds", async () => {
  const { default: app } = await import("./app.js");
  const server = app.listen(0);
  servers.push(server);
  const baseUrl = `http://localhost:${server.address().port}`;

  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.ok(res.headers.get("access-control-expose-headers").includes("Retry-After"));

  const preflight = await fetch(`${baseUrl}/api/login`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
});
