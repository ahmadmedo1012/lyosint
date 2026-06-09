# Tasks: Search Speedup & Professional UI

**Input**: Design documents from `/specs/003-search-speedup/`
- plan.md (tech stack, structure)
- spec.md (user stories: US1 P1, US2 P1, US3 P2)
- research.md (5 decisions)
- data-model.md (Search Session, Profile Result entities)
- contracts/api-contracts.md (REST endpoints)
- quickstart.md (testing guide)

## Phase 1: Setup

**Purpose**: Verify project is ready for feature work

- [ ] T001 Verify all environment variables are set on Render (DATABASE_URL, TELEGRAM_BOT_TOKEN, ADMIN_PASSWORD, VITE_API_URL)
- [ ] T002 Rebuild lib dist outputs: `rm -rf lib/db/dist lib/api-zod/dist lib/api-client-react/dist && pnpm run typecheck:libs`

---

## Phase 2: Foundational

**Purpose**: Core infrastructure that MUST be stable before user stories work

- [ ] T003 [P] Clear all implicit-any typecheck errors in api-server (`pnpm run typecheck` shows 0 errors)
- [ ] T004 [P] Clear all implicit-any typecheck errors in lyosint frontend
- [ ] T005 Verify `build.sh` debug script is removed from repo root and Dockerfile is restored to working multi-stage version
- [ ] T006 Verify `render.yaml` matches active service config: type=pserv, runtime=docker, plan=starter, healthCheckPath=/api/health
- [ ] T007 Test local build completes: `pnpm run build` with no fatal errors

---

## Phase 3: User Story 1 - Fast Social Media Results (Priority: P1) 🎯 MVP

**Goal**: Social media profiles appear within 10 seconds while background search continues for remaining platforms

**Independent Test**: Search for a known username, verify social profiles appear within 10s with "preliminary" badge, then additional platforms load progressively

### Implementation

- [x] T008 [P] [US1] Verify `usernameSearch.ts` Phase 1 saves partial results at 25% progress — `artifacts/api-server/src/services/usernameSearch.ts`
- [x] T009 [P] [US1] Verify `buildProfilesMap` helper handles maigret + twitch + WMN merging — `artifacts/api-server/src/services/usernameSearch.ts`
- [x] T010 [P] [US1] Verify Phase 1 uses SOCIAL_WMN_SITES list (45 priority sites) — `artifacts/api-server/src/services/usernameSearch.ts:19-27`
- [x] T011 [US1] Verify Phase 2 runs remaining WMN sites + full Maigret + enrichments after Phase 1 completes
- [x] T012 [P] [US1] Add Facebook cross-domain redirect detection in `checkOneSite` — `artifacts/api-server/src/services/whatsmyname.ts:157-169`
- [x] T013 [P] [US1] Update `wmnResultToPlatformResult` to mark cross-redirects as not_found — `artifacts/api-server/src/services/whatsmyname.ts:331-358`
- [x] T014 [P] [US1] Add `redirectTarget` field to `WMNResult` interface and `SiteResult` interface — `artifacts/api-server/src/services/whatsmyname.ts:32-102`
- [x] T015 [US1] Verify frontend renders partial results during `running` state — `artifacts/lyosint/src/pages/search-result.tsx`
- [x] T016 [US1] Add amber "نتائج أولية — جاري البحث عن المزيد..." badge during progressive search — `artifacts/lyosint/src/pages/search-result.tsx`
- [x] T017 [US1] Configure TanStack Query refetchInterval: 1500ms when empty, 2000ms when partial results exist — `artifacts/lyosint/src/pages/search-result.tsx`

**Checkpoint**: User Story 1 complete — social results appear fast, progressive rendering works, Facebook redirect fixed

---

## Phase 4: User Story 2 - Reliable Tool Operation (Priority: P1)

**Goal**: All four OSINT tools execute without crashes and return meaningful results or clear errors

**Independent Test**: Run username, name, phone, deep search end-to-end; verify results or Arabic error within 60s

### Implementation

- [ ] T018 [P] [US2] Add input validation for username search: non-empty, max length check — `artifacts/api-server/src/routes/search.ts`
- [ ] T019 [P] [US2] Add input validation for phone search: Libyan format validation — `artifacts/api-server/src/services/phoneSearch.ts`
- [ ] T020 [P] [US2] Add input validation for name search: minimum 2 characters — `artifacts/api-server/src/services/nameSearch.ts`
- [x] T021 [US2] Verify all search endpoints return Arabic error messages on failure (FR-005) — implemented in API route error handlers
- [x] T022 [P] [US2] Verify progress updates during search: 5% → 25% (Phase1 partial) → 55% → 68% → 88% → 100% — `artifacts/api-server/src/services/usernameSearch.ts`
- [x] T023 [P] [US2] Add error boundary / try-catch in runUsernameSearch to prevent unhandled crashes (FR-004) — already implemented at lines 14, 157
- [x] T024 [P] [US2] Verify Maigret fallback when Python unavailable: returns empty result gracefully — `artifacts/api-server/src/services/maigret.ts` (isMaigretAvailable check + .catch)

**Checkpoint**: All four tools run reliably with validation and error handling

---

## Phase 5: User Story 3 - Professional Interface (Priority: P2)

**Goal**: Polished Arabic RTL interface with responsive design, smooth animations, consistent styling

**Independent Test**: Review on desktop/mobile/tablet, verify Arabic RTL, responsive layout, smooth animations

### Implementation

- [x] T025 [P] [US3] Fix remaining typecheck errors in `dashboard.tsx` (lines 232) — typed map callbacks — `artifacts/lyosint/src/pages/dashboard.tsx`
- [x] T026 [P] [US3] Fix remaining typecheck errors in `history.tsx` (line 47) — typed map callback — `artifacts/lyosint/src/pages/history.tsx`
- [x] T027 [P] [US3] Fix remaining typecheck errors in `platforms.tsx` (lines 37,46,75,119) — typed callbacks — `artifacts/lyosint/src/pages/platforms.tsx`
- [x] T028 [P] [US3] Fix remaining typecheck errors in `search-result.tsx` (lines 228,240,353) — typed map params — `artifacts/lyosint/src/pages/search-result.tsx`
- [x] T029 [US3] Verify dir="rtl" applied to all Arabic pages (dashboard, history, platforms, search-result, account, admin)
- [x] T030 [P] [US3] Verify responsive CSS breakpoints: 320px, 768px, 1440px across all pages
- [x] T031 [P] [US3] Verify animation performance: no layout shifts during progressive result loading

**Checkpoint**: Zero typecheck errors, full RTL support, responsive on all viewports

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting all user stories

- [ ] T032 [P] Verify Docker build succeeds on Render (multi-stage, ~3.5min)
- [ ] T033 [P] Verify health endpoint returns `{"status":"ok"}` after deploy
- [ ] T034 Verify incremental search benchmark: 90% of searches show social results within 10s
- [ ] T035 Run `pnpm run build` and `pnpm run typecheck` — confirm 0 errors
- [ ] T036 Document remaining pre-existing typecheck issues in non-modified files (if any)
- [ ] T037 Push feature branch and trigger Render deploy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup
- **User Stories (Phase 3+)**: All depend on Foundational
  - US1 (P1) and US2 (P1) can proceed in parallel after Foundational
  - US3 (P2) can proceed after Foundational
- **Polish (Final Phase)**: Depends on desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent — can start after Foundational
- **US2 (P1)**: Independent — can start after Foundational (parallel with US1)
- **US3 (P2)**: May reference US1/US2 UI patterns but independently testable

### Within Each Story

- Models/helpers before endpoints
- Backend before frontend integration
- Core implementation before polish

---

## Parallel Opportunities

- T003, T004 (different files, can run in parallel)
- T008, T009, T010, T012, T013, T014 (all different files, US1 parallel)
- T018, T019, T020, T022, T023, T024 (all different files, US2 parallel)
- T025, T026, T027, T028, T029, T030, T031 (all different files, US3 parallel)
- T032, T033, T035, T036 (all independent verification tasks)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 (infrastructure ready)
2. Phase 3 (US1) → incremental search + Facebook fix + progressive UI
3. **STOP**: Test US1 independently — social results within 10s
4. **Deploy/Demo**: Feature is usable

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → MVP (fast social results, progressive rendering)
3. + US2 → reliability (validation, error handling, all 4 tools stable)
4. + US3 → polish (typecheck clean, RTL perfect, responsive)
5. Each story adds value without breaking previous

### Suggested MVP Scope

**Minimum**: Phase 1 + Phase 2 + Phase 3 (US1 only)
- Already 80% implemented in codebase
- Remaining: verify, polish edge cases, deploy
