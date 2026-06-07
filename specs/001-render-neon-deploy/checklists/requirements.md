# Requirements Checklist: 001-render-neon-deploy

**Purpose**: Verify all functional requirements from spec.md are satisfied.
**Created**: 2026-06-07
**Feature**: [spec.md](./spec.md)

## Render Blueprint

- [x] CHK001 `render.yaml` exists at repo root and parses as valid YAML
- [x] CHK002 Declares `lyosint-api` as a `pserv` with `node` runtime
- [x] CHK003 Declares `lyosint-web` as a `web` static site
- [x] CHK004 API service has `healthCheckPath: /api/health`
- [x] CHK005 All required env vars are listed with `sync: false` for secrets

## API Server

- [x] CHK006 `PORT` defaults to `10000` when unset (`artifacts/api-server/src/index.ts`)
- [x] CHK007 CORS origin configurable via `CORS_ORIGIN` (`artifacts/api-server/src/app.ts`)
- [x] CHK008 Health endpoint responds at `/api/health` and `/api/healthz` (`artifacts/api-server/src/routes/health.ts`)
- [x] CHK009 Body size limit capped at 1 MB

## Database

- [x] CHK010 PG pool enables SSL for Neon URLs (`lib/db/src/index.ts`)
- [x] CHK010a SSL auto-detected via `.neon.tech` or `sslmode=require` in DSN
- [x] CHK010b Pool respects `DB_POOL_MAX` env var

## Frontend

- [x] CHK011 Vite config defaults `PORT=19190` and `BASE_PATH=/` (`artifacts/lyosint/vite.config.ts`)
- [x] CHK012 `VITE_API_URL` wired into `customFetch` via `setBaseUrl` (`artifacts/lyosint/src/contexts/auth.tsx`)
- [x] CHK013 `vite-env.d.ts` declares `VITE_API_URL` and friends

## Scripts

- [x] CHK014 Root `package.json` adds `render:build`, `render:start`, `start` scripts
- [x] CHK015 `engines.node` pinned to `>=20.0.0`

## Documentation

- [x] CHK016 `README.md` documents Render + Neon deploy steps
- [x] CHK017 `README.md` documents all env vars in a table
- [x] CHK018 `.env.example` exists at repo root, `artifacts/api-server/`, and `artifacts/lyosint/`

## Container & CI

- [x] CHK019 `Dockerfile` builds a multi-stage image ending in the API server
- [x] CHK020 `.dockerignore` excludes `node_modules`, `.git`, `.env`, `attached_assets/`
- [x] CHK021 `.github/workflows/ci.yml` runs typecheck + build on PRs and `main` pushes

## Verification

- [x] CHK022 `pnpm run typecheck` exits 0 across all packages
- [x] CHK023 `pnpm --filter @workspace/lyosint run build` produces `dist/public/index.html`
- [x] CHK024 `pnpm --filter @workspace/api-server run build` produces `dist/index.mjs`

## Notes

- [x] All items in this checklist are satisfied.
- The user can now: (a) commit the changes, (b) push to GitHub, (c) point a new Render Blueprint at the repo, (d) set the secret env vars, (e) deploy.
