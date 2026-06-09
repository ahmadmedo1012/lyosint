# Identity Correlation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the search platform from parallel independent searches into an intelligent identity correlation engine that clusters related accounts, scores confidence, eliminates false positives, and generates structured intelligence reports instead of raw result lists.

**Architecture:** This plan implements a 6-stage pipeline: (1) Data Collection normalizes results from all sources, (2) Entity Grouping clusters findings into candidate identities, (3) Correlation Analysis compares evidence across entities, (4) Confidence Scoring assigns relationship probability, (5) False Positive Filtering removes weak/unrelated clusters, and (6) Intelligence Report generation structures findings for display. The system builds an identity graph during search execution, then traverses it to generate correlation-aware reports with supporting evidence.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL with JSONB), graph algorithms (Union-Find for clustering), string similarity algorithms (Levenshtein, Jaro-Winkler, cosine), TF-IDF for text analysis.

---

## File Structure Overview

**New Core Modules:**
- `/artifacts/api-server/src/services/correlation/identityModel.ts` - Identity entity definitions
- `/artifacts/api-server/src/services/correlation/evidenceModel.ts` - Evidence tracking and scoring
- `/artifacts/api-server/src/services/correlation/similarityEngine.ts` - String/text similarity algorithms
- `/artifacts/api-server/src/services/correlation/entityGrouping.ts` - Clustering logic (Union-Find)
- `/artifacts/api-server/src/services/correlation/correlationAnalyzer.ts` - Cross-entity analysis
- `/artifacts/api-server/src/services/correlation/confidenceScorer.ts` - Evidence-based scoring
- `/artifacts/api-server/src/services/correlation/falsePositiveFilter.ts` - Weak match elimination
- `/artifacts/api-server/src/services/correlation/intelligenceReporter.ts` - Report generation

**Modified Existing:**
- `/lib/db/src/schema/searches.ts` - Add identity graph columns
- `/artifacts/api-server/src/services/usernameSearch.ts` - Replace result building with correlation
- `/artifacts/api-server/src/routes/search.ts` - Add correlation query endpoints
- `/artifacts/lyosint/src/pages/search-result.tsx` - Display intelligence reports

---

## Phase 1: Foundation - Identity Graph & Data Structures

### Task 1: Define Identity Entity Model
**Complexity:** Low | **Files:** 1 | **Tests:** Yes | **Est. Time:** 15-20 min

Files: Create `/artifacts/api-server/src/services/correlation/identityModel.ts`

Implement:
- `Identity` class with normalized fields (username, email, displayName, bio)
- `IdentityCluster` class for grouping related identities
- Evidence tracking with correlation type, score, and description
- Normalization methods (lowercase, remove special chars, tokenization)

Test requirements:
- Identity creation with automatic field normalization
- Token extraction from display names and bios
- Cluster creation and evidence addition
- Conflict detection when multiple identities from same source

---

### Task 2: Define Evidence Model & Scoring Framework
**Complexity:** Low | **Files:** 1 | **Tests:** Yes | **Est. Time:** 15-20 min

Files: Create `/artifacts/api-server/src/services/correlation/evidenceModel.ts`

Implement:
- `EvidenceWeights` class with hardcoded weights for each evidence type
- `EvidenceScore` class that accumulates factors and calculates totals
- `DetailedEvidenceTracker` for tracking individual evidence pieces
- Confidence levels (very_high, high, medium, low, very_low)
- Penalty system for conflicts

Test requirements:
- Weight initialization
- Factor accumulation and score capping (max 0.97)
- Penalty application
- Confidence level determination from score

---

### Task 3: Update Database Schema for Identity Graph
**Complexity:** Low | **Files:** 1 | **Tests:** No | **Est. Time:** 10 min

Files: Modify `/lib/db/src/schema/searches.ts`

Add columns to searches table:
- `identityClusters` JSONB - Stores clustered identities with evidence
- `correlationReport` JSONB - Intelligence report output
- `correlationMetadata` JSONB - Analysis stats (platforms, time, version)
- `crossSearchLinks` JSONB - Links to related searches (name/phone/username)

---

## Phase 2: Correlation Engine - Similarity & Grouping

### Task 4: Implement Similarity Engine
**Complexity:** Medium | **Files:** 1 | **Tests:** Yes | **Est. Time:** 25-30 min

Files: Create `/artifacts/api-server/src/services/correlation/similarityEngine.ts`

Implement three similarity algorithms:
- **LevenshteinSimilarity**: Character-level distance (0-1 score)
- **JaroWinklerSimilarity**: Fuzzy string matching with prefix bonus
- **CosineSimilarity**: Token set overlap (for bio/text comparison)

Public methods:
- `compareUsernames(a, b)` - Normalized comparison using Jaro+Levenshtein blend
- `compareEmails(a, b)` - Compare local and domain separately
- `compareDisplayNames(a, b)` - Case-insensitive fuzzy matching
- `analyzeBioOverlap(bioA, bioB)` - Token-level overlap analysis

Test requirements:
- Exact matches return 1.0
- Similar variants (ahmad vs ahmed) >0.8
- Generic comparison returns consistent ordering
- Email dot-normalization (a.b@x.com = ab@x.com)
- Bio text overlap with Jaccard coefficient

---

### Task 5: Implement Entity Grouping (Union-Find Clustering)
**Complexity:** Medium | **Files:** 1 | **Tests:** Yes | **Est. Time:** 25-30 min

Files: Create `/artifacts/api-server/src/services/correlation/entityGrouping.ts`

Implement:
- **UnionFind** class: Path compression + union by rank
- **EntityGrouper** class: Build similarity matrix → cluster via Union-Find
- Conflict detection (multiple identities from same source)
- Evidence population in clusters

Public methods:
- `group(identities, threshold)` - Returns array of IdentityCluster objects
- Threshold filtering: Only link if similarity ≥ threshold

Test requirements:
- Union-Find correctly groups transitive relationships
- Conflict detection flags same-source duplicates
- Threshold filtering respected
- Evidence properly attributed to cluster

---

## Phase 3: Confidence Scoring & Correlation Analysis

### Task 6: Implement Correlation Analyzer
**Complexity:** Medium-High | **Files:** 1 | **Tests:** Yes | **Est. Time:** 30-40 min

Files: Create `/artifacts/api-server/src/services/correlation/correlationAnalyzer.ts`

Implement:
- `analyzeIdentityPair(id1, id2)` - Detailed pairwise comparison
- Evidence factors: username, email, phone, display name, bio, website, image, location, verified status
- Conflict detection across pairs
- Recommendation generation (likely_same / possibly_same / uncertain / likely_different)

Public methods:
- `analyzeIdentityPair()` - Returns IdentityPairAnalysis with factors and conflicts
- `detectClusterConflicts()` - Find critical/high/medium/low conflicts
- `rankEvidenceByStrength()` - Sort factors by weight

Test requirements:
- Perfect matches score high
- Partial matches ranked by evidence type
- Conflicts detected and penalized
- Recommendations align with scores

---

### Task 7: Implement Confidence Scorer
**Complexity:** Medium-High | **Files:** 1 | **Tests:** Yes | **Est. Time:** 30-40 min

Files: Create `/artifacts/api-server/src/services/correlation/confidenceScorer.ts`

Implement:
- `scoreCluster()` - Return ClusterConfidenceScore with all metadata
- Penalty application for conflicts (critical -30%, high -15%, medium -10%, low -5%)
- Review flagging for low confidence or conflicts
- Reasoning generation

Public methods:
- `scoreCluster(cluster)` - Full scoring with penalties
- `scoreMultipleClusters()` - Batch scoring
- `filterByConfidenceThreshold()` - Filter results above threshold

Test requirements:
- Strong matches (email + username) score >75%
- Penalties correctly reduce score
- Low confidence flagged for review
- Reasoning explains scoring

---

## Phase 4: Intelligence Report Generation & False Positive Filtering

### Task 8: Implement False Positive Filter
**Complexity:** Medium | **Files:** 1 | **Tests:** Yes | **Est. Time:** 25-30 min

Files: Create `/artifacts/api-server/src/services/correlation/falsePositiveFilter.ts`

Implement:
- Generic username detection (user, admin, test, john, etc.)
- Common username variation patterns (user1 vs user2, ahmed vs ahmed99)
- Generic display name detection
- Conflicting metadata detection
- False positive likelihood scoring

Public methods:
- `filterResults(scores, threshold)` - Separate passed/culled
- `identifyFalsePatterns(cluster)` - Return array of FalsePositiveFlag
- `isCommonUsernameVariation()` - Boolean check for patterns
- `scoreFalsePositiveLikelihood()` - Return 0-1 likelihood score

Test requirements:
- Generic usernames flagged
- Location conflicts detected
- Variation-only evidence flagged as weak
- Score reflects combined risk factors

---

### Task 9: Implement Intelligence Reporter
**Complexity:** Medium | **Files:** 1 | **Tests:** Yes | **Est. Time:** 25-30 min

Files: Create `/artifacts/api-server/src/services/correlation/intelligenceReporter.ts`

Implement:
- `generateReport()` - IntelligenceReport with summary and clusters
- Platform reference generation with search URLs
- Text formatting for export
- JSON export capability

Public methods:
- `generateReport(scores, clusters, timeMs, query)` - Full structured report
- `generatePlatformReferences()` - Create search URLs per platform
- `formatAsText()` - Human-readable output
- `formatAsJSON()` - Machine-readable output

Test requirements:
- Report captures all cluster data
- Summary stats correct
- Platform references include search URLs
- Language support (en/ar)

---

## Phase 5: Integration & API Exposure

### Task 10: Integrate Correlation Engine into Username Search
**Complexity:** High | **Files:** 1 modified | **Tests:** Yes | **Est. Time:** 30-40 min

Files: Modify `/artifacts/api-server/src/services/usernameSearch.ts`

Integration points:
- After `buildUsernameResult()`, convert profiles to Identity objects
- Include GitHub enrichment as separate identity source
- Run EntityGrouper → ConfidenceScorer → FalsePositiveFilter pipeline
- Generate IntelligenceReport
- Store results in database (identityClusters, correlationReport, correlationMetadata)

Test requirements:
- Correlation runs without blocking search completion
- Results stored correctly in database
- No existing tests broken

---

### Task 11: Add API Endpoints for Correlation Queries
**Complexity:** Medium | **Files:** 2 modified | **Tests:** Yes | **Est. Time:** 25-30 min

Files: Modify `/artifacts/api-server/src/routes/search.ts` and `/lib/api-spec/openapi.yaml`

New endpoints:
- `GET /search/{id}/identity-report` - Full intelligence report
- `GET /search/{id}/identity-clusters` - Raw cluster data
- `POST /search/{id}/verify-cluster` - Manual verification flag
- `POST /search/{id}/flag-false-positive` - Report false positives

Test requirements:
- Endpoints return correct data structures
- Authentication required
- 404 when report not available
- User verification/flagging persisted

---

### Task 12: Update Frontend to Display Intelligence Reports
**Complexity:** High | **Files:** 1 modified | **Tests:** Yes | **Est. Time:** 40-50 min

Files: Modify `/artifacts/lyosint/src/pages/search-result.tsx`

UI sections:
- Summary stats: strong/medium/weak/requires-review counts
- Cluster cards: identity details, evidence, conflicts, reasoning
- Action buttons: Verify as Same / Flag as False Positive
- Review notifications for flagged clusters

Test requirements:
- Reports display without errors
- Cluster details visible
- Action buttons functional
- No regression in existing search result display

---

### Task 13: Add Cross-Search Linking
**Complexity:** Medium | **Files:** 1 new | **Tests:** Yes | **Est. Time:** 20-25 min

Files: Create `/artifacts/api-server/src/services/correlation/deepSearchCorrelator.ts`

Implement:
- Link username search results to name search results
- Cross-reference email/phone discoveries
- Store cross-search links in database

Public methods:
- `correlateSearches(usernameResult, nameResult, phoneResult)` - Return linked identities

Test requirements:
- Username platforms linked to name emails
- Phone results correlated to username findings
- Overall confidence calculated

---

### Task 14: Performance Optimization & Indexing
**Complexity:** Low | **Files:** 1 modified | **Tests:** No | **Est. Time:** 10-15 min

Files: Modify `/lib/db/src/schema/searches.ts`

Add database indexes:
- `idx_searches_identity_clusters` on identityClusters
- `idx_searches_correlation_metadata` on correlationMetadata

Run migration.

---

### Task 15: Documentation & Completion
**Complexity:** Low | **Files:** 1 new | **Tests:** No | **Est. Time:** 15-20 min

Files: Create `/docs/CORRELATION_ENGINE.md`

Document:
- Architecture overview
- Algorithm descriptions
- API endpoints
- Configuration options
- False positive reduction strategies

---

## Task Summary

- [ ] Task 1: Define Identity Entity Model (Phase 1 foundation)
- [ ] Task 2: Define Evidence Model & Scoring Framework (Phase 1 foundation)
- [ ] Task 3: Update Database Schema (Phase 1 foundation)
- [ ] Task 4: Implement Similarity Engine (Phase 2 grouping)
- [ ] Task 5: Implement Entity Grouping (Phase 2 grouping)
- [ ] Task 6: Implement Correlation Analyzer (Phase 3 scoring)
- [ ] Task 7: Implement Confidence Scorer (Phase 3 scoring)
- [ ] Task 8: Implement False Positive Filter (Phase 4 reporting)
- [ ] Task 9: Implement Intelligence Reporter (Phase 4 reporting)
- [ ] Task 10: Integrate into Username Search (Phase 5 integration)
- [ ] Task 11: Add API Endpoints (Phase 5 integration)
- [ ] Task 12: Update Frontend Display (Phase 5 integration)
- [ ] Task 13: Add Cross-Search Linking (Phase 5 integration)
- [ ] Task 14: Performance Optimization & Indexing (Phase 5 optimization)
- [ ] Task 15: Documentation (Phase 5 completion)

---
