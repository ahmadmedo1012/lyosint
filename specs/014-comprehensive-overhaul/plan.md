# Implementation Plan: Comprehensive Project Overhaul

**Branch**: `014-comprehensive-overhaul` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-comprehensive-overhaul/spec.md`

## Summary

Overhaul LYOSINT's search performance (target: initial visible results within 5s) and UI polish (skeleton loaders, smooth transitions, RTL consistency, responsive design) across the full-stack monorepo. Backend: parallelize external API calls, enforce timeouts, tune caching. Frontend: add loading skeletons to every page, implement page transitions, ensure consistent ErrorBoundary coverage, and audit responsive/RTL correctness.

## Technical Context

**Language/Version**: TypeScript 5.x (backend Node.js/Express, frontend React 18)

**Primary Dependencies**: Express, better-sqlite3 (backend); React, wouter, TanStack Query, Tailwind CSS v4, shadcn/ui, Framer Motion, `@workspace/api-client-react` (auto-generated API client)

**Storage**: SQLite via better-sqlite3; in-memory session cache (Map with 5-min TTL)

**Testing**: Vitest (backend unit tests); no frontend test framework detected

**Target Platform**: Modern web browsers (Chrome/Firefox/Safari last 2 major versions), Linux server

**Project Type**: Full-stack web application (monorepo with pnpm workspaces: `artifacts/api-server` + `artifacts/lyosint`)

**Performance Goals**: Initial search results visible within 5s (user click → first meaningful content on screen); page navigations render in <500ms; 5 concurrent searches with <2x single-user degradation

**Constraints**: RTL-first Arabic UI; dark theme only; existing Tailwind v4 + shadcn ecosystem; external API timeouts default 10s; retry failed external calls once with exponential backoff

**Scale/Scope**: Single-server deployment; expected concurrent users <50; DB size <500 search entries per user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The `.specify/memory/constitution.md` is a template with no project-specific constraints filled in. No constitutional gates apply.

## Project Structure

### Documentation (this feature)

```text
specs/014-comprehensive-overhaul/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (speckit.tasks)
```

### Source Code (repository root)

```text
artifacts/api-server/
├── src/
│   ├── routes/          # Express route handlers
│   ├── services/        # Business logic (correlation, maigret, etc.)
│   ├── middleware/      # Auth, error handling
│   └── lib/             # Utilities, DB client, cache
└── package.json

artifacts/lyosint/
├── src/
│   ├── pages/           # Page components (dashboard, search-result, admin, etc.)
│   ├── components/      # Shared UI (layout, search/, paywall, etc.)
│   ├── hooks/           # Custom hooks (use-toast, etc.)
│   ├── contexts/        # Auth, Theme providers
│   └── lib/             # Constants, utilities
├── package.json
└── tsconfig.json
```

**Structure Decision**: Keep existing monorepo layout — no structural changes needed for this overhaul.

## Complexity Tracking

No constitution violations — complexity tracking not required.

## Phase 0: Research

The following unknowns need research before design decisions can be finalized:

1. **Where are the real performance bottlenecks?** — Backend API call timing, DB query profiling, frontend render profiling
2. **Which external APIs are the slowest?** — maigret, GitHub, Telegram, Instagram response times
3. **What is the current caching effectiveness?** — Cache hit rates, TTL configuration, stale data frequency
4. **What frontend pages still lack skeleton loaders?** — Audit all page components for loading states
5. **Is WebSocket or SSE feasible for real-time search status?** — Current polling interval vs real-time alternatives
6. **What are current page render times?** — Baseline metrics before optimization

See [research.md](./research.md) for findings.
