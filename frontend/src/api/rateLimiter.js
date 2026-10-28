import { requestJson } from "./request.js";

const BASE_URL = import.meta.env.VITE_RATE_LIMITER_URL || "http://localhost:4000";

export const listRules = () => requestJson(`${BASE_URL}/rate-limiter/rules`);

export const getMetrics = () => requestJson(`${BASE_URL}/rate-limiter/metrics`);

export const updateRule = ({ endpoint, limit, windowSec }) =>
  requestJson(`${BASE_URL}/rate-limiter/update-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint,
      new_limit: limit,
      window_sec: windowSec,
    }),
  });

export const deleteRule = (endpoint) =>
  requestJson(`${BASE_URL}/rate-limiter/delete-rule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });

export const rateLimiterBaseUrl = BASE_URL;
