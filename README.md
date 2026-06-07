# LYOSINT — Libya OSINT SuperTool v3.0

A full-stack Open Source Intelligence (OSINT) investigation platform targeting Libya. Search for individuals by name, phone number (+218), or username across 40+ Libyan-specific and international platforms with real-time progress tracking and dossier-style results.

Deployed on **Render** (hosting) + **Neon** (serverless PostgreSQL). The same codebase also runs locally on Replit and other Node 20+ environments.

---

## Stack

- pnpm workspaces, Node.js 20+
- **API**: Express 5 + TypeScript
- **DB**: PostgreSQL + Drizzle ORM (Neon-compatible)
- **Validation**: Zod v4, drizzle-zod
- **API codegen**: Orval (from `openapi.yaml`)
- **API build**: esbuild (CJS bundle)
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui + wouter + TanStack Query

---

## Project layout

```
.
├── artifacts/
│   ├── api-server/      # Express 5 API (Drizzle, OSINT services)
│   └── lyosint/         # React + Vite SPA
├── lib/
│   ├── api-spec/        # OpenAPI 3.1 contract (source of truth) + Orval config
│   ├── api-client-react/# Orval-generated React Query hooks + custom fetch
│   ├── api-zod/         # Orval-generated Zod schemas
│   └── db/              # Drizzle schema + pool
├── scripts/             # Operational scripts
├── render.yaml          # Render Blueprint (API + Static Site)
├── Dockerfile           # Fallback Docker path
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
cp artifacts/lyosint/.env.example artifacts/lyosint/.env
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

The project ships with a `render.yaml` Blueprint that declares two services backed by the same repo.

### 1. Provision the database (Neon)

1. Create a project at https://neon.tech.
2. Copy the **pooled** connection string (e.g. `postgresql://...ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).
3. Note it as `DATABASE_URL` for the API service.

The pool code (`lib/db/src/index.ts`) auto-detects `*.neon.tech` URLs and enables SSL with `rejectUnauthorized: false`.

### 2. Provision Telegram bot credentials

- `TELEGRAM_BOT_TOKEN` — from BotFather
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — for the admin panel

### 3. Connect the repo to Render

1. Push this repo to GitHub.
2. In Render → **New** → **Blueprint**, point at the repo.
3. Render will read `render.yaml` and create `lyosint-api` (pserv) + `lyosint-web` (static site).
4. Set the secret env vars in each service:
   - **lyosint-api**: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CORS_ORIGIN` (set to the static site URL once you have it, e.g. `https://lyosint-web.onrender.com`).
   - **lyosint-web**: `VITE_API_URL` = the API's Render URL (e.g. `https://lyosint-api.onrender.com`).
5. Trigger a deploy.

### 4. Health check

The API responds at `GET /api/health` and `GET /api/healthz` (returns `{ "status": "ok" }`). Render's `healthCheckPath` is configured to `/api/health`.

---

## Environment variables

| Var | Used by | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | API | yes | PostgreSQL connection string. Neon URLs auto-enable SSL. |
| `PORT` | API | no (default `10000`) | HTTP port. Render sets it automatically. |
| `NODE_ENV` | API | no | Set to `production` in prod. |
| `TELEGRAM_BOT_TOKEN` | API | yes (prod) | Telegram bot token for auth. |
| `ADMIN_USERNAME` | API | yes (prod) | Admin login. |
| `ADMIN_PASSWORD` | API | yes (prod) | Admin password (bcrypt-hashed on first login). |
| `CORS_ORIGIN` | API | no | Comma-separated allowed origins, or `*`. |
| `DB_POOL_MAX` | API | no | Max PG pool size (default `10`). |
| `VITE_API_URL` | Web | yes (prod) | Full URL of the API (e.g. `https://lyosint-api.onrender.com`). |
| `BASE_PATH` | Web | no (default `/`) | Vite `base` config — set to a subpath if serving under a subpath. |

See [`.env.example`](.env.example) at the repo root and per-package.

---

## Architecture decisions

- All searches are async: POST returns a task immediately; the frontend polls `/search/:id/status` until complete.
- Search logic runs as fire-and-forget async functions updating the DB row with progress.
- Username search runs in batches across 40+ platforms with delays to simulate real scanning.
- Phone carrier identification uses Libyan prefix rules (`091/093` = Al-Madar, `092/094` = Libyana, `095/096` = LibyaPhone).
- Platform coverage list is static in-memory (no DB query).
- The API client uses a single `customFetch` wrapper that respects `setBaseUrl(VITE_API_URL)`, so generated hooks transparently call the correct host in dev (relative `/api`) and prod (absolute URL).

---

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`.
- Google Fonts must be loaded via `<link>` in `index.html`, **not** via `@import` in CSS (PostCSS fails with URL @imports after `@layer` rules).
- The API server must be restarted after any route/service changes (esbuild bundle).
- On Neon, **always use the `-pooler` hostname** (e.g. `ep-xxx-pooler.region.aws.neon.tech`) from serverless clients — direct hostnames only allow a small number of connections.
- The frontend's `BASE_PATH` is the Vite `base` config (asset prefix), **not** the API path.

---

## License

MIT
