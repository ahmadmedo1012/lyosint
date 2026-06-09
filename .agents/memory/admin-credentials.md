---
name: Admin Credentials System
description: How admin login credentials are loaded and changed at runtime
---

Admin username and password are resolved in this priority order:
1. DB settings table key `sys_admin_username` / `sys_admin_password` (set via credentials tab in admin panel)
2. Environment variables `ADMIN_USERNAME` (default: "admin") / `ADMIN_PASSWORD`

**Why:** This allows live credential changes without restarting the server or touching env vars. Changing password clears all active admin sessions immediately.

**How to apply:** When debugging login failures, check DB first (sys_admin_password), then env var (ADMIN_PASSWORD). If DB value exists it wins.
