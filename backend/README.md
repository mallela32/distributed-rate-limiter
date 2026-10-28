# App Backend

The service the frontend talks to. It has a few demo endpoints and no
rate limiting logic of its own: every request under `/api` is checked
against the Rate Limiter Service first (`POST /rate-limiter/check`), and
the result decides whether the request goes through.

## Endpoints

| Method | Path            | Notes                                         |
| ------ | --------------- | --------------------------------------------- |
| GET    | `/health`       | Not rate limited                              |
| POST   | `/api/login`    | `{ username, password }`, demo user `demo` / `demo123` |
| POST   | `/api/messages` | `{ user_id, text }`                           |
| GET    | `/api/products` | Static list                                   |

## How requests are limited

- The caller is identified by the `X-User-Id` header, falling back to the
  request IP.
- The rate limit key is the route, for example `/api/login`, so rules are
  set per route on the Rate Limiter Service.
- Allowed requests get `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
  `X-RateLimit-Reset` headers. Denied ones get `429` with `Retry-After`
  and `{ "error": "rate limit exceeded", "retry_after": n }`.
- If the limiter can't be reached or answers with an error, the policy is
  set by `RATE_LIMITER_FAIL_MODE`. `open` (the default) lets the request
  through and logs the failure; `closed` answers `503`.

## Configuration

Copy `.env.example` to `.env`.

| Variable                   | Default                 |
| -------------------------- | ----------------------- |
| `PORT`                     | `3001`                  |
| `RATE_LIMITER_URL`         | `http://localhost:4000` |
| `RATE_LIMITER_TIMEOUT_MS`  | `500`                   |
| `RATE_LIMITER_FAIL_MODE`   | `open`                  |
| `CORS_ORIGIN`              | `http://localhost:5173` |

Avoid port 5000 on macOS, since AirPlay Receiver answers on it.

## Running

```bash
pnpm install
pnpm dev
```

The integration tests start the Rate Limiter Service themselves, so
Redis needs to be running locally:

```bash
pnpm test
```

## Docker

```bash
docker build -t app-backend .
docker run -p 3001:3001 -e RATE_LIMITER_URL=http://host.docker.internal:4000 app-backend
```
