FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Create non-root user for production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# ── Maigret Python stage ────────────────────────────────────────────────────
# Installs Python 3.12 + maigret 0.6.1 + minimal [reporting] extras (no aiohttp
# server, no playwright, no aiosqlite — we just need the core checker).
# Saves ~150MB vs maigret[all].
FROM node:20-alpine AS python-deps
RUN apk add --no-cache \
      python3 py3-pip py3-wheel \
      # Maigret core runtime deps (alpine packages)
      libxml2 libxslt openssl libffi \
      # Maigret uses lxml for parsing; cchardet is pulled via pip
      py3-lxml \
      # SSL + certs
      ca-certificates \
  && python3 -m pip install --no-cache-dir --break-system-packages \
       "maigret==0.6.1"

# Verify maigret importable + identify install locations
RUN python3 -c "import maigret, sys, sysconfig; print('maigret ok:', maigret.__file__); print('python:', sys.executable); print('stdlib:', sysconfig.get_paths()['stdlib']); print('purelib:', sysconfig.get_paths()['purelib']); print('platlib:', sysconfig.get_paths()['platlib'])"

# Strip tests, caches, and strip .so files
RUN find /usr/lib/python3.12/site-packages -type d \
      \( -name 'tests' -o -name 'test' -o -name '__pycache__' \) -prune -exec rm -rf {} + \
  && find /usr/lib/python3.12/site-packages -type f -name '*.pyc' -delete \
  && find /usr/lib/python3.12/site-packages -type f -name '*.so' -exec strip --strip-unneeded {} + 2>/dev/null || true

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* tsconfig.json tsconfig.base.json ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile=false

FROM base AS build
COPY --from=deps /app /app
RUN pnpm run build

FROM base AS api
ENV NODE_ENV=production
ENV PORT=3000

# Install Python 3.12 runtime + minimal libs Maigret needs at runtime
# (the compiled extension modules are in the maigret wheel itself)
RUN apk add --no-cache \
      python3 \
      libxml2 libxslt openssl libffi \
      py3-lxml \
      ca-certificates tini

# Copy pre-installed maigret + dependencies from python-deps stage
COPY --from=python-deps /usr/lib/python3.12/site-packages /usr/lib/python3.12/site-packages
COPY --from=python-deps /usr/lib/python3.12/lib-dynload   /usr/lib/python3.12/lib-dynload
COPY --from=python-deps /usr/bin/python3                    /usr/local/bin/python3
COPY --from=python-deps /usr/bin/python3.12                 /usr/local/bin/python3.12
COPY --from=python-deps /usr/lib/libpython3.12.so.1.0      /usr/lib/libpython3.12.so.1.0

# Ensure ca-certs are writable
RUN update-ca-certificates 2>/dev/null || true

# Tell Node wrapper where Python lives (it also auto-discovers "python3" on PATH)
ENV MAIGRET_PYTHON=/usr/local/bin/python3
ENV MAIGRET_PREINSTALLED=true
ENV PYTHONUNBUFFERED=1

# Copy app
COPY --from=build /app /app
WORKDIR /app
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/health || exit 1

# Switch to non-root user
USER appuser

ENTRYPOINT ["tini", "--"]
CMD ["pnpm", "run", "render:start"]
