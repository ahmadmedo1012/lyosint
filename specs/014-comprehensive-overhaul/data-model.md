# Data Model: Comprehensive Project Overhaul

## Entities

### SearchTask
Represents an in-progress or completed search operation.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | UUID | Unique identifier | Required, auto-generated |
| `userId` | UUID | Owning user | Required, FK to users |
| `type` | Enum | `name`, `phone`, `username`, `deep` | Required, one of 4 values |
| `query` | string | Raw search input | Required, max 500 chars |
| `status` | Enum | `pending`, `running`, `completed`, `failed` | Required |
| `progress` | object | `{ phase: string, phaseIndex: number, totalPhases: number, percentage: number }` | Optional |
| `createdAt` | datetime | When search was submitted | Required, auto-set |
| `updatedAt` | datetime | Last status change | Required, auto-update |
| `timingMs` | object | Per-phase timing breakdown `{ phaseName: durationMs }` | Optional, for UX transparency |

**State transitions**: `pending → running → completed` | `pending → running → failed` | `running → completed` | `running → failed`

### SearchResult
The output of a completed search.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | UUID | References SearchTask.id | Required |
| `usernameResult` | object | `{ profilesFound, platformsChecked, confidenceScore, ... }` | Optional (null if username not searched) |
| `nameResult` | object | `{ profiles, emails, ... }` | Optional |
| `phoneResult` | object | `{ carrier, country, validity, ... }` | Optional |
| `analysisSummary` | object | `{ totalProfiles, avgConfidence, dataSources, ... }` | Optional |
| `identityReport` | object | Correlation engine output with `{ identities, evidence, conflicts }` | Optional |

### PlatformResult
Data from a single external platform scan within a search.

| Field | Type | Description |
|-------|------|-------------|
| `platformName` | string | e.g., `github`, `twitter`, `instagram` |
| `siteUrl` | string | Base URL of the platform |
| `status` | Enum | `success`, `timeout`, `error`, `skipped` |
| `responseTimeMs` | number | How long the check took |
| `profileData` | object | Matched profile fields (varies by platform) |
| `errorMessage` | string | Human-readable error if applicable |

### CacheEntry
A cached response for deduplication and speed.

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Cache key (e.g., `wmn:username123`, `http:github:user`) |
| `value` | object | Cached response data |
| `ttlMs` | number | Time-to-live in milliseconds |
| `createdAt` | datetime | When cached |
| `hitCount` | number | How many times this cache entry was used |

**Not stored in DB** — lives in-memory only with LRU eviction.

## Relationships

```
User (1) ──< SearchTask (N) ── (1:1) ── SearchResult
SearchTask (1) ──< PlatformResult (N)
CacheEntry (standalone, in-memory, not persisted)
```

## JSON Schema Examples

### SearchTask (API response)
```json
{
  "id": "abc-123",
  "type": "username",
  "query": "john_doe",
  "status": "running",
  "progress": {
    "phase": "Scanning social networks (phase 1/3)",
    "phaseIndex": 1,
    "totalPhases": 3,
    "percentage": 33
  },
  "createdAt": "2026-06-09T10:00:00Z",
  "updatedAt": "2026-06-09T10:00:05Z",
  "timingMs": {
    "phase1_initial": 1850,
    "phase2_deep": null
  }
}
```

### PlatformResult (within search result)
```json
{
  "platformName": "GitHub",
  "siteUrl": "https://github.com",
  "status": "success",
  "responseTimeMs": 1200,
  "profileData": {
    "username": "john_doe",
    "avatar": "https://avatars.github.com/...",
    "bio": "Software developer",
    "publicRepos": 15
  }
}
```

## Validation Rules

- SearchTask.query: max 500 chars, must not be empty, trimmed of whitespace
- SearchTask.status: must follow state machine (no skipped states)
- PlatformResult.responseTimeMs: must be >= 0, max 120000 (2 min)
- CacheEntry.ttlMs: must be >= 1000 (1s min), max 86400000 (24h max)
