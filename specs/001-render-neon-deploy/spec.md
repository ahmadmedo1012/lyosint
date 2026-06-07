# Feature Specification: 001-render-neon-deploy

**Feature Branch**: `001-render-neon-deploy`
**Created**: 2026-06-07
**Status**: Implemented
**Input**: User description: "Make the project ready for Render + Neon deployment."

## Goal

Ship the LYOSINT monorepo to a production deployment on **Render** (hosting) backed by a **Neon** serverless PostgreSQL instance, without breaking the existing local-dev / Replit workflows.

## User Scenarios & Testing

### User Story 1 - One-click Render Blueprint deploy (Priority: P1)

A maintainer pushes the repo to GitHub, points a new Render Blueprint at it, sets the secret env vars, and gets a working stack in one deploy.

**Why this priority**: This is the entire point of the feature. Without it, deployment is manual and error-prone.

**Independent Test**: Render reads `render.yaml`, provisions `lyosint-api` (pserv) + `lyosint-web` (static site), and both services become "Live".

**Acceptance Scenarios**:
1. **Given** the repo is on GitHub, **When** a Render Blueprint is created from `render.yaml`, **Then** two services are provisioned with correct build/start commands and env var groups.
2. **Given** `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CORS_ORIGIN` are set, **When** the API service is deployed, **Then** `/api/health` returns `{ "status": "ok" }`.
3. **Given** `VITE_API_URL` is set to the API's Render URL, **When** the static site is built, **Then** the bundled JS calls the absolute API URL at runtime.

### User Story 2 - Local dev still works (Priority: P1)

A developer can clone the repo, run `pnpm install`, set the `.env` files, and have the same UX as before — no Render-only assumptions in dev paths.

**Why this priority**: We must not regress the inner loop.

**Independent Test**: `pnpm run typecheck` exits 0; `pnpm --filter @workspace/lyosint run dev` starts Vite on `:19190`; `pnpm --filter @workspace/api-server run dev` starts Express on `:8080`.

**Acceptance Scenarios**:
1. **Given** no `VITE_API_URL` is set, **When** the Vite app boots, **Then** the API client uses relative paths (`/api/...`) and the auth flow works against the local API.
2. **Given** no `PORT` is set, **When** the API server boots, **Then** it listens on `10000` (Render's default).
3. **Given** no `BASE_PATH` is set, **When** Vite builds, **Then** assets are emitted at `/`.

### User Story 3 - Neon connection works with SSL (Priority: P2)

The API connects to Neon over SSL automatically when the connection string contains `neon.tech` or `sslmode=require`.

**Why this priority**: Without this, production DB access fails.

**Independent Test**: Provide a Neon-style `DATABASE_URL` and the pool comes up without `pg` SSL errors.

**Acceptance Scenarios**:
1. **Given** `DATABASE_URL` contains `.neon.tech`, **When** the API server starts, **Then** `ssl: { rejectUnauthorized: false }` is set on the PG pool.
2. **Given** `DATABASE_URL` does not contain `.neon.tech`, **When** the API server starts, **Then** the PG pool connects without SSL (local dev).

## Requirements

### Functional Requirements

- **FR-001**: A `render.yaml` Blueprint MUST declare one `pserv` (API) and one `web` (static site) service with correct build commands, start commands, and env var groups.
- **FR-002**: The API server MUST listen on `PORT` env var, defaulting to `10000` when unset.
- **FR-003**: The PG pool MUST enable SSL when `DATABASE_URL` contains `neon.tech` or `sslmode=require`.
- **FR-004**: The Vite config MUST default `PORT` to `19190` and `BASE_PATH` to `/` when those env vars are unset.
- **FR-005**: The frontend MUST send API requests to `VITE_API_URL` in production, and to relative `/api/...` in dev.
- **FR-006**: The API server MUST expose `GET /api/health` (and `/api/healthz`) returning `{ "status": "ok" }` for Render's health check.
- **FR-007**: CORS MUST be configurable via `CORS_ORIGIN` (comma-separated origins, or `*`).
- **FR-008**: `.env.example` files MUST be present at repo root, `artifacts/api-server/`, and `artifacts/lyosint/` documenting every required env var.
- **FR-009**: A `Dockerfile` MUST be present as a fallback for environments that prefer Docker.
- **FR-010**: CI MUST run `pnpm run typecheck` and `pnpm run build` on every PR and push to `main`.
- **FR-011**: `README.md` MUST document the deploy steps for Render + Neon, including the Neon pooler hostname requirement.

### Key Entities

- **Render Blueprint (`render.yaml`)**: Declarative spec for both services.
- **Neon connection string (`DATABASE_URL`)**: SSL-required PostgreSQL DSN.
- **Frontend config (`VITE_API_URL`)**: Absolute API origin compiled into the static bundle.

## Success Criteria

- **SC-001**: A new Render Blueprint provisioned from `render.yaml` deploys both services in under 10 minutes with no manual config beyond secret env vars.
- **SC-002**: `pnpm run typecheck` passes with 0 errors after all changes.
- **SC-003**: `pnpm run build` produces both `artifacts/api-server/dist/index.mjs` and `artifacts/lyosint/dist/public/index.html` with 0 errors.
- **SC-004**: Local dev (`pnpm --filter @workspace/lyosint run dev` + `pnpm --filter @workspace/api-server run dev`) still works without any Render-specific env vars set.

## Assumptions

- The Neon project uses the default `postgres` role and a single `neondb` database.
- The Telegram bot token belongs to a bot created via BotFather; the admin panel uses bcrypt-hashed passwords seeded on first boot.
- The user accepts the Render free-tier limitations (static site sleeps after inactivity; pserv runs continuously on the chosen plan).
- The existing `pnpm` workspace layout is preserved — no migration to a different package manager.
