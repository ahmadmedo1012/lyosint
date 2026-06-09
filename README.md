# LYOSINT — Libya OSINT SuperTool v3.0

A full-stack Open Source Intelligence (OSINT) investigation platform targeting Libya. Search for individuals by name, phone number (+218), or username across 40+ Libyan-specific and international platforms with real-time progress tracking and dossier-style results.

Deployed on **Render** (single Docker service) + **Neon** (serverless PostgreSQL). The same codebase also runs locally on Replit and other Node 20+ environments.

---

## Stack

- pnpm workspaces, Node.js 20+
- **API + Web**: Express 5 serves both the JSON API (`/api/*`) and the built Vite SPA (`/*`) from one process
- **DB**: PostgreSQL + Drizzle ORM (Neon-compatible)
- **Validation**: Zod v4, drizzle-zod
- **API codegen**: Orval (from `openapi.yaml`)
- **API build**: esbuild (ESM bundle)
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui + wouter + TanStack Query

---

## Project layout

```
.
├── artifacts/
│   ├── api-server/      # Express 5 API (Drizzle, OSINT services, static SPA host)
│   └── lyosint/         # React + Vite SPA (built output served by the API)
├── lib/
│   ├── api-spec/        # OpenAPI 3.1 contract (source of truth) + Orval config
│   ├── api-client-react/# Orval-generated React Query hooks + custom fetch
│   ├── api-zod/         # Orval-generated Zod schemas
│   └── db/              # Drizzle schema + pool
├── scripts/             # Operational scripts
├── render.yaml          # Render Blueprint (single pserv)
├── Dockerfile           # Multi-stage build ending in the API server
└── .github/workflows/   # CI (typecheck + build)
```

---

## Local development

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 14+ (local or Neon)

### Install
```bash
pnpm install
cp .env.example .env
cp artifacts/api-server/.env.example artifacts/api-server/.env
# edit .env files with your local DATABASE_URL, etc.
```

### Common scripts
```bash
pnpm run typecheck                # full typecheck across all packages
pnpm run build                    # typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen   # regenerate API hooks/schemas
pnpm --filter @workspace/db run push            # push Drizzle schema to DB (dev)
pnpm --filter @workspace/api-server run dev     # API on :8080
pnpm --filter @workspace/lyosint run dev        # Vite dev server on :19190
```

### Ports
- API: `8080` (override with `PORT`)
- Frontend dev: `19190` (override with `PORT`)

---

## Deployment to Render + Neon

The project ships with a single Docker Web Service that runs Express on Render. The same Express process serves the JSON API at `/api/*` and the built Vite SPA at everything else (with a fallback to `index.html` for client-side routes).

### 1. Provision the database (Neon)

1. Create a project at https://neon.tech.
2. Copy the **pooled** connection string (e.g. `postgresql://...ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).
3. Note it as `DATABASE_URL` for the service.

The pool code (`lib/db/src/index.ts`) auto-detects `*.neon.tech` URLs and enables SSL with `rejectUnauthorized: false`.

### 2. Provision Telegram bot credentials

- `TELEGRAM_BOT_TOKEN` — from @BotFather
- After the service is live, set the webhook once:
  ```bash
  curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://<your-service>.onrender.com/api/auth/bot-webhook", "allowed_updates": ["message"]}'
  ```

### 3. Create the Render service

1. Push this repo to GitHub.
2. In Render → **New** → **Web Service**, connect the repo.
3. Render detects the Dockerfile at the repo root. Confirm:
   - **Runtime**: Docker
   - **Docker Build Context**: `.`
   - **Dockerfile Path**: `./Dockerfile`
   - **Health Check Path**: `/api/health`
   - **Pre-Deploy Command**: `pnpm --filter @workspace/db run push` (applies Drizzle schema)
4. Add the required environment variables (see table below).
5. Deploy.

The `render.yaml` at the repo root captures the same configuration for Blueprint-based provisioning.

---

## Environment variables

The frontend and API live in the same service, so all env vars are set on a single Render service.

| Var | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string. Neon URLs auto-enable SSL. |
| `TELEGRAM_BOT_TOKEN` | yes (prod) | — | Telegram bot token for login + webhooks. |
| `ADMIN_USERNAME` | yes (prod) | `admin` | Admin login username. |
| `ADMIN_PASSWORD` | yes (prod) | — | Admin login password. **No default** — must be set. |
| `NODE_ENV` | no | `development` | Set to `production` in prod. |
| `PORT` | no | `10000` | HTTP port. Render sets it automatically. |
| `LOG_LEVEL` | no | `info` | pino log level (`debug` / `info` / `warn` / `error`). |
| `DB_POOL_MAX` | no | `10` | Max PG pool size. |
| `CORS_ORIGIN` | no | `true` (any) | Only needed if a separate frontend host is used. |
| `VITE_API_URL` | no | *(empty)* | Leave empty when API and SPA share an origin. |
| `VITE_TELEGRAM_BOT_USERNAME` | no | `lyosintbot` | Telegram @username of the login bot. |

See [`.env.example`](.env.example) at the repo root and [`artifacts/api-server/.env.example`](artifacts/api-server/.env.example).

---

## API key settings (via admin panel, not env)

The following OSINT service keys are configured at runtime from the admin panel and stored in the database. They are **not** environment variables.

- `github_token`, `hunter_api_key`, `hibp_api_key`, `shodan_api_key`
- `numverify_api_key`, `virustotal_api_key`
- `twitch_client_id`, `twitch_client_secret`
- `ipinfo_token`, `abstractapi_email_key`, `emailrep_key`, `leakcheck_key`

Plus system config (`sys_free_search_quota`, `sys_subscription_days`, `sys_max_concurrent_searches`, `sys_platform_check_timeout`, `sys_site_name`, `sys_maintenance_mode`) and the admin credentials override (`sys_admin_username`, `sys_admin_password`).

---

## Architecture decisions

- **Single deployable unit**: Express serves the API at `/api/*` and the built Vite SPA at `/*` with an SPA fallback. No second service, no CORS, no inter-service networking.
- All searches are async: POST returns a task immediately; the frontend polls `/search/:id/status` until complete.
- Search logic runs as fire-and-forget async functions updating the DB row with progress.
- Username search runs in batches across 40+ platforms with delays to simulate real scanning.
- Phone carrier identification uses Libyan prefix rules (`091/093` = Al-Madar, `092/094` = Libyana, `095/096` = LibyaPhone).
- The API client uses a single `customFetch` wrapper that respects `setBaseUrl(VITE_API_URL)`. With `VITE_API_URL` empty (the default), all requests use relative `/api/...` paths, which is correct when the SPA is served from the same origin as the API.

---

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`.
- Google Fonts must be loaded via `<link>` in `index.html`, **not** via `@import` in CSS (PostCSS fails with URL @imports after `@layer` rules).
- On Neon, **always use the `-pooler` hostname** (e.g. `ep-xxx-pooler.region.aws.neon.tech`) from serverless clients — direct hostnames only allow a small number of connections.
- The `preinstall` script in the root `package.json` refuses `npm install` and `yarn install`; use `pnpm` only.
- The frontend's `BASE_PATH` is the Vite `base` config (asset prefix), **not** the API path.

---

## License

MIT
