# Implementation Plan: Improving Search Performance + Wattpad Redirect Fix

**Branch**: `013-improving-search-performance` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-improving-search-performance/spec.md`

## Summary

Improve search performance by reducing time-to-first-result from ~20s to under 5s, and fix the Wattpad redirect bug at its root cause. The incremental search architecture (Phase 1 + Phase 2) is already in place — this plan focuses on tuning timeout values, optimizing the fast path, and correctly identifying which platform triggers the Wattpad redirect.

## Technical Context

**Language/Version**: Node.js 20, TypeScript 5.x, Python 3.12, React 18

**Primary Dependencies**: Express, Drizzle ORM, pnpm workspaces, Vite, ShadCN/ui, TanStack Query, Maigret

**Storage**: PostgreSQL (Neon) via Drizzle ORM

**Testing**: Manual verification via Render deployment + typecheck (`tsc --noEmit`) + targeted integration tests

**Target Platform**: Linux server (Render.com), responsive web (320px–2560px)

**Project Type**: Web service (monorepo: api-server + lyosint frontend)

**Performance Goals**: First results ≤5s (90th percentile), zero Wattpad URLs, zero unhandled crashes

**Constraints**: Render free tier, Python subprocess overhead, external API rate limits

**Scale/Scope**: Single-user search sessions, ~500 platform checks per search

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

PASS: Constitution is a placeholder template with no defined principles. No gates to enforce. Proceeding.

## Project Structure

### Documentation (this feature)

```text
specs/013-improving-search-performance/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
artifacts/
├── api-server/
│   └── src/
│       ├── routes/
│       │   ├── search.ts          # Search endpoints (validation, progress)
│       │   └── auth.ts            # Authentication
│       ├── services/
│       │   ├── usernameSearch.ts  # Incremental search (Phase 1 + Phase 2)
│       │   ├── whatsmyname.ts     # WMN checker + redirect detection
│       │   ├── httpChecker.ts     # Verified platform checks
│       │   ├── maigret.ts         # Python subprocess wrapper
│       │   └── freeApis.ts        # HIBP, Twitch, etc.
│       └── index.ts               # Express entry point
├── lyosint/
│   └── src/
│       ├── pages/
│       │   ├── search-result.tsx  # Results page (progressive rendering)
│       │   └── ...                # Other pages
│       └── components/
│           └── ui/                # ShadCN components
lib/
├── db/
│   └── src/
│       └── schema/
│           └── searches.ts       # Search session schema
└── api-zod/
scripts/
└── maigret_runner.py              # Python Maigret wrapper
Dockerfile
render.yaml
```

**Structure Decision**: Existing monorepo structure preserved. Changes are localized to `usernameSearch.ts`, `whatsmyname.ts`, and `search-result.tsx`.

## Complexity Tracking

> No constitution violations. No complexity to track.
