# Intelligence Capability Audit: LYOSINT Correlation & Identity Resolution

## 1. Correlation Engine Analysis (`correlationEngine.ts` — 566 lines)

### 1.1 Capabilities

**Identity Clustering**
- Builds `IdentityClusterReport` from platform results
- Supports 6 hard correlation triggers:
  1. **Email match** — same email across platforms → strong merge
  2. **Phone match** — same phone across platforms → strong merge
  3. **Website match** — same personal site/URL → strong merge
  4. **Image/avatar match** — identical avatar URL → medium merge
  5. **Same name + username** — name variations match + usernames match → medium merge
  6. **Partial name overlap** — any name token matches across profiles → weak merge

**Evidence Model**
- `CorrelationEvidenceItem` with: type, source, target, strength, confidence, description
- Evidence can be: `email_match`, `phone_match`, `website_match`, `image_match`, `name_username_match`, `partial_name_overlap`

**Confidence Scoring**
- Base score computation per profile (platform reliability weight)
- Cluster augmentation with evidence confidence
- Final cluster score computed as weighted average

**Arabic Intelligence Summary**
- `generateArabicSummary()` produces natural-language Arabic description of findings
- Mentions: total profiles found, platforms with matches, conflicting details, confidence level, suggested investigation direction

**Identity Conflict Detection**
- Detects when same profile field (email, phone, location) differs between sources
- Flags as conflict rather than merging

### 1.2 Gaps

| Gap | Impact | Priority |
|---|---|---|
| **No entity persistence** — IdentityReport generated fresh per search, never stored | No cross-search correlation. Searching "Ahmed" twice creates independent reports. | CRITICAL |
| **No entity ID** — No stable identifier for a person across searches | Cannot merge intelligence across sessions. | CRITICAL |
| **No relationship detection** — No edges between entities | Cannot build intelligence graph. No "Ahmed knows Mohamed" inference. | HIGH |
| **No timeline** — No temporal ordering of findings | Cannot reconstruct sequence of events. | HIGH |
| **No dossier generation** — No structured output per entity | Cannot produce final intelligence product. | HIGH |
| **No risk scoring** — No threat/risk assessment | Cannot triage entities by priority. | MEDIUM |
| **No source deduplication** — Same data from multiple sources counted multiple times | Inflated confidence scores. | MEDIUM |
| **No evidence fingerprinting** — No hash/digest for evidence dedup | Same piece of evidence across searches = stored multiple times. | MEDIUM |
| **Memory layer absent** — No cumulative intelligence | Every search starts from zero. Previous discoveries lost. | CRITICAL |

### 1.3 Strength Assessment

**What works well:**
- Hard correlation triggers are correctly cautious (email/phone/website match before merging)
- Arabic summary generation is unique and valuable for Arabic-speaking analysts
- Evidence model is well-structured (type, source, target, strength, confidence)
- Conflict detection prevents incorrect merges

**What needs improvement:**
- No soft matching (fuzzy name matching, Levenshtein, phonetic)
- No ML-assisted resolution
- No human-in-the-loop confirmation
- No merge/split operations

## 2. Source Coverage

### 2.1 Platform Checkers

**Username-based (verified via HTTP)**: 37 platforms
- Direct API responses (JSON/HTTP status check)
- Examples: GitHub, Twitter, Instagram (404-based), Reddit, Telegram, YouTube, Pinterest, TikTok, Snapchat, Discord

**Username-based (manual/link-only)**: 43 platforms
- Only link generation, no verification
- User must manually click to verify

**WMN (What's My Name)**: 732 sites
- Crowdsourced username checking
- 40 shallow + 732 deep

**Maigret**: 500-3155 sites
- Python-based, most comprehensive
- Configurable depth

**Name-based**: GitHub, Hunter.io, Google dork links

**Phone-based**: Numverify (valid/invalid check), carrier + region lookup, Google search links

**Email-based**: HIBP (breach check), EmailRep.io, Hunter.io verification

**Breach/Leak**: HIBP, LeakCheck, 4G42

**Data Enrichment**: VirusTotal (domain resolution), Shodan (IP), crt.sh (certificates), IPInfo, ip-api.com

**Image**: TinEye (reverse image search link)

### 2.2 Source Quality

| Source Type | Reliability | Latency | Coverage |
|---|---|---|---|
| Direct API (verified) | HIGH | 1-5s | 37 platforms |
| WMN shallow | MEDIUM | 2-10s | 40 sites |
| WMN deep | LOW (redirects/unstable) | 10-30s | 732 sites |
| Maigret | MEDIUM | 30-120s | 500-3155 sites |
| HTTP status check | MEDIUM | 1-3s | 37 platforms |
| HIBP | HIGH | 1-3s | Breach data |
| Numverify | HIGH | 1-2s | Phone validation |
| GitHub API | HIGH | 1-3s | Code/profile data |
| EmailRep | MEDIUM | 1-3s | Email reputation |

## 3. Correlation Complexity Analysis

### 3.1 Current Flow

```
Platform Results (400+ entries)
  ↓ normalizePlatforms() → NormalizedProfile[]
  ↓ correlationEngine()
    ↓ Build observation from each platform → PlatformObservation[]
    ↓ Cluster observations by hard matches → IdentityCluster[]
    ↓ Score each cluster → cluster.confidence
    ↓ Detect conflicts → cluster.conflicts
    ↓ Generate summary → generateArabicSummary()
  ↓ IdentityReport (ephemeral, returned in API response)
```

### 3.2 N^2 Comparison Problem

**Current**:
- `O(P × O²)` where P = number of platform results, O = number of observations
- For 500 results, that's ~125,000 pair comparisons
- Each comparison: check 6 correlation triggers (email, phone, website, image, name+username, partial name)
- Total: ~750,000 individual checks
- Runtime: ~50-200ms

**At entity-centric scale**:
- 10M entities would mean N² comparisons is infeasible
- Need: precomputed entity fingerprints, indexed evidence table, incremental correlation

**Recommendation**:
- Extract correlation into incremental process (new observations vs existing entities only)
- Use DB indexes for email/phone/website lookups
- Cache entity fingerprints for O(1) lookup

## 4. Readiness Assessment

### 4.1 Entity-Centric Readiness

| Component | Readiness | Work Needed |
|---|---|---|
| Identity resolution | 40% | Persistence, incremental correlation, fuzzy matching, merge/split |
| Evidence model | 60% | Fingerprinting, dedup, chain of custody, pagination |
| Confidence scoring | 30% | Cross-search accumulation, decay, evidence freshness |
| Relationship detection | 0% | Graph engine, relation types, directionality, strength |
| Timeline engine | 0% | Temporal ordering, event extraction, chronology |
| Dossier generation | 0% | Structured output, evidence linking, risk assessment |
| Intelligence graph | 0% | Graph DB integration, query API, visualization |
| Memory layer | 0% | Cumulative store, session merging, entity history |
| Human-assisted intelligence | 0% | Approve/reject, manual merge, investigator notes |

### 4.2 Score: 16/100

Current codebase has **16%** of the intelligence capability needed for an entity-centric OSINT platform. Core strength is the correlation engine's evidence model and Arabic support — but 60% of required components are entirely unimplemented.

## 5. Key Recommendations

1. **Entity persistence first** — Add `entities` table, promote IdentityReport to stored entity
2. **Evidence fingerprinting** — Hash-based dedup to prevent duplicate evidence across searches
3. **Incremental correlation** — Correlate only new observations against existing entities, not full N²
4. **Human-in-the-loop** — Merge/split UI, approve/reject matches
5. **Memory layer** — Session merging, cross-search entity enrichment
6. **Graph engine** — DB-level relationship edges, then graph query API
