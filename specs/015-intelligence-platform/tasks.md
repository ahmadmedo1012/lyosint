# Implementation Tasks: Intelligence Platform

## Phase 0 — Foundation
- [ ] T001: Create `entities` table schema in `lib/db/src/schema/`
- [ ] T002: Create `evidence` table schema with fingerprint
- [ ] T003: Create `relationships` table schema
- [ ] T004: Create `timeline_events` table schema
- [ ] T005: Create `dossiers` table schema
- [ ] T006: Add Drizzle migration for new tables
- [ ] T007: Install Redis client + BullMQ dependencies
- [ ] T008: Create IP rate limiting middleware
- [ ] T009: Tune Drizzle connection pool (max 25)
- [ ] T010: Implement AES-256-GCM encryption for API keys in settings

## Phase 1 — Entity Extraction & Persistence
- [ ] T011: Create `EntityExtractor` service — extracts entities from IdentityReport
- [ ] T012: Create `EvidenceIngester` service — fingerprints + stores evidence
- [ ] T013: Create entity CRUD service (create, read, update, merge, split)
- [ ] T014: Create evidence CRUD service (create, read, fingerprint lookup)
- [ ] T015: Integrate entity extraction at end of each search pipeline
- [ ] T016: Implement incremental correlation — new observations vs existing entities
- [ ] T017: Add `GET /entities/:id` endpoint
- [ ] T018: Add `GET /entities` (search, filter) endpoint
- [ ] T019: Add `GET /entities/:id/evidence` endpoint

## Phase 2 — Intelligence Graph
- [ ] T020: Create `RelationshipDetector` service
- [ ] T021: Create relationship CRUD service
- [ ] T022: Add `GET /entities/:id/graph?depth=2` endpoint
- [ ] T023: Add `GET /entities/:id/relationships` endpoint
- [ ] T024: Add `GET /graph/path?from=A&to=B` endpoint
- [ ] T025: Install d3-force/react-force-graph dependency
- [ ] T026: Build graph visualization component
- [ ] T027: Build entity node detail card (on-click expand)
- [ ] T028: Build relationship edge detail tooltip

## Phase 3 — Evidence & Timeline
- [ ] T029: Create `TimelineExtractor` service
- [ ] T030: Create timeline event CRUD service
- [ ] T031: Add `GET /entities/:id/timeline` endpoint
- [ ] T032: Build evidence dashboard component
- [ ] T033: Build timeline visualization component
- [ ] T034: Implement evidence-based confidence display
- [ ] T035: Add evidence filtering (type, platform, date)

## Phase 4 — Dossier Generation
- [ ] T036: Create `DossierBuilder` service
- [ ] T037: Create dossier CRUD service
- [ ] T038: Add `POST /dossiers` (generate from entity) endpoint
- [ ] T039: Add `GET /dossiers/:id` endpoint
- [ ] T040: Build dossier frontend (Overview, Evidence, Timeline, Relationships, Risk tabs)
- [ ] T041: Implement PDF export
- [ ] T042: Implement risk scoring engine
- [ ] T043: Build risk gauge visualization

## Phase 5 — Human-Assisted Intelligence
- [ ] T044: Build entity merge UI (select two → confirm)
- [ ] T045: Build entity split UI (select evidence → new entity)
- [ ] T046: Build match approval workflow UI
- [ ] T047: Add investigator notes to entities
- [ ] T048: Create saved investigations system
- [ ] T049: Build investigation workspace (entity collection, notes, timeline)
- [ ] T050: Add `POST /entities/merge` and `POST /entities/split` endpoints
- [ ] T051: Add `POST /matches/:id/approve|reject` endpoints

## Phase 6 — Memory Layer & Performance
- [ ] T052: Configure BullMQ queue for search jobs
- [ ] T053: Build worker pool for correlation engine
- [ ] T054: Configure Redis cache for entity/evidence queries
- [ ] T055: Implement cumulative intelligence (search enrichment of existing entities)
- [ ] T056: Build memory search ("have I seen this before?")
- [ ] T057: Add monitoring/metrics infrastructure
- [ ] T058: Load test at 100k searches/month
- [ ] T059: Profile and optimize sub-5s first results
