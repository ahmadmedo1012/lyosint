import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  dossiersTable, entitiesTable, entityIdentifiersTable,
  entityProfilesTable, entityEvidenceTable, entityTimelineTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { scoreToLevel, confidenceLevelLabel } from "./confidence-engine";
import type { DossierSection } from "@workspace/db";

export async function generateDossier(entityId: string): Promise<string> {
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
  if (!entity) throw new Error(`Entity ${entityId} not found`);

  const [identifiers, profiles, evidence, timeline] = await Promise.all([
    db.select().from(entityIdentifiersTable).where(eq(entityIdentifiersTable.entityId, entityId)),
    db.select().from(entityProfilesTable).where(eq(entityProfilesTable.entityId, entityId)),
    db.select().from(entityEvidenceTable).where(eq(entityEvidenceTable.entityId, entityId)),
    db.select().from(entityTimelineTable).where(eq(entityTimelineTable.entityId, entityId)),
  ]);

  const level = scoreToLevel(entity.confidenceScore ?? 0);
  const levelLabel = confidenceLevelLabel(level);

  const sections: DossierSection[] = [
    {
      type: "summary",
      title: "ملخص الكيان",
      content: [
        `الاسم/التسمية: ${entity.label}`,
        `درجة الثقة: ${entity.confidenceScore ?? 0}% (${levelLabel})`,
        `المعرّفات: ${identifiers.length}`,
        `الملفات الشخصية: ${profiles.length}`,
        `الأدلة: ${evidence.length}`,
        entity.summary ? `الوصف: ${entity.summary}` : "",
      ].filter(Boolean).join("\n"),
    },
    {
      type: "identifiers",
      title: "المعرّفات",
      content: identifiers.map((id) => {
        const verifiedTag = id.verified ? " ✓ موثق" : "";
        return `[${id.type.toUpperCase()}] ${id.value}${verifiedTag} — المصدر: ${id.source ?? "غير محدد"} — الثقة: ${Math.round((id.confidenceScore ?? 0) * 100)}%`;
      }).join("\n") || "لا توجد معرّفات",
    },
    {
      type: "profiles",
      title: "الملفات الشخصية على المنصات",
      content: profiles.map((p) => {
        const parts = [`[${p.platform}]`];
        if (p.username) parts.push(`@${p.username}`);
        if (p.displayName) parts.push(`"${p.displayName}"`);
        if (p.url) parts.push(p.url);
        if (p.bio) parts.push(`— ${p.bio.slice(0, 80)}`);
        return parts.join(" ");
      }).join("\n") || "لا توجد ملفات شخصية",
    },
    {
      type: "timeline",
      title: "الجدول الزمني",
      content: timeline
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .map((t) => {
          const date = new Date(t.occurredAt).toLocaleDateString("ar-LY");
          return `[${date}] ${t.title}: ${t.description ?? ""}`;
        }).join("\n") || "لا توجد أحداث",
    },
    {
      type: "risk",
      title: "تقييم المخاطر",
      content: buildRiskSection(entity, identifiers, profiles, evidence),
    },
  ];

  const existingDossier = await db
    .select({ id: dossiersTable.id })
    .from(dossiersTable)
    .where(eq(dossiersTable.entityId, entityId))
    .limit(1);

  const dossierId = existingDossier[0]?.id ?? randomUUID();
  const title = `ملف استخباراتي — ${entity.label}`;
  const summary = entity.summary ?? `ملف استخباراتي للكيان: ${entity.label}`;
  const now = new Date();

  if (existingDossier.length > 0) {
    await db
      .update(dossiersTable)
      .set({ title, summary, confidenceScore: entity.confidenceScore, sections, updatedAt: now })
      .where(eq(dossiersTable.id, dossierId));
  } else {
    await db.insert(dossiersTable).values({
      id: dossierId,
      entityId,
      title,
      summary,
      confidenceScore: entity.confidenceScore,
      sections,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
  }

  return dossierId;
}

function buildRiskSection(
  entity: { confidenceScore: number | null; riskScore: number | null },
  identifiers: Array<{ type: string }>,
  profiles: Array<{ platform: string }>,
  evidence: Array<{ polarity: string; type: string }>,
): string {
  const lines: string[] = [];
  const conflicting = evidence.filter((e) => e.polarity === "conflicting");
  const breaches = evidence.filter((e) => e.type === "data_breach");
  const score = entity.confidenceScore ?? 0;

  lines.push(`درجة الثقة الإجمالية: ${score}%`);

  if (breaches.length > 0) {
    lines.push(`⚠️ تسريبات بيانات مكتشفة: ${breaches.length} تسريب`);
  }
  if (conflicting.length > 0) {
    lines.push(`⚠️ أدلة متضاربة: ${conflicting.length} عنصر`);
  }
  if (identifiers.length >= 5) {
    lines.push(`ℹ️ بصمة رقمية واسعة: ${identifiers.length} معرّف`);
  }
  if (profiles.length >= 10) {
    lines.push(`ℹ️ حضور رقمي مرتفع: ${profiles.length} منصة`);
  }

  const riskLevel = breaches.length > 2 ? "مرتفع" : breaches.length > 0 ? "متوسط" : score > 70 ? "منخفض" : "غير محدد";
  lines.push(`مستوى الخطورة: ${riskLevel}`);

  return lines.join("\n");
}
