import type { EvidenceItem, EvidenceType } from "../evidence-engine/index";

export type TimelinePeriod = "day" | "week" | "month" | "year";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: EvidenceType;
  source: string;
  evidenceId: string;
  entityId: string;
  confidenceScore: number;
}

export interface TimelinePeriodGroup {
  period: string;
  events: TimelineEvent[];
  count: number;
}

export interface TimelineGap {
  from: string;
  to: string;
  durationDays: number;
}

export interface TimelineReport {
  entityId: string;
  totalEvents: number;
  events: TimelineEvent[];
  periodGroups: TimelinePeriodGroup[];
  gaps: TimelineGap[];
  patterns: string[];
  earliestEvent: string | null;
  latestEvent: string | null;
  spanDays: number;
}

function extractTimestamp(item: EvidenceItem): string | null {
  if (item.collectedAt) return item.collectedAt;
  if (item.metadata?.timestamp) return String(item.metadata.timestamp);
  if (item.metadata?.date) return String(item.metadata.date);
  if (item.metadata?.createdAt) return String(item.metadata.createdAt);
  return null;
}

function formatPeriod(timestamp: string, period: TimelinePeriod): string {
  const d = new Date(timestamp);
  switch (period) {
    case "day": return d.toISOString().slice(0, 10);
    case "week": {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      return start.toISOString().slice(0, 10);
    }
    case "month": return d.toISOString().slice(0, 7);
    case "year": return d.toISOString().slice(0, 4);
  }
}

function identifyPatterns(events: TimelineEvent[]): string[] {
  const patterns: string[] = [];
  const typeCounts = new Map<string, number>();
  for (const e of events) {
    typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
  }
  for (const [type, count] of typeCounts) {
    if (count >= 3) patterns.push(`Multiple ${type} events (${count} total)`);
  }

  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let clusterCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const diff = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime();
    if (diff < 86400000) clusterCount++;
  }
  if (clusterCount > sorted.length * 0.3) {
    patterns.push("Temporal clustering detected — multiple events within short timeframes");
  }

  if (events.length >= 5) {
    patterns.push(`Consistent activity over ${events.length} events`);
  }

  return patterns;
}

export function buildTimeline(
  entityId: string,
  evidenceItems: EvidenceItem[],
  groupBy: TimelinePeriod = "month",
): TimelineReport {
  const events: TimelineEvent[] = [];

  for (const item of evidenceItems) {
    const ts = extractTimestamp(item);
    if (!ts) continue;

    events.push({
      id: `te-${item.id}`,
      timestamp: ts,
      title: `${item.type} evidence from ${item.sourceName}`,
      description: item.value.slice(0, 200),
      type: item.type,
      source: item.source,
      evidenceId: item.id,
      entityId: item.entityId,
      confidenceScore: item.confidence.score,
    });
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const periodMap = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = formatPeriod(event.timestamp, groupBy);
    if (!periodMap.has(key)) periodMap.set(key, []);
    periodMap.get(key)!.push(event);
  }

  const periodGroups: TimelinePeriodGroup[] = [...periodMap.entries()]
    .map(([period, evts]) => ({ period, events: evts, count: evts.length }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const gaps: TimelineGap[] = [];
  for (let i = 1; i < periodGroups.length; i++) {
    const prevEnd = new Date(periodGroups[i - 1].period);
    const currStart = new Date(periodGroups[i].period);
    const diffDays = Math.round((currStart.getTime() - prevEnd.getTime()) / 86400000);
    if (diffDays > 30) {
      gaps.push({
        from: periodGroups[i - 1].period,
        to: periodGroups[i].period,
        durationDays: diffDays,
      });
    }
  }

  const patterns = identifyPatterns(events);
  const earliestEvent = events.length > 0 ? events[0].timestamp : null;
  const latestEvent = events.length > 0 ? events[events.length - 1].timestamp : null;
  const spanDays = earliestEvent && latestEvent
    ? Math.round((new Date(latestEvent).getTime() - new Date(earliestEvent).getTime()) / 86400000)
    : 0;

  return {
    entityId,
    totalEvents: events.length,
    events,
    periodGroups,
    gaps,
    patterns,
    earliestEvent,
    latestEvent,
    spanDays,
  };
}
