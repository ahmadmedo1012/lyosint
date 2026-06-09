---
name: System Config Pattern
description: How system-wide settings (quota, timeouts, etc.) are stored and retrieved
---

All system config keys are prefixed `sys_*` and defined in `SYSTEM_CONFIG_DEFS` array in `settingsService.ts`.
They live in the same `settings` DB table as API keys but are separated logically by prefix.

Admin routes:
- GET /api/admin/system-config — returns all config with current values + defaults
- PUT /api/admin/system-config/:key — updates a single config value

Helper: `getSystemConfigNumber(key)` returns parsed integer with fallback to defaultValue.

**Why:** Avoids hardcoded constants scattered across services. Quota (sys_free_search_quota), subscription days, platform timeout, maintenance mode — all editable live from admin panel without restart.

**How to apply:** Before adding a new hardcoded constant that admins might want to tune, add it to SYSTEM_CONFIG_DEFS instead and read it with getSetting/getSystemConfig.
