# Feature Specification: 001-render-neon-deploy

**Feature Branch**: `001-render-neon-deploy`
**Created**: 2026-06-07
**Status**: Implemented
**Input**: User description: "Make the project ready for Render + Neon deployment."

## Goal

Ship the LYOSINT monorepo to a production deployment on **Render** (single Docker Web Service) backed by a **Neon** serverless PostgreSQL instance, without breaking the existing local-dev / Replit workflows.

The API and the React SPA are served from **one** Express process: `/api/*` is routed to the API handlers, and everything else falls through to the built Vite static assets with an SPA fallback to `index.html`.

## User Scenarios & Testing

### User Story 1 - One-service Render deploy (Priority: P1)

A maintainer pushes the repo to GitHub, creates a single Render Web Service from it, sets the secret env vars, and gets a working stack in one deploy. The site and the API share the same origin (no CORS, no cross-service networking).

**Why this priority**: This is the entire point of the feature. Without it, deployment is manual and error-prone.

**Independent Test**: Render detects the Dockerfile at the repo root, builds the full workspace, and starts the API process. `https://<service>.onrender.com/` serves the React SPA and `https://<service>.onrender.com/api/health` returns `{ "status": "ok" }`.

**Acceptance Scenarios**:
1. **Given** the repo is on GitHub, **When** a Render Web Service is created from the repo, **Then** the service builds via Dockerfile and the API process starts on the assigned port.
2. **Given** `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` are set, **When** the service is deployed, **Then** `/api/health` returns `{ "status": "ok" }`.
3. **Given** the service is live, **When** a browser loads `https://<service>.onrender.com/`, **Then** the React SPA loads and all client-side routes work without 404s.
4. **Given** the service is live, **When** the Telegram bot webhook is set to `https://<service>.onrender.com/api/auth/bot-webhook`, **Then** bot-based login works end-to-end.

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

### User Story 4 - SPA served by API process (Priority: P1)

The same Express process serves the JSON API and the React SPA from one origin.

**Why this priority**: Eliminates the need for a second service, simplifies CORS, and reduces Render cost.

**Independent Test**: Loading `/` returns the SPA's `index.html`; loading `/platforms` also returns `index.html` (SPA fallback); loading `/api/health` returns JSON; loading `/api/admin/login` (POST) hits the API handler.

**Acceptance Scenarios**:
1. **Given** the Vite build output exists at `artifacts/lyosint/dist/public/`, **When** the API server starts, **Then** requests to non-`/api` paths serve the SPA assets or fall back to `index.html`.
2. **Given** the SPA bundle is in place, **When** the React app boots, **Then** it calls the API at relative `/api/...` paths (because `VITE_API_URL` is empty by default).

## Requirements

### Functional Requirements

- **FR-001**: `render.yaml` MUST declare a single `pserv` Web Service that builds via the project Dockerfile and starts the API process.
- **FR-002**: The API server MUST listen on `PORT` env var, defaulting to `10000` when unset.
- **FR-003**: The PG pool MUST enable SSL when `DATABASE_URL` contains `neon.tech` or `sslmode=require`.
- **FR-004**: The Vite config MUST default `PORT` to `19190` and `BASE_PATH` to `/` when those env vars are unset.
- **FR-005**: The frontend MUST send API requests to `VITE_API_URL` if set, and to relative `/api/...` when unset.
- **FR-006**: The API server MUST expose `GET /api/health` (and `/api/healthz`) returning `{ "status": "ok" }` for Render's health check.
- **FR-007**: The API server MUST serve the built Vite SPA as static files at `/*` with an SPA fallback to `index.html` for any non-`/api` GET that doesn't match a static file.
- **FR-008**: CORS MUST be configurable via `CORS_ORIGIN` (comma-separated origins, or `*`/unset for any origin).
- **FR-009**: `.env.example` files MUST be present at repo root and `artifacts/api-server/` documenting every required env var.
- **FR-010**: A `Dockerfile` MUST be present that builds the full workspace and starts the API process.
- **FR-011**: CI MUST run `pnpm run typecheck` and `pnpm run build` on every PR and push to `main`.
- **FR-012**: `README.md` MUST document the single-service deploy steps for Render + Neon, including the Neon pooler hostname requirement and the one-time Telegram webhook setup.
- **FR-013**: A Pre-Deploy Command MUST apply the Drizzle schema to the database before each deploy.

### Key Entities

- **Render Web Service (`render.yaml` / Dockerfile)**: Single deployable unit.
- **Neon connection string (`DATABASE_URL`)**: SSL-required PostgreSQL DSN.
- **Frontend config (`VITE_API_URL`)**: Optional absolute API origin; empty by default.
- **Telegram bot webhook**: One-time setup pointing to `/api/auth/bot-webhook`.

## Success Criteria

- **SC-001**: A new Render Web Service provisioned from this repo deploys the API + SPA in under 10 minutes with no manual config beyond secret env vars.
- **SC-002**: `pnpm run typecheck` passes with 0 errors after all changes.
- **SC-003**: `pnpm run build` produces both `artifacts/api-server/dist/index.mjs` and `artifacts/lyosint/dist/public/index.html` with 0 errors.
- **SC-004**: Local dev (`pnpm --filter @workspace/lyosint run dev` + `pnpm --filter @workspace/api-server run dev`) still works without any Render-specific env vars set.
- **SC-005**: A single `curl` to `https://<service>.onrender.com/api/health` returns `{ "status": "ok" }`, and a single `curl` to `https://<service>.onrender.com/` returns the SPA's `index.html`.

## Assumptions

- The Neon project uses the default `postgres` role and a single `neondb` database.
- The Telegram bot token belongs to a bot created via BotFather; the admin panel uses bcrypt-hashed passwords seeded on first boot.
- The user accepts the Render free-tier limitations (instances spin down after inactivity on the free plan).
- The existing `pnpm` workspace layout is preserved — no migration to a different package manager.
