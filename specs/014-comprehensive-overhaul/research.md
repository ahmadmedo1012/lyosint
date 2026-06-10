# Research: Comprehensive Project Overhaul

**Phase 0 output** — Bottleneck analysis, UI audit, and design decisions

## Performance Bottlenecks

### Critical — Fix Immediately

| # | Bottleneck | Location | Impact |
|---|-----------|----------|--------|
| 1 | Phase 2 sequential: WMN full scan → then Maigret full scan | `usernameSearch.ts:77→87` | ~60s added to worst-case latency — both can run in parallel |
| 2 | No global timeout on Phase 1 `Promise.allSettled` | `usernameSearch.ts:30-42` | A single hanging API stalls the entire search indefinitely |
| 3 | No body-read timeout in `httpChecker.ts` and `githubOsint.ts` | `httpChecker.ts:454`, `githubOsint.ts:25` | `res.json()` can hang forever if server trickles data |

### Medium Priority

| # | Bottleneck | Location | Impact |
|---|-----------|----------|--------|
| 4 | 6 individual DB writes per username search (no batching) | `usernameSearch.ts:16,70,112,120,139,147` | ~6x DB round-trips when 1-2 batched writes would suffice |
| 5 | Unbounded Map caches (no eviction, no max size) | `httpChecker.ts:590`, `freeApis.ts:12` | Memory leak under sustained load with unique queries |
| 6 | Settings full table scan on every stale-cache read | `settingsService.ts:181` | Reads ALL rows instead of keyed lookup |

### Low Priority

| # | Bottleneck | Location | Impact |
|---|-----------|----------|--------|
| 7 | Triple sequential DB ops per POST (insert→increment→select) | `routes/search.ts:35-38` | Adds ~20ms to request startup before search begins |
| 8 | Breach checks run after GitHub enrichment (no dependency) | `usernameSearch.ts:114-125` | Breach APIs could start in parallel with GitHub |
| 9 | No WMN result caching across searches | `whatsmyname.ts:293-352` | Every unique username rechecks all 732 sites |

### Not Bottlenecks

- Correlation engine: pure CPU, O(n²) clustering on small N, fast
- Maigret subprocess: 200ms startup + 8s timeout — acceptable for what it does
- Frontend rendering: no heavy computation or re-render loops detected

## Caching Analysis

### Current State

| Cache | Type | TTL | Eviction | Risk |
|-------|------|-----|----------|------|
| HTTP checker results | In-memory Map | 60s | None | Unbounded growth |
| Free APIs results | In-memory Map | 30s-24h | None | Unbounded growth |
| Session tokens | In-memory Map | 5min | Max 1000 | Adequate |
| Settings DB rows | In-memory Map | 30s | None | Low (few keys) |
| Maigret paths | Variables | Forever | None | Acceptable |

### Recommended Changes

1. **Add LRU eviction** to `httpResultCache` and `freeApisCache` (max 1000 entries each)
2. **Add WMN result cache**: key = `wmn:{username}`, TTL = 30min, max 500 entries
3. **Add request-level dedup**: if same username searched twice in <5s, reuse inflight promise

## External API Timeout Analysis

| API | Current Timeout | Body Read Timeout | Recommended |
|-----|----------------|-------------------|-------------|
| httpChecker (32 platforms) | 5s fetch | ❌ None | Add 3s on body read |
| GitHub API | 6s fetch | ❌ None | Add 3s on body read |
| Free APIs (Twitch, Hunter, HIBP, etc.) | 6s fetch (varies) | ❌ None per-API | Add 3s on body read |
| WhatsMyName (732 sites) | Per-worker timeout | ✅ Handled | Acceptable |
| Maigret | Up to 120s | ✅ Handled | Acceptable |

## Frontend UI Audit

### Per-Page Coverage

| Page | Skeleton Loaders | Error Handling | RTL | Animations | Blank During Load? |
|------|-----------------|----------------|-----|------------|-------------------|
| dashboard.tsx | ✅ | ⚠️ Missing stats/recent errors | ✅ | ✅ | No |
| search-result.tsx | ✅ | ✅ | ✅ | ✅ | No |
| history.tsx | ✅ | ❌ Missing error state | ✅ | ✅ | No |
| account.tsx | ❌ **Blank screen** | ❌ | ✅ | ✅ | **YES** |
| admin.tsx | ⚠️ Spinners only | ⚠️ Partial | ✅ | ✅ | No |
| platforms.tsx | ✅ | ❌ Missing error state | ✅ | ✅ | No |

### Critical Issues

1. **account.tsx:34** — `if (!user) return null` → renders blank while auth loads. Fix: show skeleton
2. **App.tsx:29-31** — Admin page is rendered OUTSIDE `ErrorBoundary`. Fix: move inside
3. **Empty catch blocks**: admin.tsx ServicesTab + SystemConfigTab swallow errors silently
4. **Missing error states**: history.tsx, platforms.tsx, dashboard.tsx (stats) show empty/zero data instead of errors

## Architecture Decisions

### Parallel Phasing Strategy
- **Decision**: Keep current phase structure (Phase 1 = initial checks, Phase 2 = deep scan) but run WMN full scan + Maigret large scan **in parallel** instead of sequentially
- **Rationale**: Both are independent HTTP-heavy operations; no data dependency between them
- **Risk**: Higher peak memory/connection usage but typical searches won't need both full scans anyway

### Real-Time Status
- **Decision**: Use **polling** (not WebSocket or SSE) — simpler, no infrastructure change, already partially implemented
- **Rationale**: The TanStack Query `refetchInterval` already provides polling; WebSocket adds deployment complexity for negligible benefit at this scale
- **Improvement**: Increase poll frequency from 1s → 500ms during active search; add phase/progress percentage to status response

## Key Technical Assumptions

- External API timeouts should be **connection + body-read** (not just connection)
- Caches should use **LRU eviction** with configurable max-size (not TTL-only)
- The frontend `@workspace/api-client-react` auto-generated hooks do not support WebSocket — polling is the only option without ejecting
- Maigret install (pip) can be moved to Dockerfile to avoid first-request latency
- All visual changes must use existing Tailwind v4 + shadcn/ui design system
