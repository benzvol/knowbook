# syntax=docker/dockerfile:1

# --- Build stage ---------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

# Enable pnpm via corepack.
RUN corepack enable

# better-sqlite3 is a native module and needs a toolchain to compile.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (leveraging layer cache on lockfile changes).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the Nuxt app.
COPY . .
RUN pnpm build

# --- Runtime stage -------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0
# Default location for the SQLite database (persisted via a volume).
ENV DATABASE_PATH=/data/knowbook.sqlite

# The build output is self-contained; only .output is needed at runtime.
COPY --from=build /app/.output ./.output

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
