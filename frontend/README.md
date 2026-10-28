# Frontend Dashboard

React (Vite) dashboard for the rate limiter project. Talks to both backend
services directly from the browser.

## Running

```bash
pnpm install
pnpm dev
```

Opens on http://localhost:5173.

## Configuration

Copy `.env.example` to `.env`.

| Variable                 | Default                 |
| ------------------------- | ----------------------- |
| `VITE_APP_BACKEND_URL`     | `http://localhost:3001` |
| `VITE_RATE_LIMITER_URL`    | `http://localhost:4000` |

## Panels

- **Try it** — sends demo requests (login, messages, products) to the
  **App Backend**, identified by a user id you choose. Shows allow/deny,
  remaining quota, a reset countdown, and retry-after on denials. "Send
  burst" fires several requests in a row so the limit kicks in visibly.
- **Admin** — talks directly to the **Rate Limiter Service** to list,
  create, edit and delete rate-limit rules, and shows allowed/denied
  counts per endpoint from its metrics endpoint.

Both backends need `CORS_ORIGIN` set to this app's origin
(`http://localhost:5173` by default) to accept browser requests.

## Build

```bash
pnpm build
```
