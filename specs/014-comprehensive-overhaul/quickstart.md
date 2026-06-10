# Quickstart: Comprehensive Project Overhaul

## Backend Performance Fixes

### 1. Parallelize Phase 2 (highest impact)
**File**: `artifacts/api-server/src/services/usernameSearch.ts`

Run WMN full scan and Maigret large scan concurrently instead of sequentially:
```typescript
// Instead of:
const wmnResults = await checkWhatsMyName(username, true); // sequential
const maigretResults = await runMaigret(username);          // waits for WMN

// Do:
const [wmnResults, maigretResults] = await Promise.allSettled([
  checkWhatsMyName(username, true),
  runMaigret(username),
]);
```

### 2. Add Phase 1 global timeout
**File**: `artifacts/api-server/src/services/usernameSearch.ts`

Wrap Phase 1 `Promise.allSettled` with a race against a timeout:
```typescript
const PHASE1_TIMEOUT = 15000; // 15s
const phase1 = Promise.allSettled([...phase1Tasks]);
const phase1WithTimeout = Promise.race([
  phase1,
  new Promise((_, reject) => setTimeout(() => reject(new Error("Phase 1 timeout")), PHASE1_TIMEOUT)),
]);
```

### 3. Add body-read timeout to httpChecker and githubOsint
**File**: `artifacts/api-server/src/services/httpChecker.ts` (line ~454)

```typescript
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
const body = await Promise.race([
  response.json(),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Body read timeout")), 3000)),
]);
```

**File**: `artifacts/api-server/src/services/githubOsint.ts` (line ~25) — same pattern.

### 4. Add LRU eviction to in-memory caches
**File**: `artifacts/api-server/src/lib/cache.ts` (create if not exists)

```typescript
export class LRUCache<K, V> {
  private max: number;
  private map: Map<K, { value: V; expiresAt: number }>;
  constructor(max: number) { this.max = max; this.map = new Map(); }
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry || Date.now() > entry.expiresAt) { this.map.delete(key); return undefined; }
    this.map.delete(key); this.map.set(key, entry); // LRU reorder
    return entry.value;
  }
  set(key: K, value: V, ttlMs: number) {
    if (this.map.size >= this.max) { const first = this.map.keys().next().value; this.map.delete(first); }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
```

Replace `Map` in `httpChecker.ts:590` and `freeApis.ts:12` with `LRUCache` (max 1000 entries).

## Frontend UI Fixes

### 1. Fix account.tsx blank screen
**File**: `artifacts/lyosint/src/pages/account.tsx` (line ~33)

```typescript
// Instead of:
if (!user) return null;

// Do:
if (!user) return (
  <div className="space-y-6 page-transition" dir="rtl">
    <Skeleton className="h-8 w-48 rounded-lg" />
    <Skeleton className="h-64 rounded-xl" />
    <Skeleton className="h-32 rounded-xl" />
  </div>
);
```

### 2. Wrap admin route in ErrorBoundary
**File**: `artifacts/lyosint/src/App.tsx`

Move the admin route rendering inside the `<ErrorBoundary>` wrapper.

### 3. Add error states to history.tsx, platforms.tsx, dashboard.tsx
Use TanStack Query's `isError`/`error` to show error banners with retry buttons instead of silently showing empty/zero data.

### 4. Replace admin spinners with skeleton loaders
In `admin.tsx` tabs, replace `<Loader2 className="animate-spin" />` with `<Skeleton className="h-12 rounded-lg" />` blocks matching the tab content shape.

## Verification

```bash
# TypeScript check
pnpm run typecheck

# Backend tests
pnpm run test --filter @workspace/api-server

# Build
pnpm run build
```
