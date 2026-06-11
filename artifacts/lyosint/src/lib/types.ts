export interface SearchProgress {
  phase: string;
  phaseIndex: number;
  totalPhases: number;
  percentage: number;
  platformsChecked: number;
  platformsTotal: number;
}

export interface SearchStatusResponse {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  type: string;
  query: string;
  progress: SearchProgress | null;
  timingMs: Record<string, number | null> | null;
  platformsSearched: number | null;
  platformsTotal: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PlatformTiming {
  platformName: string;
  responseTimeMs: number;
  status: string;
}

export interface Investigation {
  id: string;
  title: string;
  status: "active" | "pending" | "closed" | "archived";
  priority: "critical" | "high" | "medium" | "low";
  entityCount: number;
  evidenceCount: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface Entity {
  id: string;
  label: string;
  type: "person" | "phone" | "username" | "email" | "organization";
  confidence: number;
  riskScore: number;
  identifiers?: EntityIdentifier[];
  profiles?: EntityProfile[];
}

export interface EntityIdentifier {
  type: string;
  value: string;
  confidence: number;
  source: string;
}

export interface EntityProfile {
  platform: string;
  url: string;
  verified: boolean;
  followers?: number;
}

export interface Evidence {
  id: string;
  title: string;
  source: string;
  sourceType: "messaging" | "database" | "social" | "breach" | "web";
  confidence: number;
  date: string;
  summary: string;
  verification?: "verified" | "disputed" | "debunked";
}

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  confidence: number;
}

export interface GraphNodeData {
  id: string;
  label: string;
  type: string;
  confidence: number;
}

export interface GraphEdgeData {
  source: string;
  target: string;
  type: string;
  label: string;
}

export interface Dossier {
  id: string;
  title: string;
  entityName: string;
  status: "draft" | "final" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
  sections?: DossierSection[];
}

export interface DossierSection {
  id: string;
  title: string;
  content: string[];
}
