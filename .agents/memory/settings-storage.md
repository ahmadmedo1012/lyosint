---
name: Settings/API Keys Storage
description: How API keys are stored, retrieved, and managed in the admin panel
---

API keys for external services are stored in the `settings` DB table (created via Drizzle schema in `lib/db/src/schema/settings.ts`).

**Schema:** `key` (PK), `value`, `category`, `description`, `isSecret`, `updatedAt`

**Service:** `artifacts/api-server/src/services/settingsService.ts`
- `getSetting(key)` — cached read (30s TTL)
- `setSetting(key, value)` — upsert + invalidate cache
- `deleteSetting(key)` — delete + invalidate cache
- `DEFINED_SERVICES` — array of all available integrations with metadata

**Admin API endpoints:**
- `GET /api/admin/settings` — returns services with `isConfigured` status (NEVER returns actual values)
- `PUT /api/admin/settings/:key` — set a key value
- `DELETE /api/admin/settings/:key` — remove a key

**Security:** Actual key values are NEVER returned in API responses — only `isConfigured: true/false` and `updatedAt`.

**Why:** DB storage lets admin configure keys without server restart; in-memory cache keeps reads fast; never-expose pattern prevents key leakage via API.

**How to apply:** When adding a new external service, add it to `DEFINED_SERVICES` in `settingsService.ts`, implement the fetch in `freeApis.ts` or a dedicated file, and call `getSetting('your_key')` there.
