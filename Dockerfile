FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ── Install Python 3 (needed for maigret at runtime)
# Maigret itself is NOT installed here — it's lazy-installed on first search
# via `pip install` inside the running container (~60-180s first time).
# This keeps the Docker build fast and avoids Render's build timeout.
FROM base AS python
RUN apk add --no-cache \
      python3 py3-pip ca-certificates tini \
      libxml2 libxslt openssl libffi py3-lxml

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* tsconfig.json tsconfig.base.json ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile=false

FROM base AS build
COPY --from=deps /app /app
RUN pnpm run build

FROM python AS api
ENV NODE_ENV=production
ENV PORT=10000
ENV PYTHONUNBUFFERED=1
ENV MAIGRET_PYTHON=/usr/bin/python3

COPY --from=build /app /app
WORKDIR /app
EXPOSE 10000
CMD ["pnpm", "run", "render:start"]
