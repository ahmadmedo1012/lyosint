# Tasks: Improving Search Performance + Wattpad Redirect Fix

**Input**: Design documents from `/specs/013-improving-search-performance/`
- plan.md (tech stack, structure)
- spec.md (user stories: US1 P1, US2 P1, US3 P2)
- research.md (5 decisions)
- data-model.md (Search Session, Platform Result, Redirect Event)

## Phase 1: Setup

**Purpose**: Verify baseline before optimization

- [ ] T001 Verify current build passes: `pnpm run build` with no fatal errors
- [ ] T002 Rebuild lib dist outputs: `rm -rf lib/db/dist lib/api-zod/dist lib/api-client-react/dist && pnpm run typecheck:libs`
- [ ] T003 Verify service health: `curl https://lyosint.onrender.com/api/health` returns `{"status":"ok"}`

---

## Phase 2: Foundational

**Purpose**: Prepare for performance tuning

- [ ] T004 [P] Baseline search timing: measure current Phase 1 (social) and Phase 2 (remaining) durations — document in `specs/013-improving-search-performance/benchmark.md`
- [ ] T005 [P] Identify current Wattpad redirect source: test Facebook non-existent profile redirect behavior and document findings
- [ ] T006 [P] Add `RedirectEvent` DB schema + migration — `lib/db/src/schema/searches.ts`

---

## Phase 3: User Story 1 - Fast Initial Results (Priority: P1) 🎯 MVP

**Goal**: Reduce Phase 1 from ~10-15s to ≤5s, first results visible within 3-5s

**Independent Test**: Search for username, verify social results appear within 5s with progress indicator

### Implementation

- [ ] T007 [P] [US1] Reduce Phase 1 WMN globalTimeoutMs from 15000 to 8000 — `artifacts/api-server/src/services/usernameSearch.ts`
- [ ] T008 [P] [US1] Increase Phase 1 concurrency from 30 to 40 — `artifacts/api-server/src/services/usernameSearch.ts`
- [ ] T009 [P] [US1] Reduce Phase 1 Maigret timeout from 6000 to 4000 and maxSites from 200 to 50 — `artifacts/api-server/src/services/usernameSearch.ts`
- [ ] T010 [US1] Verify Phase 2 still runs full Maigret (500 sites, 8000ms) after Phase 1 completes
- [ ] T011 [P] [US1] Add 3-second minimum delay before showing partial results to prevent UI flicker — `artifacts/lyosint/src/pages/search-result.tsx`
- [ ] T012 [P] [US1] Reduce frontend polling interval: empty state 1000ms, partial state 1500ms — `artifacts/lyosint/src/pages/search-result.tsx`

**Checkpoint**: User Story 1 complete — social results within 5s, no UI flicker

---

## Phase 4: User Story 2 - No More Wattpad Redirects (Priority: P1)

**Goal**: Identify root cause, fix cross-domain redirect detection, zero Wattpad URLs in results

**Independent Test**: Search for non-existent username, verify no Wattpad URLs appear, all cross-domain redirects marked as `not_found`

### Implementation

- [ ] T013 [US2] Add HTTP-level redirect detection: check `Location` header on 3xx before following — `artifacts/api-server/src/services/whatsmyname.ts`
- [ ] T014 [P] [US2] Add final URL hostname comparison: if `originalHost !== finalHost` → mark as `not_found` — `artifacts/api-server/src/services/whatsmyname.ts`
- [ ] T015 [P] [US2] Log redirect chain details (original URL, final URL, intermediate hops) for debugging — `artifacts/api-server/src/services/whatsmyname.ts`
- [ ] T016 [P] [US2] Add Facebook-specific content check: look for profile indicators in response body — `artifacts/api-server/src/services/whatsmyname.ts`
- [ ] T017 [US2] Update `RedirectEvent` entity with `redirectChain`, `detectionMethod`, `httpStatus` — `lib/db/src/schema/searches.ts`
- [ ] T018 [P] [US2] Save redirect events to database when cross-domain redirects are detected — `artifacts/api-server/src/services/usernameSearch.ts`

**Checkpoint**: User Story 2 complete — zero Wattpad URLs, all redirects logged and marked not_found

---

## Phase 5: User Story 3 - Reliable Progressive Rendering (Priority: P2)

**Goal**: Frontend renders partial results correctly, no stale data, smooth transitions

**Independent Test**: Multiple searches, verify partial results appear and update correctly, no duplicates

### Implementation

- [ ] T019 [P] [US3] Ensure frontend cancels old polls when new search starts — `artifacts/lyosint/src/pages/search-result.tsx`
- [ ] T020 [P] [US3] Add smooth transition animation when partial results → full results — `artifacts/lyosint/src/pages/search-result.tsx`
- [ ] T021 [P] [US3] Verify progress bar updates smoothly without jumping — `artifacts/lyosint/src/pages/search-result.tsx`

**Checkpoint**: User Story 3 complete — no stale data, smooth transitions, clean progressive rendering

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and deployment

- [ ] T022 [P] Run full benchmark: measure time-to-first-result, verify ≤5s for 90% of searches
- [ ] T023 [P] Test Wattpad redirect fix: search 10 non-existent usernames, verify zero Wattpad URLs
- [ ] T024 [P] Run `pnpm run typecheck` — confirm 0 errors
- [ ] T025 Run `pnpm run build` — confirm succeeds
- [ ] T026 Verify Render deploy succeeds and health check passes
- [ ] T027 Document performance improvements and Wattpad fix in `specs/013-improving-search-performance/benchmark.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — provides baseline measurements
- **User Stories (Phase 3+)**: All depend on Foundational
  - US1 (P1) and US2 (P1) can proceed in parallel after Foundational
  - US3 (P2) depends on US1 (needs partial results structure)
- **Polish (Final Phase)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent — can start after Foundational
- **US2 (P1)**: Independent — can start after Foundational (parallel with US1)
- **US3 (P2)**: Dependent on US1 (builds on partial results rendering)

### Within Each Story

- Backend changes before frontend integration
- Core implementation before polish

---

## Parallel Opportunities

- T004, T005, T006 (all research/diagnostic, can run in parallel)
- T007, T008, T009, T011 (all different config changes in usernameSearch.ts, parallel)
- T013, T015, T016, T017 (all different changes in whatsmyname.ts + schema, parallel)
- T019, T020, T021 (all frontend rendering improvements, parallel)
- T022, T023, T024, T025, T026 (all verification tasks, parallel)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 (baseline established)
2. Phase 3 (US1) → tune timeouts, increase concurrency, reduce polling
3. **STOP**: Test US1 — first results within 5s
4. **Deploy/Demo**: Measurable speedup visible

### Incremental Delivery

1. Setup + Foundational → baseline measured
2. + US1 → speed optimization (5s target)
3. + US2 → Wattpad fix (zero bad URLs)
4. + US3 → rendering polish (no flicker, smooth transitions)
5. Each story adds value independently

### Suggested MVP Scope

**Minimum**: Phase 1 + Phase 2 + Phase 3 (US1 only)
- Timeout and concurrency tuning: ~2 hours
- Immediate measurable improvement (5s vs 15s)
