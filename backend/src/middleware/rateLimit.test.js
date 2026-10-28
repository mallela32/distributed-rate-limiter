import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimitMiddleware } from "./rateLimit.js";

const makeReq = ({ userId, ip = "10.0.0.1", baseUrl = "/api", path = "/login" } = {}) => ({
  get: (name) => (name.toLowerCase() === "x-user-id" ? userId : undefined),
  ip,
  baseUrl,
  path,
});

const makeRes = () => {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.set = (name, value) => {
    res.headers[name] = value;
    return res;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const allowedResult = {
  allowed: true,
  retryAfter: null,
  tokensLeft: 4,
  headers: {
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": "4",
    "X-RateLimit-Reset": "1700000000",
  },
};

test("lets an allowed request through and sets rate limit headers", async () => {
  const middleware = createRateLimitMiddleware({
    check: async () => allowedResult,
    failMode: "open",
  });
  const res = makeRes();
  let nextCalled = false;

  await middleware(makeReq(), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.headers["X-RateLimit-Remaining"], "4");
  assert.equal(res.body, undefined);
});

test("rejects a denied request with 429 and Retry-After", async () => {
  const middleware = createRateLimitMiddleware({
    check: async () => ({
      allowed: false,
      retryAfter: 12,
      tokensLeft: 0,
      headers: { "X-RateLimit-Limit": "5", "X-RateLimit-Remaining": "0" },
    }),
    failMode: "open",
  });
  const res = makeRes();
  let nextCalled = false;

  await middleware(makeReq(), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "12");
  assert.deepEqual(res.body, { error: "rate limit exceeded", retry_after: 12 });
});

test("fails open when the limiter errors", async () => {
  const middleware = createRateLimitMiddleware({
    check: async () => {
      throw new Error("connection refused");
    },
    failMode: "open",
  });
  const res = makeRes();
  let nextCalled = false;

  await middleware(makeReq(), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, undefined);
});

test("fails closed with 503 when the limiter errors", async () => {
  const middleware = createRateLimitMiddleware({
    check: async () => {
      throw new Error("connection refused");
    },
    failMode: "closed",
  });
  const res = makeRes();
  let nextCalled = false;

  await middleware(makeReq(), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
});

test("identifies the caller by X-User-Id, falling back to the IP", async () => {
  const seen = [];
  const middleware = createRateLimitMiddleware({
    check: async (args) => {
      seen.push(args);
      return allowedResult;
    },
    failMode: "open",
  });

  await middleware(makeReq({ userId: "alice" }), makeRes(), () => {});
  await middleware(makeReq({ ip: "192.168.1.9" }), makeRes(), () => {});

  assert.equal(seen[0].userId, "alice");
  assert.equal(seen[1].userId, "192.168.1.9");
});

test("uses the full route path as the endpoint key", async () => {
  let seen;
  const middleware = createRateLimitMiddleware({
    check: async (args) => {
      seen = args;
      return allowedResult;
    },
    failMode: "open",
  });

  await middleware(makeReq({ baseUrl: "/api", path: "/products" }), makeRes(), () => {});

  assert.equal(seen.endpoint, "/api/products");
});
