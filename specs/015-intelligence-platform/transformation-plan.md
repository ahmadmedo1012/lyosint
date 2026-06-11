# Transformation Plan: LYOSINT Entity-Centric Intelligence Platform

## Phase 0 — Foundation (Weeks 1-2)

### 0.1 Entity Database Schema
```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  entity_type TEXT DEFAULT 'person',  -- person, organization, email, phone, etc.
  confidence REAL DEFAULT 0.0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  search_id UUID REFERENCES searches(id),
  source_platform TEXT NOT NULL,
  evidence_type TEXT NOT NULL,        -- profile, email, phone, address, image, etc.
  evidence_value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  fingerprint TEXT NOT NULL UNIQUE,   -- SHA256 of source+type+value
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID REFERENCES entities(id),
  target_entity_id UUID REFERENCES entities(id),
  relationship_type TEXT NOT NULL,    -- knows, works_with, same_name, etc.
  strength REAL DEFAULT 1.0,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  evidence_ids UUID[] DEFAULT '{}',
  UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  description TEXT NOT NULL,
  source_evidence UUID REFERENCES evidence(id),
  confidence REAL DEFAULT 1.0
);

CREATE TABLE dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  entity_ids UUID[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'draft',        -- draft, final, archived
  content JSONB DEFAULT '{}'
);
```

### 0.2 Server Infrastructure
- Redis for job queue (BullMQ) + caching layer
- Worker pool for search execution (separate Node.js worker processes)
- IP-based rate limiting middleware
- Drizzle connection pool tuning (25 connections)

### 0.3 API Key Security
- Encrypt secret values in DB (AES-256-GCM)
- Decrypt on read in settings service
- Admin UI never exposes decrypted values (already implemented)

## Phase 1 — Entity Extraction & Persistence (Weeks 3-4)

### 1.1 Post-Search Entity Extraction
- After search completes, extract entities from IdentityReport
- Create/update entity records for each identified person/profile
- Create evidence records for each platform result
- Fingerprint evidence with SHA256 to prevent duplicates

### 1.2 Incremental Correlation
- Correlate new observations against existing entities (not N²)
- DB-indexed lookups on email, phone, website
- New entity: create fresh record
- Match: merge into existing entity (add alias, append evidence, update confidence)

### 1.3 Evidence Chain of Custody
- Every evidence record tracks: source search, source platform, timestamp, raw data reference
- Evidence fingerprint prevents reprocessing across searches
- Confidence degrades over time (optional TTL per evidence type)

## Phase 2 — Intelligence Graph (Weeks 5-6)

### 2.1 Relationship Engine
- Detect relationships between entities sharing: same phone, same email, same address, same IP
- Create bidirectional relationship edges in `relationships` table
- Score relationship strength (1.0 = confirmed, 0.5 = inferred)

### 2.2 Graph Query API
- `GET /entities/:id/graph?depth=2` — return entity graph with configurable depth
- `GET /entities/:id/relationships` — list direct relationships
- `GET /graph/path?from=A&to=B` — shortest path between two entities

### 2.3 Frontend Graph Visualization
- Force-directed graph (d3-force or react-force-graph)
- Node: entity (color by type, size by confidence)
- Edge: relationship (width by strength)
- Click node → expand, click edge → show evidence
- Search → highlight matching nodes

## Phase 3 — Evidence & Timeline (Weeks 7-8)

### 3.1 Evidence Dashboard
- Per-entity evidence list with source, date, confidence
- Evidence filtering by type, platform, date range
- Evidence detail modal: raw data, chain of custody, related entities

### 3.2 Timeline Engine
- Extract temporal data from evidence
- Build entity timeline: "2019: Joined GitHub, 2020: Email leaked in breach, 2023: Telegram account"
- Frontend: horizontal timeline with event cards

### 3.3 Evidence-Based Confidence
- Entity confidence = weighted aggregation of evidence confidence × freshness
- Evidence without source confidence = not counted
- UI shows confidence breakdown: "85% confidence (12 pieces of evidence, 3 sources)"

## Phase 4 — Dossier Generation (Weeks 9-10)

### 4.1 Dossier Engine
- Structured report per entity: summary, aliases, platform profiles, contact info, timeline, relationships, risk assessment
- Evidence-linked: every claim references source evidence
- Export: PDF, JSON, HTML

### 4.2 Risk Scoring
- Risk factors: breach involvement, anonymous profiles, conflicting identity data, number of aliases
- Scoring: 0-100 with breakdown per factor
- Visual: risk gauge + factor list

### 4.3 Frontend Dossier View
- Tabbed layout: Overview, Evidence, Timeline, Relationships, Risk
- Print-friendly mode
- Export button

## Phase 5 — Human-Assisted Intelligence (Weeks 11-12)

### 5.1 Manual Entity Management
- Merge entities: select two entities → confirm merge → new combined entity
- Split entity: select evidence to split into new entity
- Override: set alias, primary name, entity type

### 5.2 Match Approval Workflow
- Suggested matches requiring human confirmation
- Approve/reject/snooze UI
- Confidence threshold for auto-merge vs suggest mode
- Investigators can add notes to matches

### 5.3 Investigation Workspace
- Saved investigations: collections of entities, notes, timeline
- Collaboration: shared investigations (future)
- Search within investigation
- Investigation journal: log of actions

## Phase 6 — Memory Layer & Performance (Weeks 13-14)

### 6.1 Cumulative Intelligence
- Every search enriches existing entities
- Memory layer: entity history, previous searches that found this entity
- Search within your knowledge base ("have I seen this email before?")

### 6.2 Performance Infrastructure
- Redis caching: entity queries, evidence lookups, graph paths
- BullMQ queue: search jobs, correlation jobs, dossier generation jobs
- Worker pool: dedicated workers for heavyweight tasks
- Sub-5s first results for username searches
- 100k+ searches/month without degradation

### 6.3 Monitoring & Observability
- Search job tracking (queue depth, processing time, failure rate)
- Entity growth rate
- Evidence ingestion rate
- Correlation engine performance metrics
- API endpoint latency tracking

## Architecture Migration Strategy

### Current → Target

```
Current                        Target
─────────────────────────────────────────────────────
usernameSearch.ts              Search Job → Worker Queue
  ├── httpChecker              ├── HttpCheckerService (extracted)
  ├── freeApis                 ├── ApiService (extracted)
  ├── githubOsint              ├── GithubService (extracted)
  ├── whatsmyname              ├── WMNService (extracted)
  ├── maigret                  ├── MaigretService (extracted)
  └── correlationEngine        └── Intelligence Pipeline
                                  ├── Entity Extractor (new)
                                  ├── Evidence Ingester (new)
                                  ├── Relationship Detector (new)
                                  └── Confidence Calculator (new)

Inline processing              Queue-based processing
Ephemeral results              Persistent entities
No cross-search memory         Cumulative intelligence
Flat search results            Entity graph
```

### Migration Steps
1. **Phase P0**: Add entities/evidence tables alongside existing schema. No behavior change.
2. **Phase P1**: Add post-search entity extraction as optional side effect. Keep old API responses.
3. **Phase P2**: Deprecate old search-result JSONB columns in favor of entity API.
4. **Phase P3**: Frontend gradually transitions to entity-based views.
5. **Phase P4-P6**: Add dossiers, human-assisted intelligence, memory layer.

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Schema migration breaks existing data | Add new tables, don't modify existing columns until Phase 3 |
| Performance regression | Redis caching, worker pool, indexed queries |
| User confusion with new UI | Feature flags, gradual rollout, opt-in beta |
| Entity store grows unboundedly | Archival policy, evidence TTL, pagination |
| False positive correlations | Conservative auto-merge, human approval workflow |
| Evidence storage size | Fingerprint dedup, evidence retention policy, blob storage for raw data |
