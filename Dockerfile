FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile=false

FROM base AS build
COPY --from=deps /app /app
RUN pnpm run build

FROM base AS api
ENV NODE_ENV=production
ENV PORT=10000
COPY --from=build /app /app
WORKDIR /app
EXPOSE 10000
CMD ["pnpm", "run", "render:start"]
