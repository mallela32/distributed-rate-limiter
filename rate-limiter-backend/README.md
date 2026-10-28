# Rate Limiter Service

Standalone microservice that owns rate-limiting decisions for the
distributed-rate-limiter project. It exposes its own API — a `/check`
endpoint consumed by the App Backend for every rate-checked request, and
an admin API for managing rate-limit rules, called directly by the
frontend dashboard.

## Algorithm: Token Bucket

Each `(user_id, endpoint)` pair gets its own bucket. Tokens refill
continuously as time passes — there's no discrete window reset like a
fixed-window counter; the bucket is topped up lazily, based on elapsed
time since the last update, whenever it's next read. This allows short
bursts up to the bucket's capacity while still enforcing a steady average
rate, which is why it was chosen over a fixed-window counter (bursty but
resets unfairly at window boundaries) or a sliding-window log (more
accurate, but stores a timestamp per request instead of a single
counter).

## Core Entities

```js
RateLimitState = {
  userId,
  endpoint,
  tokens,          // current token count (float, refills lazily)
  lastRefillDate,  // ms timestamp of the last committed update
}

RateLimitConfig = {
  endpoint,
  limit,       // bucket capacity == max burst size
  windowSec,   // refill rate is derived: limit / windowSec tokens/sec
}
```

## Algorithm Interface

`checkAndConsumeToken(state, config)` — pure function, no I/O. Given the
current state and config, decides whether to allow one token's worth of
usage and, if allowed, consumes it.

```js
checkAndConsumeToken(state, config) -> {
  allowed,          // true/false
  tokensLeft,       // remaining tokens after this call
  retryAfter,        // seconds until a token will be available; null when allowed
  lastRefillDate,    // the state to persist
}
```

Semantics:
- **Allowed:** commits the refill — `lastRefillDate` advances to now and
  `tokensLeft` is the post-consumption count. `retryAfter` is `null`.
- **Denied:** state is left completely untouched (`tokensLeft` and
  `lastRefillDate` are returned exactly as passed in) — a denial never
  persists partial refill progress. `retryAfter` is computed only to
  inform the caller how long to wait, without being written back to
  storage. This avoids a lost-update bug where partial refill gets
  double-counted across repeated denials.

Implemented in [`utils/checkAndConsumeToken.js`](./utils/checkAndConsumeToken.js).

## API

Routes are mounted under `/rate-limiter`.

### `POST /rate-limiter/check`

Called by the App Backend on every rate-checked request. Atomic
check-and-consume: a single call both decides and deducts a token.

```
body:     { user_id, endpoint }
response: { allowed: true/false, retry_after: number|null, tokens_left: number }
```

- `200` when allowed, `429 Too Many Requests` when denied, `400` if
  `user_id` or `endpoint` is missing or not a non-empty string.
- `tokens_left` is whole tokens (rounded down).
- Response headers on every `/check` reply: `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (unix seconds at which
  the bucket would be full again). Denials also set `Retry-After`
  (seconds).
- An endpoint with no saved rule uses the default (10 tokens per 60s).

### `POST /rate-limiter/update-settings`

Called directly by the frontend admin panel to create or update a rule.

```
body:     { endpoint: "/", new_limit: 100, window_sec: 60 }
response: { message: "settings updated successfully" }
```

`400` if `endpoint` isn't a non-empty string or `new_limit`/`window_sec`
aren't positive numbers.

### `GET /rate-limiter/rules`

Lists every configured rule.

```
response: { rules: [{ endpoint, limit, windowSec }, ...] }
```

### `POST /rate-limiter/delete-rule`

Removes a rule, falling back to the default config for that endpoint.

```
body:     { endpoint: "/" }
response: { message: "rule deleted" }
```

### `GET /rate-limiter/metrics`

Allowed/denied counts per endpoint, tracked since the counters were last
reset.

```
response: { metrics: [{ endpoint, allowed, denied }, ...] }
```

## Configuration

Copy `config/.env.example` to `config/.env` for local `pnpm dev` runs.

| Variable      | Default                   |
| ------------- | -------------------------- |
| `PORT`        | `4000`                     |
| `REDIS_URL`   | `redis://localhost:6379`   |
| `CORS_ORIGIN` | `http://localhost:5173`    |

## Running with Docker

```bash
docker compose up --build
```

Starts the service on port 4000 together with its own Redis container
(not published to the host, so it won't clash with a local Redis). The
container reads `PORT` and `REDIS_URL` from the compose file; a local
`config/.env` is only used when running with `pnpm dev`.

## Storage Roadmap

- **Now:** Redis hashes (`rl:state:<user>:<endpoint>` and
  `rl:config:<endpoint>`) using plain `HGETALL`/`HSET` round trips.
  **Known limitation, intentionally deferred:** read and write are
  separate round trips, so two concurrent requests on the same key can
  both read stale data and both be allowed when only one should be —
  the same lost-update race the pure function's denial-path fix avoids
  in-process. Not fixed yet on purpose, to get the full stack working
  end-to-end first.
- **Later (hardening pass):** replace the `GET`/`SET` calls with a Lua
  script executed atomically via Redis `EVAL`, closing the race properly
  before this ships for real.
