# Data Model: Improving Search Performance + Wattpad Redirect Fix

**Feature**: 013-improving-search-performance
**Date**: 2026-06-08

## Entities

### Search Session

Represents a single search operation with progressive result storage.

**Fields**:
- `id` (text, primary key): Unique session identifier
- `status` (enum): pending → running → completed / failed
- `type` (enum): name / phone / username / deep
- `query` (text): User's search input
- `progress` (integer): 0-100 percentage (multiple checkpoints: 5% → 25% → 55% → 68% → 88% → 100%)
- `platforms_searched` (integer): Number of platforms checked so far
- `platforms_total` (integer): Total platforms to check
- `results_count` (integer): Number of profiles found
- `confidence_score` (real): 0.0-1.0 confidence in results
- `name_result` (jsonb): Name search results (nullable)
- `phone_result` (jsonb): Phone search results (nullable)
- `username_result` (jsonb): Username search results — **contains progressive/incremental results at multiple checkpoints**
- `created_at` (timestamp): Session creation time
- `completed_at` (timestamp): Session completion time (nullable)

**State Transitions**:
- `pending` → `running`: When search starts
- `running` → `completed`: When all phases finish successfully
- `running` → `failed`: On unhandled error
- Intermediate `running` → `running`: Partial results saved at checkpoints (5% → 25% → 55% → 68% → 88%)

**New Attributes for This Feature**:
- `redirect_events` (jsonb, new): Array of redirect events for debugging
- `phase1_completed_at` (timestamp, new): When Phase 1 finished
- `phase2_started_at` (timestamp, new): When Phase 2 started

### Platform Result

Represents a found profile on an external platform.

**Fields**:
- `slug` (text): Platform identifier (e.g., "facebook", "github")
- `name` (text): Platform display name
- `category` (text): Platform category (social, developer, etc.)
- `status` (enum): found / not_found / error
- `url` (text | null): Profile URL if found (null if not_found or error)
- `verified` (boolean): Whether existence was verified
- `profileData` (jsonb): Enriched data (bio, image, detection method, error details)

**New Attributes for This Feature**:
- `redirectChain` (array, new): Sequence of redirects if cross-domain detected
- `detectionMethod` (string, new): "status_code" | "message" | "redirect_detection"
- `httpStatus` (integer, new): Final HTTP status code

### Redirect Event

**New Entity** — records cross-domain redirect occurrences for debugging.

**Fields**:
- `search_id` (text, foreign key): Associated search session
- `platform_slug` (text): Platform where redirect occurred
- `original_url` (text): Original URL requested
- `final_url` (text): Final URL after redirects
- `original_host` (text): Original domain
- `final_host` (text): Final domain (different from original)
- `http_status` (integer): HTTP status code
- `timestamp` (timestamp): When redirect was detected

**Validation Rules**:
- `search_id` must reference an existing search session
- `original_host` ≠ `final_host` (cross-domain only)
- `timestamp` is auto-set on creation

## Schema Changes

No breaking changes to existing schema. New fields are additive:
- `redirect_events` table (new)
- Additional fields on existing result structures stored in `username_result` jsonb
