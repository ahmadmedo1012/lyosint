import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  dossiersTable, entitiesTable, identifiersTable,
  profilesTable, evidenceTable, timelineEventsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { scoreToLevel, confidenceLevelLabel } from "./confidence-engine";

interface DossierSection {
  id: string;
  title: string;
  content: string;
  order: number;
  confidence?: number;
}

export async function generateDossier(entityId: string): Promise<string> {
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
  if (!entity) throw new Error(`Entity ${entityId} not found`);

  const [identifiers, profiles, evidence, timeline] = await Promise.all([
    db.select().from(identifiersTable).where(eq(identifiersTable.entityId, entityId)),
    db.select().from(profilesTable).where(eq(profilesTable.entityId, entityId)),
    db.select().from(evidenceTable).where(eq(evidenceTable.entityId, entityId)),
    db.select().from(timelineEventsTable).where(eq(timelineEventsTable.entityId, entityId)),
  ]);

  const level = scoreToLevel(entity.riskScore ?? 0);
  const levelLabel = confidenceLevelLabel(level);

  const sections: DossierSection[] = [
    {
      id: "summary",
      title: "ملخص الكيان",
      content: [
        `الاسم/التسمية: ${entity.label}`,
        `درجة الثقة: ${entity.riskScore ?? 0}% (${levelLabel})`,
        `المعرّفات: ${identifiers.length}`,
        `الملفات الشخصية: ${profiles.length}`,
        `الأدلة: ${evidence.length}`,
      ].filter(Boolean).join("\n"),
      order: 1,
    },
    {
      id: "identifiers",
      title: "المعرّفات",
      content: identifiers.map((id) => {
        return `[${id.type.toUpperCase()}] ${id.value} — المصدر: ${id.source ?? "غير محدد"} — الثقة: ${Math.round((id.confidence ?? 0) * 100)}%`;
      }).join("\n") || "لا توجد معرّفات",
      order: 2,
    },
    {
      id: "profiles",
      title: "الملفات الشخصية على المنصات",
      content: profiles.map((p) => {
        const parts = [`[${p.platform}]`];
        if (p.username) parts.push(`@${p.username}`);
        if (p.displayName) parts.push(`"${p.displayName}"`);
        if (p.profileUrl) parts.push(p.profileUrl);
        if (p.bio) parts.push(`— ${p.bio.slice(0, 80)}`);
        return parts.join(" ");
      }).join("\n") || "لا توجد ملفات شخصية",
      order: 3,
    },
    {
      id: "timeline",
      title: "الجدول الزمني",
      content: timeline
        .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
        .map((t) => {
          const date = new Date(t.eventDate).toLocaleDateString("ar-LY");
          return `[${date}] ${t.title}: ${t.description ?? ""}`;
        }).join("\n") || "لا توجد أحداث",
      order: 4,
    },
    {
      id: "risk",
      title: "تقييم المخاطر",
      content: buildRiskSection(entity, identifiers, profiles, evidence),
      order: 5,
    },
  ];

  const existingDossier = await db
    .select({ id: dossiersTable.id })
    .from(dossiersTable)
    .where(eq(dossiersTable.entityId, entityId))
    .limit(1);

  const dossierId = existingDossier[0]?.id ?? randomUUID();
  const title = `ملف استخباراتي — ${entity.label}`;
  const summary = `ملف استخباراتي للكيان: ${entity.label}`;
  const now = new Date();

  if (existingDossier.length > 0) {
    await db
      .update(dossiersTable)
      .set({ title, summary, sections, updatedAt: now })
      .where(eq(dossiersTable.id, dossierId));
  } else {
    await db.insert(dossiersTable).values({
      entityId,
      title,
      summary,
      sections,
      createdAt: now,
      updatedAt: now,
    });
  }

  return dossierId;
}

function buildRiskSection(
  entity: { riskScore: number | null },
  identifiers: Array<{ type: string }>,
  profiles: Array<{ platform: string }>,
  evidence: Array<{ evidenceType: string }>,
): string {
  const lines: string[] = [];
  const breaches = evidence.filter((e) => e.evidenceType === "data_breach");
  const score = entity.riskScore ?? 0;

  lines.push(`درجة الثقة الإجمالية: ${score}%`);

  if (breaches.length > 0) {
    lines.push(`⚠️ تسريبات بيانات مكتشفة: ${breaches.length} تسريب`);
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
