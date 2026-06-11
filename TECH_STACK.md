# LYOSINT — Technology Stack & Decisions

---

## Backend: Node.js + Express + TypeScript

**Runtime**: Node.js 20+ (LTS with built-in ESM, `--enable-source-maps`, test runner)
**Framework**: Express 5 (alpha/stable, async error handling, improved routing)
**Language**: TypeScript 5.9 (`bundler` module resolution, strict null checks, incremental builds)

**Why Node.js/Express**:
- Monorepo with shared TypeScript types between frontend and backend
- Single process serves both API and SPA (no CORS, no inter-service networking)
- Express 5's async error handling simplifies middleware patterns
- `tsx` for development, `esbuild` for production bundling (single ESM `.mjs` output)
- Mature ecosystem for OSINT tasks (HTTP clients, parsers, Telegram integration)

**Why Not**:
- Python (Django/FastAPI): the project already had a Node.js codebase; Python is used as a sidecar for Maigret only
- Go: heavier rewrite for a team already working in TypeScript
- Next.js: API routes are secondary; Express gives full control over middleware pipeline

---

## Frontend: React 19 + Vite + Tailwind CSS v4

**UI Framework**: React 19.1 (concurrent features, improved server components — though not used here)
**Build Tool**: Vite 7 (sub-second HMR, esbuild-based bundling, Lightning CSS)
**Styling**: Tailwind CSS v4 (CSS-first configuration, `@tailwindcss/vite` plugin)
**Component Library**: shadcn/ui (Radix UI primitives + Tailwind)
**Routing**: wouter (1.3KB hash-based router, React Router-compatible API)
**Data Fetching**: TanStack React Query v5 (auto-generated hooks via Orval)
**Animation**: Framer Motion v12 (page transitions, loading states)
**Charts**: Recharts (dashboard stats)
**Icons**: Lucide React

**Why React 19 + Vite**:
- React 19's concurrent rendering improves perceived performance during data loading
- Vite 7 provides instant HMR and production-optimized builds with Tailwind v4's Lightning CSS integration
- shadcn/ui components are built on Radix primitives with full RTL support
- TanStack Query handles caching, background refetching, and loading states automatically
- wouter is minimal and works well for a single-page investigation tool

**Why Not**:
- Next.js: SPA + API in one Express process is simpler; no SSR needed for this use case
- Remix: overkill for a dashboard-style application
- Pure CSS modules: Tailwind v4's design system approach is more maintainable for this scale

---

## Database: PostgreSQL + Drizzle ORM + pgvector

**Database**: PostgreSQL 14+ (Neon-compatible, pgvector extension)
**ORM**: Drizzle ORM 0.45 (type-safe SQL, lightweight, zero-dependency query building)
**Migrations**: Drizzle Kit push (schema-driven, no migration files in dev)
**Validation**: Zod v4 + drizzle-zod (type-safe runtime validation from DB schema)

**Why PostgreSQL**:
- pgvector extension enables semantic entity similarity search (384-dim embeddings)
- JSONB columns for flexible raw data storage (API responses, platform data, evidence metadata)
- UUID primary keys for distributed-friendly ID generation
- Array columns for tags, evidence IDs, target entity arrays
- Native enum support for search status and type fields

**Why Drizzle ORM**:
- Type-safe queries with full TypeScript inference (no code generation step for queries)
- Lightweight: no large runtime, no data loader, no identity map
- Composability: drizzle-zod generates validation schemas directly from table definitions
- Supports PostgreSQL-specific features: `vector` extension, `jsonb`, `uuid`, `array`, composite indexes
- Declarative schema with `pgTable` that doubles as the single source of truth

**Why Not**:
- Prisma: heavier runtime, separate generation step, limited PostgreSQL-specific features
- TypeORM: complex decorator-based API, slower development velocity
- Raw SQL queries: Drizzle's type safety dramatically reduces runtime errors

---

## Graph: In-memory Graph Engine + PostgreSQL

**In-memory**: `IntelligenceGraph` class (adjacency list via `Map<string, Map<string, Edge[]>>`)
**Persistence**: `entities` + `relationships` tables in PostgreSQL
**Algorithms**: BFS (shortest path), Dijkstra (weighted path), connected components, neighborhood traversal

**Why Hybrid**:
- Investigation sessions typically work with 50-500 nodes — well within in-memory performance
- BFS and Dijkstra over adjacency lists are O(V+E) and O(E log V) respectively
- PostgreSQL provides durable storage and the ability to query entity relationships across sessions
- No need for a dedicated graph database (Neo4j) at this scale

**Why Not**:
- Neo4j: operational overhead of another database; entity graphs are small enough for in-memory processing
- RedisGraph: abandoned module; insufficient for the query patterns needed
- Pure SQL recursive CTEs: possible but significantly slower for graph traversal queries

---

## Auth: JWT with Rotation

**Library**: `jsonwebtoken` (HS256 signing)
**Access Token**: 15-minute expiry, contains `{ userId, role, sessionId }`
**Refresh Token**: 7-day expiry, rotation on use (old session invalidated, new tokens issued)
**Session Invalidation**: LRU cache of blacklisted `sessionId` values
**2FA**: TOTP via `otpauth` library (Google Authenticator compatible)
**Telegram Auth**: HMAC-SHA256 verification of Telegram Widget data + bot webhook polling

**Why JWT**:
- Stateless access tokens reduce database lookups on every request
- 15-minute window limits damage from token leakage
- Session invalidation via blacklist cache provides immediate revocation when needed
- Refresh token rotation prevents replay attacks

**Why Not**:
- Session cookies: requires server-side session storage; JWT gives better horizontal scaling
- OAuth: overkill for a single-service application; Telegram already serves as the identity provider
- Magic links: Telegram bot provides a better UX for authentication

---

## Caching: LRU In-memory + Redis (Extensible)

**Primary**: `LRUCache<V>` generic class with max-size eviction + TTL (used everywhere)
**Current**: In-memory only (single-process deployment, no Redis operational overhead)
**Future**: Redis integration through a shared interface when scaling to multiple processes

**Cache Usage**:
- Search results (200 entries, 5min TTL)
- User sessions (5min TTL)
- Pattern hot cache (500 entries, 1h TTL)
- Rate limiting buckets (10,000 entries)
- IP abuse tracking (5,000 entries)
- Session blacklist (10,000 entries)

**Why LRU**:
- Predictable memory usage: hard limit on entry count prevents memory leaks
- Temporal locality: recently accessed data is most likely to be accessed again
- Simple implementation: no external dependencies, no serialization overhead

**Why Not**:
- Redis-only: operational overhead of running Redis; single-process deployment doesn't need it yet
- Redis with in-memory fallback: `LRUCache` class is designed to be replaced by Redis later via the same interface pattern

---

## Search: Parallel Orchestration with Queue

**Architecture**: Fire-and-forget async execution with task queue
**Concurrency**: 5 parallel source checks per batch, configurable
**Timeouts**: Per-source (10s default), overall search (60s default)
**Retry**: Exponential backoff (1s, 2s, 4s — up to 10s max), 3 attempts
**Circuit Breaker**: 5 consecutive failures opens circuit; 30s reset window

**Why Queue**:
- `/search/*` POST returns immediately (202 Accepted) — user doesn't wait
- Sequential task queue prevents thundering herd on external APIs
- Batch parallelism within a task maximizes throughput without overwhelming sources
- Status polling (`/search/:id/status`) provides real-time feedback

**Why Not**:
- WebSockets/SSE: polling is simpler and works through all proxies; WebSockets add connection management overhead
- BullMQ/Redis queue: operational complexity not justified for single-server deployment
- Message queue: the queue is simple enough that in-process handling is sufficient

---

## Visualization: Canvas-based Custom Engine

**Component**: `graph-visualization.tsx` (force-directed layout on HTML5 Canvas)
**Library**: Custom force simulation (no D3 or vis.js dependency)
**Features**: Node dragging, zoom/pan, edge labeling, hover tooltips, color by entity type

**Why Canvas**:
- 50-500 nodes render smoothly at 60fps (DOM-based SVG slows down at 100+ nodes)
- Full control over rendering: custom node shapes, edge animations, particle effects
- No additional bundle size from visualization libraries
- Canvas is well-suited for the dark theme aesthetic

**Why Not**:
- D3.js: heavy dependency, slower at 500+ node graphs, complex API
- vis.js: larger bundle, less control over rendering, dependency on older libraries
- react-force-graph: good but adds ~200KB to bundle; custom Canvas is lighter

---

## Testing: Jest + Playwright

**Unit/Integration**: Jest 29 with `ts-jest` (backend services)
**Frontend**: Playwright (E2E tests — planned)
**Coverage**: Jest collects coverage; uploaded as GitHub Actions artifacts

**Why Jest**:
- Mature test runner with parallel execution, snapshot testing, and coverage
- ts-jest handles TypeScript transformation without additional config
- Existing test suites for entity resolver, confidence engine, evidence engine, etc.

**Why Not**:
- Vitest: good but Jest was already established; migration cost not justified
- Mocha: requires more setup; Jest is more batteries-included

---

## CI/CD: GitHub Actions

**Workflows**:
- `ci.yml`: typecheck -> test (with pgvector PostgreSQL) -> build -> security audit
- `deploy.yml`: deploy to Render on `main` push
- `security.yml`: periodic dependency auditing

**PostgreSQL Service**: `pgvector/pgvector:pg16` Docker container for integration tests

**Why GitHub Actions**:
- Free for public repos, deeply integrated with GitHub
- Container service support for running pgvector in CI
- Matrix builds for parallel job execution

**Why Not**:
- CircleCI: paid tier, less GitHub integration
- Jenkins: operational overhead of maintaining a CI server

---

## Deployment: Docker + Render

**Container**: Multi-stage Docker build (base -> deps -> build -> api)
**Registry**: Render Docker Registry (automatic)
**Platform**: Render Web Service (Starter plan, auto-deploy, health checks)
**Database**: Neon (serverless PostgreSQL, auto-scaling, pooled connections)

**Why Single Docker Service**:
- Express serves both API (`/api/*`) and built SPA (`/*`) — one process, one deployment
- No inter-service networking, no CORS in production, no reverse proxy needed
- Render's Docker support handles the multi-stage build efficiently

**Why Not**:
- Separate frontend + backend services: adds CORS complexity, doubles deployment surface
- Kubernetes: extreme overkill for a single-service application
- Serverless functions: OSINT searches can run longer than Lambda's 15-minute timeout
