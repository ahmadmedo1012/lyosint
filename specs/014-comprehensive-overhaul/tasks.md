# Tasks: Comprehensive Project Overhaul

**Input**: Design documents from `specs/014-comprehensive-overhaul/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No test framework detected for frontend; backend uses Vitest. Test tasks are included only where explicitly valuable.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **API server**: `artifacts/api-server/src/`
- **Frontend**: `artifacts/lyosint/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify tooling, add shared utilities needed by all stories

- [X] T001 Create LRU cache utility in `artifacts/api-server/src/lib/cache.ts` with max-size eviction and TTL support
- [X] T002 [P] Add `safeJsonFetch()` utility in `artifacts/api-server/src/lib/safeFetch.ts` with connection timeout (6s) + body-read timeout (3s)
- [X] T003 [P] Create `StatusResponse` type in `artifacts/lyosint/src/lib/types.ts` with `timingMs` and `progress` fields

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix shared infrastructure that blocks BOTH backend and frontend stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Apply LRU cache (max 1000) to `httpResultCache` in `artifacts/api-server/src/services/httpChecker.ts:590`
- [X] T005 [P] Apply LRU cache (max 1000) to `freeApisCache` in `artifacts/api-server/src/services/freeApis.ts:12`
- [X] T006 [P] Add body-read timeout to `httpChecker.ts:454` (Promise.race with 3s timeout on res.json())
- [X] T007 [P] Add body-read timeout to `githubOsint.ts:25` (Promise.race with 3s timeout on res.json())
- [X] T008 Wrap admin route in ErrorBoundary in `artifacts/lyosint/src/App.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Instant Search Results (Priority: P1) 🎯 MVP

**Goal**: Users see initial search results within 5 seconds by parallelizing phase 2, adding timeouts, and eliminating sequential bottlenecks

**Independent Test**: Submit a username search on a standard connection — first meaningful results (any platform match) appear within 5 seconds on screen

### Implementation for User Story 1

- [X] T009 [P] [US1] Run WMN full scan + Maigret large scan in parallel in `artifacts/api-server/src/services/usernameSearch.ts`
- [X] T010 [P] [US1] Add global timeout (15s) to Phase 1 `Promise.allSettled` in `artifacts/api-server/src/services/usernameSearch.ts`
- [ ] T011 [US1] Add per-platform `responseTimeMs` to platform results in `artifacts/api-server/src/services/usernameSearch.ts`
- [ ] T012 [US1] Add `timingMs` to search status response in `artifacts/api-server/src/routes/search.ts` (requires DB schema migration)
- [X] T013 [US1] Add `progress.percentage` — Already works (progress field is 0-100, frontend already displays it as percentage)

**Checkpoint**: At this point, US1 should be fully functional and independently testable via search-result page

---

## Phase 4: User Story 2 — Polished Visual Experience (Priority: P1)

**Goal**: All pages show skeleton loaders during loading, smooth transitions, proper RTL, and no blank screens

**Independent Test**: Navigate through all major pages (dashboard, search-result, history, account, admin, platforms) — each shows skeleton content while loading, smooth transitions, and RTL layout

### Implementation for User Story 2

- [X] T014 [P] [US2] Add skeleton loading state to `account.tsx:33` (replace `if (!user) return null` with skeleton layout)
- [X] T015 [US2] Add error state UI to `history.tsx` for failed `useListRecentSearches` (error banner + retry)
- [X] T016 [US2] Add error state UI to `platforms.tsx` for failed `useGetPlatformCoverage` (error banner + retry)
- [X] T017 [P] [US2] Add error state UI to `dashboard.tsx` for failed `useGetStats` / `useListRecentSearches`
- [X] T018 [P] [US2] Replace `Loader2` spinners with `Skeleton` in `admin.tsx` ServicesTab, SystemConfigTab, UsersTab
- [X] T019 [P] [US2] Fix empty `catch {}` blocks in `admin.tsx` ServicesTab and SystemConfigTab
- [X] T020 [US2] Add user-facing error message to `paywall-modal.tsx` subscription flow

**Checkpoint**: At this point, US2 should be independently verifiable — browse all pages, trigger loading states, see skeletons and errors

---

## Phase 5: User Story 3 — Reliable System Under Load (Priority: P2)

**Goal**: System handles 5 concurrent searches without degradation exceeding 2x single-user time

**Independent Test**: Trigger 5 concurrent username searches via API — all complete within 10 seconds

### Implementation for User Story 3

- [X] T021 [US3] Add settings cache keyed lookup (not full table scan) in `artifacts/api-server/src/services/settingsService.ts` — use `db.select().from(settingsTable).where(eq(settingsTable.key, key))` instead of scanning all rows
- [X] T022 [US3] Add request-level deduplication in `artifacts/api-server/src/services/usernameSearch.ts` — if same username searched within 5s, reuse inflight promise
- [X] T023 [P] [US3] Batch DB writes in `usernameSearch.ts` — combine progress=55 + progress=68 writes into single update
- [X] T024 [US3] Reduce sequential DB ops in `routes/search.ts` — inline response construction, sql`count + 1` for atomic increment
- [X] T025 [US3] Add `MAIGRET_PREINSTALLED` env var to Dockerfile; skip pip install when set in `maigret.ts`

**Checkpoint**: US3 — backed by typecheck (api-server: 1 pre-existing error, lyosint: 0 errors)

---

## Phase 6: User Story 4 — Transparent Status Feedback (Priority: P2)

**Goal**: Users see real-time progress during searches (phase name, percentage, platform count) instead of a generic spinner

**Independent Test**: Submit a search — the result page shows live status like "Scanning social networks (12/40 platforms checked)" with progress percentage

### Implementation for User Story 4

- [ ] T026 [US4] Increase poll frequency during active search: change `refetchInterval` from 1000ms → 500ms in `artifacts/lyosint/src/pages/search-result.tsx` status query
- [X] T027 [US4] Display progress percentage and phase name from status response — **already works**: search-result.tsx shows progress bar + percentage + platform count
- [X] T028 [US4] Add platform-checked counter to status — **already works**: `platformsSearched` and `platformsTotal` tracked in usernameSearch.ts, displayed in search-result.tsx
- [ ] T029 [US4] Show per-section timing breakdown in completed search result UI (depends on T011/T012)

**Checkpoint**: US4 independently testable — search result page shows live progress updates and per-section timing

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T030 [P] Run full TypeScript check — `pnpm run typecheck` in both `artifacts/api-server` (1 pre-existing error) and `artifacts/lyosint` (0 errors)
- [ ] T031 [P] Final visual polish pass — audit all shadows, border-radiuses, font scaling on mobile (360px viewport)
- [X] T032 Add `Skeleton` import and usage to any remaining component that shows `Loader2` for data loading (no remaining data-loading Loader2 instances)
- [ ] T033 [P] Validate no page shows blank screen during any loading state (audit all `if (!data) return null` patterns)
- [ ] T034 Run `git status` and commit all changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 & US2 (Phase 3 & 4)**: Can start in parallel after Foundational (P1 stories)
- **US3 & US4 (Phase 5 & 6)**: Depend on US1 backend changes (parallel execution, timeouts)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — independent of US1 (frontend-only changes)
- **US3 (P2)**: Depends on US1 backend infrastructure (timeout utils, cache utils)
- **US4 (P2)**: Depends on US1 backend changes (progress tracking, timing)

### Within Each User Story

- Infrastructure utilities before component changes
- Backend changes before frontend consumption
- Core implementation before polish

### Parallel Opportunities

- T001, T002, T003 can run in parallel (all new files, different directories)
- T004, T005, T006, T007, T008 can run in parallel (different files)
- T009, T010 can run in parallel (same file, different lines, no merge conflict)
- US1 (backend perf) and US2 (frontend UI) can run in FULL PARALLEL by different developers
- All T014-T020 (US2 frontend) can run in parallel (different page files)
- T021-T025 (US3) depend on US1 — run after US1, can parallelize internally

---

## Parallel Example: US1 + US2 (P1 stories in parallel)

```bash
# Developer A: US1 — Backend performance
Task: "Run WMN + Maigret in parallel in usernameSearch.ts"
Task: "Add Phase 1 global timeout in usernameSearch.ts"
Task: "Add responseTimeMs to platform results"

# Developer B: US2 — Frontend UI
Task: "Fix account.tsx blank screen — add skeleton"
Task: "Add error states to history.tsx, platforms.tsx, dashboard.tsx"
Task: "Replace admin spinners with skeletons"
Task: "Fix empty catch blocks in admin.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (backend performance) — search results in 5s
4. Complete Phase 4: US2 (frontend UI polish) — skeletons, errors, no blank screens
5. **STOP and VALIDATE**: Run typecheck, test search flow end-to-end
6. Deploy/demo

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (P1) → Search actually feels fast → Test independently → Deploy
3. US2 (P1) → UI actually looks polished → Test independently → Deploy
4. US3 (P2) → Handles load → Test independently → Deploy
5. US4 (P2) → Status transparency → Test independently → Deploy

### Parallel Team Strategy

1. Complete Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 + US3 (backend — US3 builds on US1)
   - Developer B: US2 + US4 (frontend — US4 builds on US1's progress API)
3. Merge and integrate weekly
