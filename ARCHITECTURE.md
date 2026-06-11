# LYOSINT — Architecture Documentation

نظام الاستخبارات مفتوحة المصدر (OSINT) لمنصة التحقيقات الذكية

---

## Overview & Vision

LYOSINT is an intelligence investigation platform rebuilt from the ground up as an entity-centric OSINT system. It transforms raw OSINT search results into a persistent, analyzable intelligence graph — tracking entities (people, organizations, accounts), the evidence connecting them, and the relationships between them. Every search enriches a cumulative knowledge base rather than producing ephemeral results.

The platform serves as an integrated investigation workspace: search across 40+ platforms (Libyan-specific and international) by name, phone (+218), or username; view results as an interactive knowledge graph with entity resolution and deduplication; build evidence-backed timelines; generate structured dossiers; and track the full audit trail. The system speaks Arabic natively and is RTL-first.

The architecture follows clean layered design: Express 5 routes delegate to 11 core business services that operate on a PostgreSQL database with Drizzle ORM, pgvector for embeddings, and an in-memory graph engine for real-time relationship traversal. The frontend is a React 19 SPA with TanStack Query, shadcn/ui, and a Canvas-based graph visualization. The entire system ships as a single Docker deployable.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Browser (SPA)                         │
│  React 19 + Vite + TanStack Query + Tailwind v4 + shadcn/ui        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Dashboard │ │Search    │ │Graph Vis │ │Dossier   │ │Invest.   │ │
│  │          │ │Result    │ │(Canvas)  │ │Viewer    │ │Workspace │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ /api/*
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Express 5 API Server (single process)             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Middleware Pipeline                         │   │
│  │  securityHeaders → cors → json/urlencoded → auditLogger      │   │
│  │  rateLimit(search|auth|admin|general) → router              │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │                    Route Handlers                              │   │
│  │  /health /stats /search /auth /admin                          │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    11 Core Services                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │Entity    │ │Confidence│ │Evidence  │ │Graph     │       │   │
│  │  │Resolver  │ │Engine    │ │Engine    │ │Engine    │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │Relationship│Timeline  │ │Memory    │ │Dossier   │       │   │
│  │  │Engine    │ │Engine    │ │Engine    │ │Engine    │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────────┐       │   │
│  │  │Audit Log │ │Search    │ │Source Adapter          │       │   │
│  │  │Engine    │ │Orchestr. │ │Framework (abstract)    │       │   │
│  │  └──────────┘ └──────────┘ └────────────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                           │                                         │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                      PostgreSQL Database                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  13 Tables: entities, identifiers, profiles, evidence,       │   │
│  │  relationships, timeline_events, investigations, dossiers,   │   │
│  │  search_sessions, source_results, audit_logs,                │   │
│  │  entity_embeddings (pgvector), memory_entries                │   │
│  │  + legacy: searches, users, settings, pending_logins         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Layer Architecture

### 1. HTTP Transport Layer (Express 5)
- Routes: `/api/health`, `/api/stats`, `/api/search/*`, `/api/auth/*`, `/api/admin/*`
- SPA serving: static files from `artifacts/lyosint/dist/public/` with `index.html` fallback
- Body parsing: `express.json()` (1mb limit), `express.urlencoded()`
- Request logging: `pino-http`

### 2. Security Layer
- **Security Headers**: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, COEP/COOP/CRP
- **Rate Limiting**: Per-endpoint token bucket (search: 10/min, auth: 5/min, admin: 30/min, general: 60/min)
- **Authentication**: JWT (15m access + 7d refresh), Telegram Widget auth, admin session tokens
- **Abuse Prevention**: IP tracking, failed attempt recording, CAPTCHA verification (hCaptcha/Cloudflare Turnstile)
- **Input Validation**: Zod schemas on all request bodies/params/query strings

### 3. Audit Layer
- Automatic audit logging of all `/api/*` requests
- Logs: userId, action, resourceType, resourceId, ipAddress, userAgent, severity, sessionId
- Persisted to `audit_logs` table; severity levels: info, warning, error, critical

### 4. Route Layer (Controllers)
- Thin route handlers that parse + validate input, call services, return responses
- Search routes fire async operations and return `202 Accepted` immediately
- Auth routes handle Telegram OAuth, JWT, TOTP 2FA, password reset

### 5. Service Layer (11 Core Services)
- Pure business logic, no HTTP concerns
- See Service Architecture section below for details

### 6. Orchestration Layer
- Search orchestrator: parallel source execution with configurable concurrency (5), per-source timeout (10s), overall timeout (60s)
- Queue-based processing with batch execution
- LRU result caching (200 entries, 5min TTL)

### 7. Database Access Layer
- Drizzle ORM with `node-postgres` pool
- PostgreSQL with pgvector extension for 384-dimension entity embeddings
- Connection pooling (max 10, configurable via `DB_POOL_MAX`)
- Auto-detects Neon serverless (SSL with `rejectUnauthorized: false`)

### 8. Caching & Persistence Layer
- LRU in-memory cache for search results, user sessions, API responses
- PostgreSQL for persistent storage (entities, evidence, relationships, etc.)
- In-memory stores for graph engine, relationship engine, evidence engine, dossier engine

---

## Service Architecture (11 Core Services)

### 1. Entity Resolver (`services/entity-resolver/`)
- Normalizes raw identifiers (name, phone, email, username, URL, domain)
- Fingerprints identifiers with SHA-256 for deduplication
- Fuzzy matching via Jaro-Winkler (names) and Levenshtein (usernames)
- Resolves entity identity by correlating multiple identifiers

### 2. Confidence Engine (`services/confidence-engine/`)
- Bayesian confidence scoring using 5 weighted evidence factors
- Factors: source authority (30%), evidence consistency (25%), source independence (20%), recency (10%), corroboration count (15%)
- Returns `ConfidenceResult` with numeric score (0-0.99), qualitative level (weak/low/medium/high/very_high), and bilingual (Arabic/English) explanation

### 3. Evidence Engine (`services/evidence-engine/`)
- Stores evidence items with SHA-256 fingerprint-based deduplication
- Supports querying by entityId, source, type, status, date range
- Bayesian confidence updates when new evidence arrives
- Evidence types: profile, breach, communication, document, location, association

### 4. Graph Engine (`services/graph-engine/`)
- In-memory `IntelligenceGraph` class with adjacency list representation
- Graph operations: add/remove nodes and edges, find shortest path (BFS), weighted shortest path (Dijkstra), find connected components, get neighborhood (configurable depth)
- Graph statistics: node/edge count, density, degree centrality, average clustering coefficient
- Serializable to/from `AdjacencyList` format

### 5. Relationship Engine (`services/relationship-engine/`)
- Infers relationships between entities based on shared identifiers
- Relationship types: same_identity, associated, communicated, located_at, owns, works_at, family, colleague
- Configurable merge threshold (default 0.85) for auto-merge candidates
- Weighted scoring: email (0.95), phone (0.90), profile_image (0.80), username (0.60), etc.

### 6. Timeline Engine (`services/timeline-engine/`)
- Builds entity timelines from evidence items with timestamps
- Groups events by configurable period (day/week/month/year)
- Detects temporal gaps > 30 days
- Identifies patterns: event type frequency, temporal clustering, consistent activity

### 7. Memory Engine (`services/memory-engine/`)
- Stores learned patterns: entity name patterns, false positive signatures, source reliability scores, correlation hints
- LRU hot cache (500 entries) + persistent pattern store
- Pattern consolidation: removes stale patterns (>365d, <3 accesses), decays confidence of old patterns (>180d)
- Type-prefixed key lookups

### 8. Dossier Engine (`services/dossier-engine/`)
- Generates structured investigation dossiers from entity data
- Sections: identity summary, identifiers, profiles, evidence summary, relationships graph, timeline, confidence assessment, sources list, findings analysis
- Supports JSON and Markdown output formats
- Version tracking (up to 20 versions per dossier)

### 9. Audit Log Engine (`services/audit-log-engine/`)
- Records all user actions with tamper-evident SHA-256 checksums
- Queryable by userId, action, resourceType, severity, date range
- Aggregated activity reports and retention policy enforcement (default 365 days)
- In-memory store with 100k entry cap

### 10. Search Orchestrator (`services/search-orchestrator/`)
- Manages search task queue with sequential processing
- Parallel batch execution (batch size = 5 concurrent sources)
- Per-source timeout (10s default) + overall timeout (60s)
- LRU result caching (200 entries, 5min TTL)
- Status tracking and progress reporting

### 11. Source Adapter Framework (`services/source-adapter-framework/`)
- Abstract base class `BaseSourceAdapter` for all external data sources
- Built-in: rate limiting (token bucket), circuit breaker (5 failures -> open, 30s reset), retry with exponential backoff, result caching
- Concrete adapters: SherlockAdapter, MaigretAdapter, PhoneSearchAdapter, EmailSearchAdapter
- Extensible: implement `search()`, `validateResponse()`, `normalizeResult()`

---

## Database Schema

### Legacy Tables (original search-focused schema)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `searches` | Search task tracking | id, status (enum), type (enum), query, progress, results JSONB |
| `users` | User accounts | id, telegramId, firstName, sessionToken, passwordHash, totpSecret |
| `settings` | API keys + system config | key (PK), value, category, isSecret |
| `pending_logins` | Telegram auth flow | token, telegramId, expiresAt |

### Intelligence Tables (entity-centric schema)

| Table | Purpose | Key Columns | Relationships |
|-------|---------|-------------|---------------|
| `entities` | Core entity records | id (UUID), type, label, normalizedLabel, riskScore, metadata | FK to — |
| `identifiers` | Entity identity fragments | entityId, type, value, normalizedValue, confidence | FK -> entities (cascade) |
| `profiles` | Platform profile data | entityId, platform, profileUrl, username, bio, followerCount | FK -> entities (cascade) |
| `evidence` | Evidence items with chain of custody | entityId, identifierId, sourceType, checksum (unique), confidence, status | FK -> entities, identifiers |
| `relationships` | Entity-to-entity edges | sourceEntityId, targetEntityId, relationshipType, strength | FK -> entities (cascade) |
| `timeline_events` | Temporal event records | entityId, eventType, eventDate, source, location | FK -> entities (cascade) |
| `investigations` | Investigation workspace | title, status, ownerId, targetEntityIds, priority, findingsSummary | FK -> users |
| `dossiers` | Generated intelligence reports | investigationId, entityId, sections JSONB, status, version | FK -> investigations, entities, users |
| `search_sessions` | OSINT search operations | userId, query, queryType, status, progress, identifiersFound | FK -> users (cascade) |
| `source_results` | Per-source search outcomes | searchSessionId, sourceName, rawResponse JSONB, responseTimeMs | FK -> search_sessions (cascade) |
| `audit_logs` | Tamper-evident audit trail | userId, action, resourceType, severity, ipAddress, sessionId | FK -> users |
| `entity_embeddings` | Vector embeddings for similarity | entityId, embedding (vector(384)), modelName | FK -> entities (cascade) |
| `memory_entries` | Learned patterns | entryType, key, value JSONB, confidence, accessCount | — |

### Entity-Relationship Diagram

```
users ──< search_sessions ──< source_results
  │
  ├──< investigations ──< dossiers ──> entities
  └──< audit_logs
                    
entities ──< identifiers
  │──< profiles
  │──< evidence
  │──< timeline_events
  │──< entity_embeddings
  │──< relationships (source_entity_id)
  └──< relationships (target_entity_id)
```

---

## API Endpoints

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/healthz` | Health check (alias) |

### Stats
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | System statistics (total searches, avg confidence, etc.) |
| GET | `/api/platform-coverage` | List all 40+ search platforms with metadata |

### Search
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/search/name` | Search by name (returns 202, async) |
| POST | `/api/search/phone` | Search by phone number (returns 202, async) |
| POST | `/api/search/username` | Search by username (returns 202, async) |
| POST | `/api/search/deep` | Deep search across name + phone + username |
| GET | `/api/search/:id` | Get search result data |
| GET | `/api/search/:id/status` | Get search progress/status |
| GET | `/api/searches/recent` | List recent searches |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with email + password |
| POST | `/api/auth/login` | Login (email/password or TOTP) |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | Logout (invalidate session) |
| POST | `/api/auth/telegram` | Telegram Widget login |
| POST | `/api/auth/bot-webhook` | Telegram bot webhook receiver |
| POST | `/api/auth/bot-poll` | Poll for Telegram login status |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/auth/search-quota` | Get search quota info |
| POST | `/api/auth/subscribe` | Activate subscription |
| POST | `/api/auth/password-reset/request` | Request password reset |
| POST | `/api/auth/password-reset/confirm` | Confirm password reset |
| POST | `/api/auth/2fa/setup` | Set up TOTP 2FA |
| POST | `/api/auth/2fa/verify` | Verify TOTP setup |
| POST | `/api/auth/2fa/disable` | Disable TOTP 2FA |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Admin login |
| POST | `/api/admin/logout` | Admin logout |
| GET | `/api/admin/stats` | Admin dashboard stats |
| GET | `/api/admin/users` | List users (paginated) |
| POST | `/api/admin/users/:id/subscribe` | Grant subscription |
| POST | `/api/admin/users/:id/unsubscribe` | Remove subscription |
| POST | `/api/admin/users/:id/reset-quota` | Reset search quota |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/settings` | Get API key settings |
| PUT | `/api/admin/settings/:key` | Update API key setting |
| DELETE | `/api/admin/settings/:key` | Delete API key setting |
| GET | `/api/admin/system-config` | Get system configuration |
| PUT | `/api/admin/system-config/:key` | Update system config |
| GET | `/api/admin/osint-status` | OSINT tool availability check |
| POST | `/api/admin/change-credentials` | Change admin credentials |

---

## Security Architecture

### Authentication Flow
```
1. Telegram Auth (primary):
   User -> Telegram Widget -> verifyTelegramAuth() (HMAC-SHA256) -> upsertUser() -> JWT

2. Email/Password (secondary):
   User -> POST /auth/register or /auth/login -> validateBody(Zod) ->
   passwordHash (HMAC-SHA256 with salt) -> JWT tokens -> response

3. JWT Token Spec:
   Access Token: 15min expiry, signed with JWT_SECRET (HS256)
   Refresh Token: 7d expiry, signed with JWT_REFRESH_SECRET
   Payload: { userId, role, sessionId }
   Session invalidation: LRU cache of invalidated sessionIds

4. 2FA (TOTP):
   Optional Google Authenticator-compatible TOTP via otpauth library
```

### Rate Limiting
- **Algorithm**: Token bucket per IP + endpoint category
- **Search**: 10 req/min
- **Auth**: 5 req/min (login/register)
- **Admin**: 30 req/min
- **General**: 60 req/min
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

### Abuse Prevention
- Failed attempt tracking: 5 failures within 10min -> 15min IP block
- Suspicious pattern detection: configurable scoring based on request behavior
- CAPTCHA support: hCaptcha and Cloudflare Turnstile

### Audit Trail
- Every `/api/*` request automatically logged to `audit_logs` table
- Severity classification: 500+ = critical, 401/403 = warning, else info
- Tamper-evident: SHA-256 checksum per entry

---

## Deployment Architecture

### Container (Docker)
- **Base**: `node:20-alpine` with Python 3.12 sidecar for Maigret OSINT tool
- **Multi-stage build**: `base` -> `deps` -> `build` -> `api`
- **Single process**: Express serves both API + built SPA
- **Health check**: `GET /api/health` every 30s
- **Non-root user**: `appuser` with `tini` init system

### Render Deployment
- Single Docker Web Service (Starter plan, Oregon region)
- Neon PostgreSQL (serverless, auto-scaling)
- Auto-deploy on `main` branch push
- Pre-deploy: `pnpm --filter @workspace/db run push` (Drizzle schema migration)
- Environment variables: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

### CI/CD (GitHub Actions)
- **lint-typecheck**: TypeScript compilation check across all packages
- **test**: Jest tests with pgvector/pg16 PostgreSQL service container
- **build**: pnpm build across all artifacts
- **security**: Dependency audit (`pnpm audit --audit-level=high`)

### Monitoring
- Request logging via pino (structured JSON, configurable level)
- Audit log with severity escalation
- Health check endpoint for container orchestration
- Coverage reports uploaded as artifacts

---

## Performance Design

### Caching Strategy
- **LRU In-memory Cache**: `LRUCache<V>` class with max-size eviction + TTL
- Search result cache: 200 entries, 5min TTL
- User session cache: 5min TTL
- Pattern hot cache (memory engine): 500 entries, 1h TTL
- Audit session cache: 10000 entries
- IP abuse tracking cache: 5000 entries

### Parallel Execution
- Source adapter framework: configurable rate limiting + circuit breaker per source
- Search orchestrator: concurrent batch processing (5 parallel sources per batch)
- Deep search: spawns independent name/phone/username sub-searches with `Promise.allSettled`
- External API calls: configurable timeout (10s default) + retry with exponential backoff

### Asynchronous Processing
- All searches are fire-and-forget: POST returns `202 Accepted` with a task ID
- Frontend polls `/search/:id/status` until `status === "completed"`
- Queue-based processing: sequential task queue with batch parallelism within each task
- Settings service: keyed lookups instead of full table scans

### Database Optimization
- Indexed columns on all foreign keys, query-pattern columns, and type+status combinations
- Unique constraints on checksums (evidence), fingerprints (identifiers), entity embeddings
- Composite indexes for common query patterns (entity_id + type, entity_id + date, etc.)
- pgvector for entity similarity search (384-dimension embeddings)

### Memory Store Limits
| Store | Max Entries | Eviction Policy |
|-------|-------------|-----------------|
| Search cache | 200 | LRU + TTL (5min) |
| Pattern hot cache | 500 | LRU + TTL (1h) |
| Dossier versions | 20 per dossier | FIFO |
| Audit log | 100,000 | FIFO |
| IP records | 5,000 | LRU + stale cleanup |
| Session blacklist | 10,000 | LRU + TTL |

---

## Project Structure

```
lyosint/
├── artifacts/
│   ├── api-server/          # Express 5 API (Drizzle, services, middleware)
│   │   └── src/
│   │       ├── routes/      # Route handlers (health, stats, search, auth, admin)
│   │       ├── services/    # 11 core services + legacy OSINT integrations
│   │       ├── middleware/  # auth, audit, rate-limit, security-headers, cors, validate
│   │       └── lib/         # cache, session (JWT), errors, logger, abuse, safeFetch
│   └── lyosint/             # React + Vite SPA
│       └── src/
│           ├── pages/       # 12 page components
│           ├── components/  # dossier-view, graph-visualization, timeline, search, etc.
│           ├── hooks/       # Custom React hooks
│           └── contexts/    # Auth + Theme providers
├── lib/
│   ├── db/                  # Drizzle schema (18 tables) + pool
│   ├── api-spec/            # OpenAPI 3.1 contract (source of truth)
│   ├── api-zod/             # Generated Zod schemas from OpenAPI
│   └── api-client-react/    # Generated TanStack Query hooks
├── scripts/                 # Maigret runner, operational scripts
└── specs/                   # Feature specifications and plans
```

---

## منصة البحث والتحقيق الذكية

ليوسنت هي منصة متكاملة للاستخبارات مفتوحة المصدر (OSINT)، صُممت خصيصاً لدعم المحققين والباحثين في تحليل المعلومات المتاحة علناً. تتيح المنصة البحث عن الأفراد باستخدام الاسم، رقم الهاتف (+218)، أو اسم المستخدم عبر أكثر من 40 منصة ليبية وعالمية، مع عرض النتائج في شكل رسوم بيانية معرفية تفاعلية وجداول زمنية وملفات تحقيق منظمة.

تقوم المنصة على تحويل نتائج البحث الأولية إلى قاعدة معرفية تراكمية: يتم استخراج الكيانات (أشخاص، مؤسسات، حسابات)، وتوثيق الأدلة، واكتشاف العلاقات بين الكيانات، وإنشاء خط زمني للأحداث، وإنتاج تقارير تحقيق شاملة. كل ذلك مع الحفاظ على سلسلة توثيق كاملة للأدلة وسجلات تدقيق لا يمكن التلاعب بها.

صُممت المنصة من الصفر باستخدام أحدث التقنيات: Node.js مع Express 5 من جهة الخادم، React 19 مع TanStack Query من جهة الواجهة، PostgreSQL مع Drizzle ORM و pgvector لتخزين البيانات، مع دعم كامل للغة العربية والواجهة من اليمين إلى اليسار.
