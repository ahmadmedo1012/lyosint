# LYOSINT — Intelligence Investigation Platform

**منصة الاستخبارات مفتوحة المصدر — تحليل المعلومات المفتوحة في ثوانٍ**

LYOSINT is a full-stack OSINT investigation platform rebuilt from scratch as an entity-centric intelligence system. Search for individuals by name, phone (+218), or username across 40+ Libyan-specific and international platforms. View results as interactive knowledge graphs, evidence-backed timelines, and structured dossiers. Every search enriches a persistent intelligence database.

---

## Quick Start

```bash
pnpm install
cp .env.example .env
cp artifacts/api-server/.env.example artifacts/api-server/.env
# edit .env with your DATABASE_URL
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev    # API on :8080
pnpm --filter @workspace/lyosint run dev       # Frontend on :19190
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-type Search** | Name, phone (+218 Libyan prefix detection), username — each optimized for the target |
| **Deep Search** | Cross-query with name + phone + username in one operation |
| **40+ Platforms** | Facebook, Instagram, X, Telegram, LinkedIn, GitHub, TikTok, Snapchat, Libyan sites, and more |
| **Knowledge Graph** | Force-directed Canvas graph with entity resolution, relationship inference, pathfinding |
| **Timeline Engine** | Automatic timeline construction from evidence with gap detection and pattern identification |
| **Dossier Generation** | 9-section structured reports with confidence assessment, JSON and Markdown output |
| **Confidence Scoring** | Bayesian evidence-weighted scoring with bilingual explanations (Arabic/English) |
| **Entity Resolution** | Fuzzy matching (Jaro-Winkler + Levenshtein), SHA-256 fingerprinting, deduplication |
| **Memory Layer** | Learned patterns, false positive signatures, source reliability scores |
| **Full Audit Trail** | Tamper-evident SHA-256 checksums on every action |
| **JWT Auth + 2FA** | Access/refresh token rotation, TOTP two-factor authentication, Telegram login |
| **Admin Panel** | User management, API key config, system settings, OSINT tool status |
| **RTL Arabic UI** | Full right-to-left layout, Arabic interface text |
| **Subscription Mgmt** | Free tier quota + subscription-based unlimited access |

---

## Architecture Overview

```
Client (React 19 SPA)  ─── /api/* ─── Express 5 Server ─── PostgreSQL
   TanStack Query                    │                         │
   shadcn/ui/Tailwind                ├── 11 Core Services      ├── Drizzle ORM
   Canvas Graph Vis                  ├── Security Layer        ├── pgvector
   Framer Motion                     └── Queue + Cache         └── 18 Tables
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed diagrams and service descriptions.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+ | Server-side execution |
| **API Framework** | Express 5 | HTTP routing + middleware |
| **Language** | TypeScript 5.9 | Type safety across stack |
| **Frontend** | React 19 + Vite 7 | SPA with HMR |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Component system + dark theme |
| **Data Fetching** | TanStack Query v5 | Caching + auto-generated hooks |
| **Database** | PostgreSQL 14+ | Persistent storage |
| **ORM** | Drizzle ORM 0.45 | Type-safe SQL |
| **Vector Search** | pgvector | Semantic entity search |
| **Auth** | JWT + TOTP | Stateless auth with 2FA |
| **Build** | pnpm + esbuild | Monorepo + ESM bundling |

See [TECH_STACK.md](./TECH_STACK.md) for detailed technology decisions.

---

## Project Structure

```
lyosint/
├── artifacts/
│   ├── api-server/              # Express 5 API server
│   │   └── src/
│   │       ├── routes/          # Route handlers
│   │       ├── services/        # 11 core business services
│   │       ├── middleware/      # Security, auth, audit, rate-limit
│   │       └── lib/             # Cache, JWT, errors, logger
│   └── lyosint/                 # React + Vite SPA
│       └── src/
│           ├── pages/           # 12 page components
│           ├── components/      # UI components (search, graph, dossier, etc.)
│           ├── contexts/        # Auth + Theme providers
│           └── hooks/           # Custom React hooks
├── lib/
│   ├── db/                      # Drizzle schema + PostgreSQL pool
│   ├── api-spec/                # OpenAPI 3.1 contract
│   ├── api-zod/                 # Generated Zod schemas
│   └── api-client-react/        # Generated TanStack Query hooks
├── scripts/                     # Maigret runner, ops scripts
├── specs/                       # Feature specifications
├── Dockerfile                   # Multi-stage production build
└── render.yaml                  # Render Blueprint config
```

---

## Setup

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 14+ with pgvector extension

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | PostgreSQL connection string (Neon auto-detects SSL) |
| `TELEGRAM_BOT_TOKEN` | yes (prod) | — | Telegram bot token for auth |
| `ADMIN_USERNAME` | no | `admin` | Admin login username |
| `ADMIN_PASSWORD` | yes (prod) | — | Admin password (no default) |
| `PORT` | no | `10000` | HTTP port |
| `LOG_LEVEL` | no | `info` | pino log level |
| `DB_POOL_MAX` | no | `10` | Max PG pool size |
| `JWT_SECRET` | no | auto | JWT signing secret |

### Development

```bash
pnpm install
pnpm run typecheck                              # Full typecheck
pnpm --filter @workspace/db run push            # Push schema to DB
pnpm --filter @workspace/api-server run dev     # API on :8080
pnpm --filter @workspace/lyosint run dev        # Frontend on :19190
pnpm --filter @workspace/api-spec run codegen   # Regenerate API types (after editing openapi.yaml)
```

### Production Build

```bash
pnpm run build
pnpm run start   # or: docker build -t lyosint . && docker run -p 3000:3000 lyosint
```

---

## API Summary

| Endpoint Group | Methods | Description |
|---------------|---------|-------------|
| `/api/health` | GET | Health check |
| `/api/stats` | GET | System statistics |
| `/api/platform-coverage` | GET | Search platform list |
| `/api/search/name` | POST | Search by name |
| `/api/search/phone` | POST | Search by phone |
| `/api/search/username` | POST | Search by username |
| `/api/search/deep` | POST | Cross-query search |
| `/api/search/:id` | GET | Search result data |
| `/api/search/:id/status` | GET | Search progress |
| `/api/searches/recent` | GET | Recent searches |
| `/api/auth/*` | POST/GET | Auth (register, login, Telegram, 2FA, password reset) |
| `/api/admin/*` | POST/GET | Admin (stats, users, settings, system config) |

All search endpoints return `202 Accepted` immediately with a task ID. Frontend polls `/search/:id/status` until completion. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full endpoint details.

---

## Deployment

### Render + Neon

```bash
git push main   # Auto-deploys via render.yaml
```

The Dockerfile builds a single image with:
- Python 3.12 + Maigret 0.6.1 sidecar
- Non-root app user
- tini init system
- Health check endpoint

### Manual Docker

```bash
docker build -t lyosint .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://... \
  -e TELEGRAM_BOT_TOKEN=... \
  -e ADMIN_PASSWORD=... \
  lyosint
```

---

## Contributing

1. Read the phase plan in [docs/PHASE_PLAN.md](./docs/PHASE_PLAN.md)
2. Understand the architecture in [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Check [TECH_STACK.md](./TECH_STACK.md) for technology decisions
4. Use `pnpm` (not npm/yarn) — the preinstall script enforces this
5. Run `pnpm run typecheck` before committing
6. Keep files under 500 lines
7. Follow the existing code conventions (TypeScript strict, RTL-first Arabic UI)
8. All UI text must support Arabic; error messages should be bilingual

---

## License

MIT
