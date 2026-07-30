# syntax=docker/dockerfile:1

FROM node:24-slim AS build
WORKDIR /app

RUN corepack enable

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the Nuxt app.
COPY . .
RUN pnpm build

FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV DATABASE_PATH=/data/knowbook.sqlite

COPY --from=build /app/.output ./.output
COPY --from=build /app/server/db/migrations ./server/db/migrations

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
