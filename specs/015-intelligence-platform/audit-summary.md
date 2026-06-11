# Comprehensive Audit Summary — LYOSINT Intelligence Platform

## Files Audited (36 total)

### API Server (16 files)
| File | Lines | Key Finding |
|---|---|---|
| `app.ts` | 61 | Clean Express setup, pino-http, CORS, SPA serving |
| `index.ts` | 64 | Telegram webhook startup, SIGTERM handler |
| `requireAuth.ts` | 81 | **`incrementSearchCount` not using atomic SQL**; session cache clears all at 1000 |
| `routes/index.ts` | 16 | Route wiring |
| `routes/auth.ts` | — | Telegram auth (HMAC-SHA256), free quota |
| `routes/search.ts` | — | Optimized in T024 (atomic increment, no select-back) |
| `routes/admin.ts` | — | Admin auth (timingSafeCompare), session mgmt |
| `routes/health.ts` | 14 | Simple health check |
| `routes/stats.ts` | 97 | **Hardcoded platform list** (55 platforms) |
| `httpChecker.ts` | 634 | LRU cache, body-read timeout, 37 verified + 43 manual platforms |
| `usernameSearch.ts` | 359 | Request dedup (5s), parallel Phase 2, Phase 1 timeout (15s) |
| `correlationEngine.ts` | 566 | Identity resolution, evidence model, Arabic summaries |
| `whatsmyname.ts` | 384 | 732 sites, configurable concurrency |
| `maigret.ts` | 325 | Python subprocess, MAIGRET_PREINSTALLED support |
| `freeApis.ts` | 421 | 10+ API wrappers, per-API LRU caching |
| `settingsService.ts` | — | Per-key cache, `invalidateCache(key?)` |

### DB Package (6 files)
| File | Lines | Key Finding |
|---|---|---|
| `schema/searches.ts` | — | JSONB result columns, progress 0-100 |
| `schema/users.ts` | — | Telegram auth, subscription tracking |
| `schema/settings.ts` | — | Key-value, isSecret flag |
| `schema/pendingLogins.ts` | — | Login token with expiry |
| `index.ts` | 26 | Pool max 10 (default), Neon SSL |

### Frontend (10 files)
| File | Lines | Key Finding |
|---|---|---|
| `App.tsx` | 86 | AuthGate, route config, ErrorBoundary wrap |
| `layout.tsx` | 246 | Sidebar, user card, quota meter, theme switcher |
| `contexts/auth.tsx` | — | Telegram login, session persistence |
| `contexts/theme.tsx` | 38 | 3 dark themes, localStorage persistence |
| `pages/dashboard.tsx` | — | Search forms, stats, PaywallModal |
| `pages/search-result.tsx` | — | 500ms polling, IdentityReport integration |
| `pages/history.tsx` | 172 | Skeleton loading, error states, confidence coloring |
| `pages/platforms.tsx` | 174 | Search filter, skeleton loading, categories |
| `pages/admin.tsx` | — | 6 tabs with Skeleton loading states |
| `components/identity-report.tsx` | — | Confidence bar, evidence list, conflict detection |

## Unresolved Issues (25 Total)

### P0 — Critical (Fix Now)
1. **`incrementSearchCount` not using atomic SQL** (`requireAuth.ts:76-81`)
2. **No IP rate limiting** on unprotected endpoints (`/search/:id`, `/search/:id/status`)
3. **API keys in plain text DB** (`settings.isSecret` flag only, no encryption)
4. **No worker queue** — all searches in-process, lost on restart
5. **Session cache full clear at 1000** — not LRU

### P1 — High (Phase 0-1)
6. **No entity persistence** — ephemeral IdentityReport per search
7. **No cross-search correlation** — each search starts from zero
8. **Drizzle pool default (10)** — starvation under load
9. **Stats platform list hardcoded** — risk of drift
10. **Settings type coercion** — single TEXT column for all types

### P2 — Medium (Phase 2-3)
11. **Correlation engine blocks event loop** — 50-200ms synchronous CPU
12. **19 DB writes per search** — partially mitigated by batching
13. **Large search result payload** — up to 2MB JSON
14. **500ms polling at scale** — acceptable now, issue at 10k+ users
15. **Telegram webhook delays startup** — `await` in listen callback
16. **Transliteration map limited** — only 8 Arabic→English entries
17. **No search timeout at Express level** — only Phase 1 internal timeout
18. **Deep search sub-errors swallowed** — no error propagation
19. **No graceful shutdown for in-flight searches** — SIGTERM only closes HTTP

### P3 — Low (Phase 4+)
20. **Correlation tests don't cover Arabic summary** — 4 tests, all English
21. **No integration tests** — only unit tests for correlation engine
22. **Admin sessions in-memory** — lost on restart
23. **`getAllSettings()` still does full table scan** — admin-only, acceptable
24. **Empty `catch {}` blocks** — some remain (login page polling)
25. **null/undefined inconsistency** — cache.get() returns `undefined`, safeFetch returns `null`

## Architecture Complexity Metrics

| Metric | Value |
|---|---|
| Total service files | 12 (api-server) |
| Total route files | 6 (api-server) |
| Total DB tables | 4 |
| Total frontend pages | 7 |
| Total API endpoints | ~20 |
| Largest service | httpChecker.ts (634 lines) |
| Most complex logic | correlationEngine.ts (566 lines) |
| External API integrations | 15+ |
| Platform checks per search | 400-3155 |
| DB writes per search | 19 |
| Test files | 1 (correlationEngine.test.ts) |

## Recommendations for Next Immediate Actions

1. **Fix `incrementSearchCount`** — use atomic SQL pattern (5 min fix, critical)
2. **Replace session cache with LRUCache** — already in lib/cache.ts (10 min fix)
3. **Add IP rate limiting middleware** — express-rate-limit (15 min)
4. **Plan entity DB schema** — create entities/evidence/relationships tables (prerequisite for Phase 1)
5. **Set up BullMQ + Redis** — worker queue for search execution (Phase 0)
