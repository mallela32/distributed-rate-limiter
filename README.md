# Distributed Rate Limiter

A small project demonstrating rate limiting as its own microservice,
with a client service calling it over HTTP and a dashboard to drive and
inspect it live.

The point of the project is the Rate Limiter Service: a standalone
token-bucket limiter backed by Redis, called over HTTP by anything that
wants to enforce rate limits, with an admin API to manage rules and view
metrics. The App Backend exists only to give it something realistic to
protect, and the frontend exists to make the behavior visible.

## Architecture

```
Frontend ──demo traffic──> App Backend ──check()──> Rate Limiter Service ──> Redis
Frontend ──admin/config────────────────────────────> Rate Limiter Service
```

- **Rate Limiter Service** (`rate-limiter-backend/`, Node/Express, port
  4000) — owns the rate-limiting decision. Exposes `POST /rate-limiter/check`
  for clients, and an admin API (rules, metrics) for the dashboard.
  State lives in Redis.
- **App Backend** (`backend/`, Node/Express, port 3001) — a demo service
  with a few endpoints (`/api/login`, `/api/messages`, `/api/products`).
  Has no rate-limiting logic of its own: every `/api` request calls the
  Rate Limiter Service's `/check` first and acts on the result.
- **Frontend** (`frontend/`, React + Vite, dev port 5173) — talks to
  both: it fires demo traffic at the App Backend and shows the resulting
  allow/deny decisions, and it talks directly to the Rate Limiter
  Service's admin API to manage rules and view metrics.

`VITE_APP_BACKEND_URL` and `VITE_RATE_LIMITER_URL` are build-time values
baked into the frontend's JS bundle — the browser calls those URLs
directly, so they need to be addresses the browser can reach, not just
the frontend's own container.

## How the rate limiter works

Each `(user_id, endpoint)` pair gets its own token bucket: a capacity
(`limit`) and a refill rate derived from `limit / windowSec`. Tokens
refill lazily and continuously — there's no discrete window reset, the
bucket is topped up based on elapsed time whenever it's next read. A
check-and-consume call computes the current token count, and if at
least one token is available it's allowed and one token is deducted;
otherwise the request is denied and the state is left untouched, with
a `retry_after` telling the caller how long until a token frees up. This
allows short bursts up to the bucket's capacity while still enforcing a
steady average rate.

The first version of this ran as separate Redis `GET`/`SET` round trips,
which left a lost-update race: two concurrent requests on the same key
could both read the same token count and both be allowed. That's fixed
by running the whole read-refill-decide-write sequence as a single Lua
script executed atomically via Redis `EVAL`/`EVALSHA` — one round trip,
no interleaving possible, with "now" coming from `redis.call('TIME')`
inside the script rather than the app's clock. See
[rate-limiter-backend/README.md](rate-limiter-backend/README.md) for the
full algorithm writeup and storage layout.

## Quick start

```bash
docker compose up --build
```

This builds and runs all four containers (Redis, Rate Limiter Service,
App Backend, frontend) wired together. Once everything is healthy:

- Dashboard: http://localhost:8080
- Rate Limiter Service: http://localhost:4000
- App Backend: http://localhost:3001

Redis isn't published to the host, so it won't clash with a Redis
instance you might already have running locally. Stop everything with
`docker compose down`.

This root `docker-compose.yml` is for running the whole stack at once.
`rate-limiter-backend/` also has its own standalone `docker-compose.yml`
for running just that service with its own Redis during development on
that service alone.

## Running locally for development

Each service can also run on its own with `pnpm dev`, which is faster
for iterating on one piece at a time. Redis needs to be running locally
(`redis-server`, or `docker run -p 6379:6379 redis:7-alpine`).

```bash
# rate-limiter-backend/
cp config/.env.example config/.env
pnpm install
pnpm dev          # http://localhost:4000

# backend/
cp .env.example .env
pnpm install
pnpm dev          # http://localhost:3001

# frontend/
cp .env.example .env
pnpm install
pnpm dev          # http://localhost:5173
```

The default `CORS_ORIGIN` on both backends is `http://localhost:5173`,
matching the frontend dev server.

## API

Full request/response shapes are in each service's own README.

### Rate Limiter Service (`rate-limiter-backend/`)

| Method | Path                           | Purpose                              |
| ------ | ------------------------------ | ------------------------------------- |
| POST   | `/rate-limiter/check`          | Check-and-consume for `(user_id, endpoint)` |
| POST   | `/rate-limiter/update-settings`| Create/update a rule                  |
| GET    | `/rate-limiter/rules`          | List all rules                        |
| POST   | `/rate-limiter/delete-rule`    | Delete a rule                         |
| GET    | `/rate-limiter/metrics`        | Allowed/denied counts per endpoint    |

See [rate-limiter-backend/README.md](rate-limiter-backend/README.md).

### App Backend (`backend/`)

| Method | Path            | Notes                                    |
| ------ | --------------- | ----------------------------------------- |
| GET    | `/health`       | Not rate limited                          |
| POST   | `/api/login`    | `{ username, password }`                  |
| POST   | `/api/messages` | `{ user_id, text }`                       |
| GET    | `/api/products` | Static list                               |

Caller identity is the `X-User-Id` header, falling back to IP. See
[backend/README.md](backend/README.md).

## Configuration

| Service            | Variable                  | Default                  |
| ------------------- | ------------------------- | ------------------------- |
| rate-limiter-backend | `PORT`                    | `4000`                    |
| rate-limiter-backend | `REDIS_URL`                | `redis://localhost:6379`  |
| rate-limiter-backend | `CORS_ORIGIN`              | `http://localhost:5173`   |
| backend             | `PORT`                    | `3001`                    |
| backend             | `RATE_LIMITER_URL`         | `http://localhost:4000`   |
| backend             | `RATE_LIMITER_TIMEOUT_MS`  | `500`                     |
| backend             | `RATE_LIMITER_FAIL_MODE`   | `open`                    |
| backend             | `CORS_ORIGIN`              | `http://localhost:5173`   |
| frontend            | `VITE_APP_BACKEND_URL`     | `http://localhost:3001`   |
| frontend            | `VITE_RATE_LIMITER_URL`    | `http://localhost:4000`   |

Avoid port 5000 on macOS — AirPlay Receiver answers on it.

## Tests

```bash
cd rate-limiter-backend && pnpm test
cd backend && pnpm test
```

Both suites include integration tests that start the real service
against a running Redis, so Redis needs to be up locally first. The
rate-limiter-backend suite also includes a concurrency test that fires a
burst of parallel requests at the same key and asserts that exactly
`limit` of them are allowed and the stored token count never goes
negative.

## Project layout

```
rate-limiter-backend/   Rate Limiter Service (Node/Express, Redis)
backend/                App Backend (Node/Express)
frontend/               Dashboard (React/Vite)
docker-compose.yml      Runs the whole stack together
```
