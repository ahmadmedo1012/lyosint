# Architecture Audit: LYOSINT Current State

## 1. System Overview

LYOSINT is a monorepo (pnpm workspace) with 4 packages:
- `@workspace/api-server` — Express + TypeScript backend
- `@workspace/lyosint` — React + Vite frontend (shadcn/ui + Tailwind v4)
- `@workspace/db` — Drizzle ORM + PostgreSQL schema
- `@workspace/api-zod` — Zod validation & generated types
- `@workspace/api-client-react` — Orval-generated TanStack Query hooks

## 2. Current Architecture: Search-Oriented

```
POST /search/{type}  →  DB INSERT + fire-and-forget search  →  GET /search/:id/status (polling)
```

### 2.1 Data Flow

```
Frontend (React)
  ↓ POST /search/{name|phone|username|deep} with JWT
  ↓
API Server (Express)
  ↓ requireAuth → requireQuota
  ↓ randomUUID() → DB INSERT searchesTable
  ↓ UPDATE usersTable SET search_count + 1
  ↓ fire run{Type}Search(id, query) without awaiting
  ↓ respond 202 with { id, status: "pending" }
  ↓
Background Search (usernameSearch / nameSearch / phoneSearch)
  ↓ DB UPDATE status="running", progress=5
  ↓ Phase 1 (0-15s): httpChecker + WMN + Twitch + maigret (parallel)
  ↓ DB UPDATE progress=25, save partial usernameResult
  ↓ Phase 2 (15-45s): WMN all-sites + maigret full (parallel)  
  ↓ DB UPDATE progress=55
  ↓ Enrich GitHub, breaches, leaks, certs (parallel)
  ↓ DB UPDATE progress=88
  ↓ Build identityReport, final result
  ↓ DB UPDATE status="completed", progress=100
Frontend polls GET /search/:id/status every 500ms
  ↓ status === "completed" → GET /search/:id (full result)
```

### 2.2 API Routes

| Route | Handler | Auth |
|---|---|---|
| POST /auth/telegram | Telegram widget auth | Public |
| POST /auth/bot-webhook | Telegram bot login | Public |
| POST /auth/bot-poll | Login polling | Public |
| GET /auth/me | Current user | JWT |
| GET /auth/search-quota | User quota | JWT |
| POST /auth/subscribe | Manual subscribe | JWT |
| POST /search/{name,phone,username} | Create search | JWT+Quota |
| POST /search/deep | Deep search (multi-type) | JWT+Quota |
| GET /search/:id | Search result | Public |
| GET /search/:id/status | Search status | Public |
| GET /searches/recent | Recent searches | JWT |
| GET /api/stats | Platform stats | Public |
| POST /admin/login | Admin auth | Public |
| GET /admin/stats | Admin stats | Admin |
| GET /admin/users | User management | Admin |
| GET /admin/settings | API key settings | Admin |
| GET /admin/system-config | System config | Admin |

### 2.3 Database Schema (4 tables)

**users**: id, telegramId, firstName, lastName, username, photoUrl, sessionToken, searchCount, isSubscribed, subscribedAt, subscriptionExpiry, createdAt, updatedAt

**searches**: id, status(pending|running|completed|failed), type(name|phone|username|deep), query, progress, platformsSearched, platformsTotal, resultsCount, confidenceScore, nameResult(JSONB), phoneResult(JSONB), usernameResult(JSONB), createdAt, completedAt

**settings**: key(PK), value, category, description, isSecret, updatedAt

**pendingLogins**: token(PK), telegramId, firstName, lastName, username, photoUrl, expiresAt

### 2.4 Search Pipeline Services

**usernameSearch.ts** (359 lines) — Main pipeline:
- 4 parallel sources in Phase 1: httpChecker (50 platforms), Twitch API, WMN (40 social sites), maigret (50 sites)
- 2 parallel sources in Phase 2: WMN (all ~732 sites), maigret (500 sites)
- Phase 3: GitHub enrichment (GitHub API)
- Phase 4: Breach/reputation (HIBP, LeakCheck, EmailRep, crt.sh)
- Correlation engine runs inline
- 19 DB writes during a single search

**httpChecker.ts** (634 lines) — Direct HTTP checks:
- 37 verified platforms (API JSON/HTTP status)
- 43 manual-check platforms (link-only)
- LRU cache (60s TTL, max 1000)
- Concurrency limited to 16
- Per-platform 5s timeout + 3s body-read timeout

**whatsmyname.ts** (384 lines) — WMN data driver:
- 732 sites from bundled JSON
- Concurrency configurable (default 20-40)
- Per-site timeout + global timeout
- Cross-domain redirect detection

**maigret.ts** (325 lines) — Python subprocess wrapper:
- Spawns `maigret_runner.py` via stdin/stdout JSON protocol
- Up to 3155 sites, 50 concurrent connections
- Hard timeout calculation per run
- Background install on module load

**freeApis.ts** (421 lines) — 10+ external API wrappers:
- Hunter.io, HIBP, LeakCheck, Numverify, VirusTotal
- Shodan, IPInfo, ip-api.com, crt.sh, AbstractAPI
- EmailRep.io, Twitch API
- Per-API LRU caching, timedFetch with 6s timeout

**githubOsint.ts** (137 lines) — GitHub profile enrichment:
- User profile + repos + orgs (3 parallel API calls)
- Token-aware (60 vs 5000 req/hr)
- Body-read timeout 3s, connection timeout 6s

**correlationEngine.ts** (566 lines) — Identity resolution:
- Builds observations from platform results
- Clusters by hard correlations (email, phone, website, image, name+username)
- Scores clusters with weighted evidence
- Arabic summary generation

### 2.5 Frontend Architecture

**Pages**: Dashboard (search form), SearchResult, Platforms, History, Account, Admin, NotFound

**Key patterns**:
- TanStack Query for all API calls (Orval-generated hooks)
- Skeleton loading states for initial loads
- Error states with retry buttons (recently added)
- RTL Arabic-first layout
- 3 dark themes only

### 2.6 Service Dependencies

```
usernameSearch.ts
  ├── httpChecker.ts → settingsService.ts
  ├── githubOsint.ts → settingsService.ts
  ├── freeApis.ts → settingsService.ts
  ├── whatsmyname.ts (standalone, file-based data)
  ├── maigret.ts → Python subprocess
  ├── settingsService.ts → db
  └── correlationEngine.ts (standalone)

nameSearch.ts
  ├── libyaHelpers.ts (standalone)
  ├── githubOsint.ts
  └── freeApis.ts

phoneSearch.ts
  ├── libyaHelpers.ts
  ├── freeApis.ts
  └── phoneHelpers.ts (standalone)
```

## 3. Failure Points

1. **No worker queue**: Searches run in-process. If the server restarts, all in-flight searches are lost.
2. **No entity persistence**: Search results are stored per-session, not per-entity. Searching "john" twice creates two independent results.
3. **No cross-search correlation**: Previous search results are never referenced. No cumulative knowledge.
4. **Monolithic search pipeline**: `usernameSearch.ts` is 359 lines of sequential logic with error handling at the top level only.
5. **In-memory admin sessions**: Server restart invalidates all admin sessions.
6. **No search timeout at route level**: Fire-and-forget with no cancellation mechanism.
7. **Polling-based frontend**: No WebSocket/SSE for real-time updates.
8. **API key management**: Flat file cache, no encryption at rest.
9. **No rate limiting per IP**: Only per-user quota.
10. **Deep search orphaned sub-searches**: Sub-search errors are silently swallowed.

## 4. Additional Audit Findings (Post 25-File Full Read)

### 4.1 `incrementSearchCount` Missed in T024 Fix
- `requireAuth.ts:76-81` still uses `SELECT searchCount` → JS increment → `UPDATE SET searchCount = $2`
- T024 only fixed the 4 search routes — middleware was overlooked
- Fix: `sql\`UPDATE users SET search_count = search_count + 1 WHERE id = ${userId}\`` (same pattern)

### 4.2 Session Cache Clears Entirely at 1000 Entries
- `requireAuth.ts:21` — `if (sessionCache.size > 1000) sessionCache.clear()`
- Destroys all cached sessions at once instead of LRU eviction
- At 1001 concurrent logins, every 5th minute all 1000 cached users hit DB
- Fix: Replace with LRUCache (already in lib/cache.ts)

### 4.3 Stats Endpoint Hardcodes Platform List
- `stats.ts:7-55` — PLATFORMS array duplicated from other platform data sources
- 55 platforms hardcoded in two places (stats + httpChecker/layout)
- Risk: drift between actual checked platforms and displayed coverage

### 4.4 Telegram Webhook Blocks Server Startup
- `index.ts:57-60` — `app.listen` callback calls `setTelegramWebhook()` which does HTTPS fetch
- If Telegram API is slow/unreachable, server startup is delayed
- Mitigation: Fire webhook setup without awaiting, or use timeout

### 4.5 No Graceful Shutdown for In-Flight Searches
- `index.ts:62-63` — SIGTERM handler only closes HTTP server
- All in-process searches are aborted with no DB cleanup
- No search timeout/cancellation mechanism at Express level

### 4.6 Libyan-Specific Intelligence (libyaHelpers.ts)
- Arabic→English transliteration map with 8 entries (Mohamed→Ahmed→etc.)
- Carrier/region prefix detection for Libyan phone numbers (+218)
- Libya-specific social platform search URL generation
- **Useful but limited**: transliteration coverage is minimal; name variants are hardcoded

### 4.7 Correlation Engine Test Coverage
- 4 unit tests covering: high-confidence merge, single-source suppression, multi-platform username-only suppression, conflicting name separation
- No integration tests for cross-search correlation
- No tests for Arabic summary generation

### 4.8 Drizzle Connection Pool Default
- `lib/db/src/index.ts` — `max: 10` (default)
- At 19 DB writes per search + polling → potential pool starvation under load
- Recommendation: increase to 25-30 for production

### 4.9 Phone Number Intelligence (phoneHelpers.ts)
- Full libphonenumber-js integration with 20 country names
- Mobile/landline detection
- National + international formatting
- Carrier detection for Libya only (in libyaHelpers.ts)
