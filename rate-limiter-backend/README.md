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

## Planned API

Not yet implemented — this is the contract the service will expose once
the Express layer is built.

### `POST /check`

Called by the App Backend on every rate-checked request. Atomic
check-and-consume: a single call both decides and deducts a token.

```
body:     { user_id, endpoint }
response: { allowed: true/false, retry_after: number|null, tokens_left: number }
```

### `POST /update-settings`

Called directly by the frontend admin panel to manage rate-limit rules.

```
body:     { endpoint: "/", new_limit: 100, window_sec: 60 }
response: { message: "settings updated successfully" }
```

## Storage Roadmap

- **Now:** state lives wherever it's wired up during development (no
  persistent store yet).
- **Next:** Redis, using plain `GET`/`SET` (or `HGET`/`HSET`) round
  trips. **Known limitation, intentionally deferred:** read and write are
  separate round trips, so two concurrent requests on the same key can
  both read stale data and both be allowed when only one should be —
  the same lost-update race the pure function's denial-path fix avoids
  in-process. Not fixed yet on purpose, to get the full stack working
  end-to-end first.
- **Later (hardening pass):** replace the `GET`/`SET` calls with a Lua
  script executed atomically via Redis `EVAL`, closing the race properly
  before this ships for real.
