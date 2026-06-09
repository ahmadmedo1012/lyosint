# Research: Improving Search Performance + Wattpad Redirect Fix

**Feature**: 013-improving-search-performance
**Date**: 2026-06-08

## Decision 1: Root Cause of Wattpad Redirect

**Decision**: The Wattpad redirect is caused by Facebook's behavior when checking non-existent profiles. Facebook returns HTTP 200 with a login/registration page that includes a partner link to Wattpad. The current WMN checker follows redirects and sees the final page as a "valid" Facebook profile.

**Rationale**:
- Facebook uses Wattpad as a partner for login/registration flows
- When a profile doesn't exist, Facebook serves a generic page with "create account" options
- This page may contain Wattpad links or redirect through Wattpad's domain
- The existing `redirect: "follow"` setting tracks this as a successful Facebook response
- Cross-domain redirect detection was added but may need tuning

**Fix Strategy**:
- Detect redirects at the HTTP level (3xx responses) before following them
- Check final URL hostname against the original site hostname
- If different domain → mark as `not_found`, log redirect chain
- For Facebook specifically: also check page content for profile indicators

**Alternatives Considered**:
- Block Wattpad domain entirely: Rejected — too broad, might block legitimate Wattpad searches
- Use manual redirect mode for all sites: Rejected — breaks legitimate redirects (e.g., bit.ly links)
- Parse HTML for profile markers: Rejected — fragile, Facebook changes markers frequently

## Decision 2: Search Performance Optimization

**Decision**: Reduce Phase 1 timeout from 15s to 8s for WMN social sites, reduce Maigret Phase 1 from 6s to 4s, and increase Phase 1 concurrency from 30 to 40. Keep Phase 2 unchanged for completeness.

**Rationale**:
- Current Phase 1 takes ~10-15s due to 15s global timeout
- Social media sites respond in 1-3s typically — 8s is sufficient for 95% of cases
- Higher concurrency (40 vs 30) compensates for reduced timeout
- Phase 2 can take longer since results are already showing

**Optimization Targets**:
- Phase 1 (social): ≤5s for 90% of searches
- Phase 2 (remaining): ≤45s (starts after Phase 1)
- Total: ≤50s for 95% of searches

**Alternatives Considered**:
- Parallelize all 732 WMN sites: Rejected — too many concurrent requests, rate limiting
- Cache popular username checks: Rejected — limited benefit for OSINT (mostly unique queries)
- Pre-warm connections: Rejected — minimal gain vs implementation complexity

## Decision 3: Progressive Rendering Tuning

**Decision**: Reduce frontend polling interval from 1500ms to 1000ms when empty, and from 2000ms to 1500ms when partial results exist. Add a minimum 3-second delay before showing partial results to avoid flicker.

**Rationale**:
- Faster polling = faster UI updates
- But too aggressive polling wastes server resources
- 1s interval is a good balance for Render free tier
- Minimum 3s delay prevents UI flicker from very fast Phase 1 completions

**Alternatives Considered**:
- WebSocket push: Rejected — over-engineered, adds infrastructure
- SSE (Server-Sent Events): Rejected — requires backend changes
- Fixed 500ms polling: Rejected — too aggressive for free tier

## Decision 4: Maigret Integration Performance

**Decision**: Run Maigret Phase 1 with only 50 priority sites (instead of 200) and 4s timeout. Phase 2 runs full 500 sites with 8s timeout.

**Rationale**:
- Maigret subprocess overhead is ~2-3s startup time
- 50 sites complete in ~3-4s with parallelism
- 200 sites takes ~8-10s, pushing Phase 1 beyond 5s target
- Phase 2 can run full Maigret while frontend shows partial results

**Alternatives Considered**:
- Skip Maigret Phase 1 entirely: Rejected — Maigret finds platforms WMN doesn't cover
- Run Maigret only in Phase 2: Rejected — delays Maigret results by 10-15s
- Keep current 200 sites: Rejected — exceeds 5s target

## Decision 5: Redirect Detection Robustness

**Decision**: Implement two-layer redirect detection:
1. HTTP-level: Check `Location` header on 3xx responses before following
2. Final URL check: Compare final URL hostname with original site hostname

**Rationale**:
- Some redirects happen at HTTP level (3xx with Location header)
- Others happen at page level (JS redirects, meta-refresh)
- Two-layer approach catches both
- Facebook specifically needs both checks (HTTP redirect to login + JS redirect to partner)

**Alternatives Considered**:
- Only HTTP-level: Rejected — misses JS/meta-refresh redirects
- Only final URL check: Rejected — misses intermediate redirects
- Content-based detection: Rejected — fragile, requires parsing diverse HTML
