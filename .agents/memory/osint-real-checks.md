---
name: Real OSINT HTTP Check Architecture
description: How the real (non-simulated) platform checks work in usernameSearch
---

**Verified platforms (real HTTP checks, server-side):**
- GitHub: `https://api.github.com/users/{u}` → 200/404 JSON
- GitLab: `https://gitlab.com/api/v4/users?username={u}` → JSON array
- Bitbucket: `https://api.bitbucket.org/2.0/users/{u}`
- Dev.to: `https://dev.to/api/users/by_username?url={u}`
- HackerNews: Firebase API (`/v0/user/{u}.json`) → null or object
- Keybase: `/_/api/1.0/user/lookup.json?username={u}`
- Reddit: `/user/{u}/about.json` with User-Agent header
- NPM registry: `/org.couchdb.user:{u}` HTTP status
- Replit: profile page HTTP status

**Manual-check platforms (blocked, just provide URL):**
Facebook, Instagram, Twitter/X, TikTok, LinkedIn, Snapchat, Telegram, YouTube, Spotify, etc.

**Why:** These platforms block server-side requests. Providing the URL is more honest and actionable than returning fake "found/not found" data.

**Concurrency:** 6 concurrent requests max (CONCURRENCY = 6), AbortController with 5s timeout per request.

**GitHub enrichment:** If GitHub returns "found", getGitHubProfile() fetches repos, languages, orgs.

**Optional API services** (from settings DB, configured in admin panel):
- `github_token` — raises rate limit from 60 to 5000 req/hr
- `hunter_api_key` — email finder
- `hibp_api_key` — breach check
- `numverify_api_key` — phone validation
- `virustotal_api_key` — URL/IP/domain threat check
- `twitch_client_id` + `twitch_client_secret` — Twitch user lookup

**How to apply:** When adding new verified platform checks, add to VERIFIED_PLATFORMS array in `httpChecker.ts`. When adding free-API integrations, add to `freeApis.ts` and DEFINED_SERVICES in `settingsService.ts`.
