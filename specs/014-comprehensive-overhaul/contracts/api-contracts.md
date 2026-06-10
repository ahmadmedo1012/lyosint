# API Contracts

## Search Endpoints

### POST /api/search/by-name
Request: `{ name: string (max 500 chars) }`
Response: `{ id: string (task UUID) }`
Description: Initiates a name-based OSINT search. Returns immediately with a task ID for polling.

### POST /api/search/by-phone
Request: `{ phone: string }`
Response: `{ id: string (task UUID) }`
Description: Initiates a phone-number OSINT search.

### POST /api/search/by-username
Request: `{ username: string }`
Response: `{ id: string (task UUID) }`
Description: Initiates a username-based OSINT search (heaviest — hits maigret + WMN + httpChecker + GitHub + breach APIs).

### POST /api/search/deep
Request: `{ name?: string, phone?: string, username?: string }`
Response: `{ id: string (task UUID) }`
Description: Cross-referenced search across all supported query types. Runs sub-searches in parallel.

### GET /api/search/:id/status
Response: `{ id, status, progress?: { phase, phaseIndex, totalPhases, percentage }, timingMs }`
Description: Polled by frontend to get real-time search progress.

### GET /api/search/:id/result
Response: `{ usernameResult?, nameResult?, phoneResult?, identityReport?, analysisSummary?, timingMs }`
Description: Returns completed search result. The status endpoint should be polled first to know when complete.

## Contract Changes Required for This Overhaul

### Status Response Enhancement
Add `timingMs` and `progress` fields to `/api/search/:id/status`:

```json
{
  "timingMs": {
    "phase1_initial": 1850,
    "phase2_deep": null
  },
  "progress": {
    "phase": "Scanning social networks (12/40 platforms checked)",
    "phaseIndex": 1,
    "totalPhases": 3,
    "percentage": 33
  }
}
```

### Result Response Enhancement
Add per-platform `responseTimeMs` to each platform result in the response for transparency.

### Error Response Contract
Standardized error responses across all endpoints:
```json
{
  "error": {
    "code": "QUOTA_EXCEEDED | TIMEOUT | INTERNAL_ERROR | VALIDATION_ERROR",
    "message": "Human-readable error in Arabic or English",
    "details": {}
  }
}
```

## Frontend State Contract

### Loading State Shape
Every page component MUST handle these states for each data dependency:
1. **loading**: show skeleton/spinner (never null/blank)
2. **error**: show error UI with retry (never swallow silently)
3. **empty**: show empty state message (no data available)
4. **success**: render data

### Page Transition Contract
All page transitions MUST:
- Use `<PageTransition>` from `@/components/page-transition` wrapping the page content
- Complete animation within 300ms
- Never show white flashes or layout shift during transition

### Error Boundary Contract
- Every page route MUST be wrapped in `<ErrorBoundary>`
- ErrorBoundary MUST display:
  - Alert icon
  - Arabic error title ("حدث خطأ غير متوقع")
  - "تحديث الصفحة" (reload) button
  - Custom fallback via `fallback` prop
