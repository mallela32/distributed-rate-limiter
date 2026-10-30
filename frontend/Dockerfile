FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_APP_BACKEND_URL
ARG VITE_RATE_LIMITER_URL
ENV VITE_APP_BACKEND_URL=$VITE_APP_BACKEND_URL
ENV VITE_RATE_LIMITER_URL=$VITE_RATE_LIMITER_URL

RUN pnpm build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
