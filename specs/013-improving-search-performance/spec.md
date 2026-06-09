# Feature Specification: Improving Search Performance + Wattpad Redirect Fix

**Feature Branch**: `013-improving-search-performance`

**Created**: 2026-06-08

**Status**: Draft

**Input**: "Search is still slow, needs faster initial results so users don't get bored. Also the link redirects to Wattpad — find and fix the root cause correctly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast Initial Results (Priority: P1)

A user searches for a username. Within 3-5 seconds, they see the first batch of results (social media + any fast checks). Remaining results load progressively without blocking the initial display.

**Why this priority**: Users perceive the tool as slow when they wait 20-30s with zero feedback. Showing results fast prevents abandonment.

**Independent Test**: Search for a username, measure time-to-first-result. Should see at least 5-10 results within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a user submits a username search, **When** 3 seconds pass, **Then** at least some results are visible with a progress indicator
2. **Given** partial results are displayed, **When** background search continues, **Then** more results appear incrementally
3. **Given** the search completes, **Then** the final count matches the total platforms checked

---

### User Story 2 - No More Wattpad Redirects (Priority: P1)

A user searches for a username on any platform. If the profile doesn't exist, the link either shows "not found" or a correct error — it never redirects to Wattpad or any unrelated site.

**Why this priority**: Redirecting to Wattpad is confusing and makes results unreliable. Users can't trust the tool if links point to the wrong sites.

**Independent Test**: Search for a known non-existent username on Facebook, Instagram, and 5 other platforms. Verify none of the returned links redirect to Wattpad or any domain other than the searched platform.

**Acceptance Scenarios**:

1. **Given** a user searches for "nonexistent_user_xyz_999", **When** results are returned, **Then** no result URL contains "wattpad.com"
2. **Given** a platform redirects to a different domain, **When** the redirect is detected, **Then** the result is marked as "not found" and the redirect target is logged
3. **Given** a valid profile exists, **When** the link is clicked, **Then** it opens the correct profile page

---

### User Story 3 - Reliable Progressive Rendering (Priority: P2)

The frontend correctly renders partial results from the backend, updates progressively, and never shows stale or duplicate data.

**Why this priority**: Even if backend is fast, poor frontend rendering ruins the experience.

**Independent Test**: Run multiple searches, verify partial results appear and update correctly, no duplicates, no stale data.

**Acceptance Scenarios**:

1. **Given** partial results are saved at 25% progress, **When** the frontend polls, **Then** it displays those results with a "preliminary" indicator
2. **Given** full results replace partial results, **When** the update arrives, **Then** the UI transitions smoothly without page reload
3. **Given** a new search is started, **When** the old search was still running, **Then** only the new search results are displayed

---

### Edge Cases

- What happens when ALL external APIs are slow? System shows "checking platforms..." with animated progress.
- What happens when a platform's detection logic is wrong? Result shows as "not found" and is logged for manual review.
- What happens when the Wattpad redirect occurs via JavaScript (not HTTP redirect)? Detection must handle meta-refresh and JS redirects.
- What happens when search takes >60s? System shows timeout message with option to retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display first search results within 5 seconds of submission
- **FR-002**: System MUST save partial results to database at multiple checkpoints during search (not just at the end)
- **FR-003**: System MUST detect and prevent cross-domain redirects in platform URL checks (specifically Wattpad)
- **FR-004**: System MUST identify the root cause of the Wattpad redirect (which platform, which check method triggers it)
- **FR-005**: System MUST mark platforms with cross-domain redirects as "not found" instead of showing the redirect URL
- **FR-006**: System MUST render partial results in frontend within 2 seconds of them being available in the database
- **FR-007**: System MUST provide visual progress feedback during search (progress bar + percentage)
- **FR-008**: System MUST handle JavaScript-based redirects (not just HTTP 3xx)
- **FR-009**: System MUST log redirect chain details for debugging
- **FR-010**: System MUST prevent stale partial results from persisting after search completion

### Key Entities

- **Search Session**: Has status, progress (0-100), partial results at each checkpoint
- **Platform Result**: Has status (found/not_found/error), URL, redirect chain, detection method
- **Redirect Event**: Records original URL, final URL, redirect chain, timestamp, detection method

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First results appear within 5 seconds for 90% of username searches
- **SC-002**: Zero Wattpad (or other unrelated domain) URLs appear in any search results
- **SC-003**: Partial results are saved at 3+ checkpoints during a single search (not just start and end)
- **SC-004**: Frontend renders new results within 2 seconds of them being stored
- **SC-005**: All cross-domain redirects are detected and logged, not displayed to users

## Assumptions

- The Wattpad redirect is caused by Facebook's behavior for non-existent profiles (most likely cause)
- Some platforms may use JavaScript redirects instead of HTTP 3xx
- The current incremental search structure (Phase 1 + Phase 2) is correct but needs tuning for speed
- Frontend polling interval can be reduced without overloading the server
- External API rate limits are the main bottleneck for search speed
