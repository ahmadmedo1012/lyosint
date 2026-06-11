import type { ResolvedEntity } from "../entity-resolver/index";
import type { EvidenceItem, EvidenceSummary } from "../evidence-engine/index";
import type { GraphNode, GraphEdge } from "../graph-engine/index";
import type { Relationship } from "../relationship-engine/index";
import type { TimelineReport } from "../timeline-engine/index";
import type { ConfidenceResult } from "../confidence-engine/index";

export interface DossierSection {
  name: string;
  content: unknown;
}

export interface Dossier {
  id: string;
  version: number;
  entityId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sections: DossierSection[];
  executiveSummary: string;
  format: "json" | "markdown";
}

export interface DossierIdentitySummary {
  label: string;
  confidence: ConfidenceResult;
  identifierCount: number;
  primaryIdentifier: string;
}

export interface DossierSourcesList {
  sources: Array<{ name: string; count: number; topConfidence: number }>;
}

let dossierStore = new Map<string, Dossier>();
let dossierVersions = new Map<string, Dossier[]>();

function generateId(): string {
  return `dos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateExecutiveSummary(
  entity: ResolvedEntity,
  evidenceSummary: EvidenceSummary,
  relationships: Relationship[],
  timeline: TimelineReport,
): string {
  const parts: string[] = [];
  parts.push(`Investigation dossier for "${entity.label}"`);
  parts.push(`Confidence: ${Math.round(entity.confidence * 100)}%`);
  parts.push(`Identifiers found: ${entity.identifiers.length}`);
  parts.push(`Evidence items: ${evidenceSummary.total}`);
  parts.push(`Relationships: ${relationships.length}`);
  parts.push(`Timeline span: ${timeline.spanDays} days`);
  if (evidenceSummary.sourcesList.length > 0) {
    parts.push(`Sources: ${evidenceSummary.sourcesList.join(", ")}`);
  }
  return parts.join(" | ");
}

function generateMarkdown(dossier: Dossier): string {
  const lines: string[] = [
    `# Dossier: ${dossier.title}`,
    `**ID:** ${dossier.id}`,
    `**Version:** ${dossier.version}`,
    `**Created:** ${dossier.createdAt}`,
    `**Updated:** ${dossier.updatedAt}`,
    "",
    "---",
    "",
    `## Executive Summary`,
    "",
    dossier.executiveSummary,
    "",
  ];

  for (const section of dossier.sections) {
    lines.push(`## ${section.name}`, "");
    const content = section.content as Record<string, unknown>;
    for (const [key, value] of Object.entries(content)) {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      if (Array.isArray(value)) {
        lines.push(`**${label}:** ${value.length} items`);
        for (const item of value.slice(0, 10)) {
          if (typeof item === "object" && item !== null) {
            lines.push(`  - ${JSON.stringify(item).slice(0, 200)}`);
          } else {
            lines.push(`  - ${String(item).slice(0, 200)}`);
          }
        }
        if (value.length > 10) lines.push(`  - ... and ${value.length - 10} more`);
      } else if (typeof value === "object" && value !== null) {
        lines.push(`**${label}:** ${JSON.stringify(value).slice(0, 300)}`);
      } else {
        lines.push(`**${label}:** ${String(value).slice(0, 300)}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function generateDossier(params: {
  entity: ResolvedEntity;
  evidence: EvidenceItem[];
  evidenceSummary: EvidenceSummary;
  relationships: Relationship[];
  timeline: TimelineReport;
  graphNodes?: GraphNode[];
  graphEdges?: GraphEdge[];
  confidence: ConfidenceResult;
  format?: "json" | "markdown";
}): Promise<Dossier> {
  const format = params.format ?? "json";

  const sections: DossierSection[] = [
    {
      name: "identity_summary",
      content: {
        label: params.entity.label,
        confidence: params.confidence,
        identifierCount: params.entity.identifiers.length,
        primaryIdentifier: params.entity.identifiers[0]?.normalized ?? "unknown",
      } as DossierIdentitySummary,
    },
    {
      name: "identifiers",
      content: {
        identifiers: params.entity.identifiers.map((id) => ({
          type: id.type,
          value: id.normalized,
          original: id.original,
        })),
      },
    },
    {
      name: "profiles",
      content: { profiles: params.evidence.filter((e) => e.type === "profile").map((e) => e.value) },
    },
    {
      name: "evidence_summary",
      content: params.evidenceSummary,
    },
    {
      name: "relationships_graph",
      content: {
        relationships: params.relationships.map((r) => ({
          type: r.type,
          strength: r.strength,
          source: r.sourceEntityId,
          target: r.targetEntityId,
        })),
        graph: params.graphNodes && params.graphEdges
          ? { nodes: params.graphNodes, edges: params.graphEdges }
          : undefined,
      },
    },
    {
      name: "timeline",
      content: params.timeline,
    },
    {
      name: "confidence_assessment",
      content: {
        overall: params.confidence,
        evidenceConfidence: params.evidence.map((e) => ({
          id: e.id,
          score: e.confidence.score,
          level: e.confidence.level,
        })),
      },
    },
    {
      name: "sources_list",
      content: {
        sources: params.evidenceSummary.sourcesList.map((name) => ({
          name,
          count: params.evidence.filter((e) => e.sourceName === name).length,
          topConfidence: Math.max(
            ...params.evidence.filter((e) => e.sourceName === name).map((e) => e.confidence.score),
            0,
          ),
        })),
      } as DossierSourcesList,
    },
    {
      name: "findings_analysis",
      content: {
        totalEvidence: params.evidence.length,
        verifiedEvidence: params.evidence.filter((e) => e.status === "verified").length,
        contradictedEvidence: params.evidence.filter((e) => e.status === "contradicted").length,
        relationshipCount: params.relationships.length,
        timelineSpanDays: params.timeline.spanDays,
        patterns: params.timeline.patterns,
      },
    },
  ];

  const existing = [...dossierStore.values()].find((d) => d.entityId === params.entity.id);
  const version = (existing?.version ?? 0) + 1;

  const executiveSummary = generateExecutiveSummary(
    params.entity,
    params.evidenceSummary,
    params.relationships,
    params.timeline,
  );

  const dossier: Dossier = {
    id: existing?.id ?? generateId(),
    version,
    entityId: params.entity.id,
    title: `Dossier - ${params.entity.label}`,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections,
    executiveSummary,
    format,
  };

  if (!dossierVersions.has(dossier.id)) dossierVersions.set(dossier.id, []);
  dossierVersions.get(dossier.id)!.push(dossier);
  if (dossierVersions.get(dossier.id)!.length > 20) {
    dossierVersions.get(dossier.id)!.shift();
  }

  if (format === "markdown") {
    return { ...dossier, sections, executiveSummary: generateMarkdown(dossier) };
  }

  dossierStore.set(dossier.id, dossier);
  return dossier;
}

export async function getDossier(id: string): Promise<Dossier | undefined> {
  return dossierStore.get(id);
}

export async function getDossierVersions(id: string): Promise<Dossier[]> {
  return dossierVersions.get(id) ?? [];
}

export async function listDossiers(entityId?: string): Promise<Dossier[]> {
  const all = [...dossierStore.values()];
  if (entityId) return all.filter((d) => d.entityId === entityId);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
