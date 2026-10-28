import { requestJson } from "./request.js";

const BASE_URL = import.meta.env.VITE_APP_BACKEND_URL || "http://localhost:3001";

const ROUTES = {
  login: { method: "POST", path: "/api/login" },
  messages: { method: "POST", path: "/api/messages" },
  products: { method: "GET", path: "/api/products" },
};

const bodyFor = (route) => {
  if (route === "login") return { username: "demo", password: "demo123" };
  if (route === "messages") return { user_id: "demo", text: "hello" };
  return undefined;
};

export const callAppBackendRoute = (route, userId) => {
  const { method, path } = ROUTES[route];
  const headers = { "X-User-Id": userId };
  const body = bodyFor(route);
  if (body) headers["Content-Type"] = "application/json";

  return requestJson(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
};

export const checkHealth = () => requestJson(`${BASE_URL}/health`);

export const appBackendRoutes = Object.keys(ROUTES);
export const appBackendBaseUrl = BASE_URL;
