# LYOSINT — Libya OSINT SuperTool v3.0

A full-stack Open Source Intelligence (OSINT) investigation platform targeting Libya. Search for individuals by name, phone number (+218), or username across 40+ Libyan-specific and international platforms with real-time progress tracking and dossier-style results.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/lyosint run dev` — run the React frontend (port 19190)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, wouter, TanStack Query

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/searches.ts` — DB schema (single `searches` table)
- `artifacts/api-server/src/routes/search.ts` — OSINT search routes
- `artifacts/api-server/src/routes/stats.ts` — Stats + platform coverage routes
- `artifacts/api-server/src/services/` — OSINT service modules
  - `libyaHelpers.ts` — Libya carrier/region/name utilities
  - `nameSearch.ts` — Name-based search simulation
  - `phoneSearch.ts` — Phone number search & carrier identification
  - `usernameSearch.ts` — Username search across 40 platforms
- `artifacts/lyosint/src/` — React frontend (dark terminal aesthetic)

## Architecture decisions

- All searches are async: POST returns a task immediately, frontend polls `/search/:id/status` until complete
- Search logic runs as fire-and-forget async functions updating the DB row with progress
- Username search runs in batches of 40 platforms with delays to simulate real scanning
- Phone carrier identification uses Libyan prefix rules (091/093=Al-Madar, 092/094=Libyana, 095/096=LibyaPhone)
- Platform coverage list is static in-memory (no DB), returns 40 platforms

## Product

- **Dashboard**: 3 search modes (Name/Phone/Username) + Deep Search All
- **Investigation Result**: Real-time progress polling → full dossier (profile card, social links, confidence score, sources)
- **Platform Coverage**: Grid of all 40+ supported platforms with category badges
- **History**: Recent investigations log with confidence scores

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Google Fonts must be loaded via `<link>` in `index.html`, NOT via `@import` in CSS (PostCSS fails with URL @imports placed after @layer rules)
- The API server must be restarted after any route/service changes (esbuild bundle)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
