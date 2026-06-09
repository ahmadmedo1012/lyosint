import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";

interface EvidenceItem {
  type: string;
  description: string;
  platforms?: string[];
}

interface IdentityPlatform {
  platform: string;
  url?: string | null;
}

interface Identity {
  id?: string;
  conclusion?: string;
  confidencePercent?: number;
  representative?: {
    displayName?: string | null;
    website?: string | null;
    location?: string | null;
  } | null;
  evidence?: EvidenceItem[];
  conflicts?: EvidenceItem[];
  platforms?: IdentityPlatform[];
}

interface IdentityReport {
  identities?: Identity[];
  analysisSummary?: string;
  suppressed?: { count?: number; reason?: string } | null;
}

export function IdentityReport({ report }: { report?: IdentityReport | null }) {
  if (!report) return null;
  const identities = report.identities || [];
  return (
    <div className="mb-5 space-y-3">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">تقرير الربط والتحليل</div>
        <div className="text-sm text-foreground" dir="auto">{report.analysisSummary}</div>
      </div>

      {identities.length === 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
          لا توجد هوية مترابطة بثقة كافية. تم تقليل النتائج لتجنب التطابقات الكاذبة.
        </div>
      )}

      {identities.map((identity, index) => (
        <div key={identity.id || index} className="rounded-lg border border-border/40 bg-secondary/20 px-4 py-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold">الهوية {String.fromCharCode(65 + index)}</div>
              <div className="text-xs text-muted-foreground mt-0.5" dir="auto">{identity.conclusion}</div>
            </div>
            <Badge className="font-mono text-xs bg-primary/10 text-primary border-primary/25">
              {identity.confidencePercent}%
            </Badge>
          </div>

          {identity.representative && (identity.representative.displayName || identity.representative.website || identity.representative.location) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {identity.representative.displayName && <DataRow label="الاسم" value={identity.representative.displayName} />}
              {identity.representative.website && <DataRow label="الموقع" value={identity.representative.website} mono />}
              {identity.representative.location && <DataRow label="الموقع الجغرافي" value={identity.representative.location} />}
            </div>
          )}

          {identity.evidence && identity.evidence.length > 0 && (
            <div>
              <div className="text-[10px] text-green-400 uppercase font-mono mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> أدلة داعمة
              </div>
              <ul className="space-y-1">
                {identity.evidence.map((e, i) => (
                  <li key={`ev-${i}`} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span dir="auto">{e.description} <span className="font-mono text-[10px] text-muted-foreground/60">({(e.platforms || []).join(", ")})</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {identity.conflicts && identity.conflicts.length > 0 && (
            <div>
              <div className="text-[10px] text-amber-400 uppercase font-mono mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> نقاط عدم يقين
              </div>
              <ul className="space-y-1">
                {identity.conflicts.map((e, i) => (
                  <li key={`cf-${i}`} className="text-xs text-amber-200/80 flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span dir="auto">{e.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1.5">المنصات داخل هذه الهوية</div>
            <div className="flex flex-wrap gap-1.5">
              {(identity.platforms || []).map((p) => (
                <a key={`${identity.id}-${p.platform}`} href={p.url || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/40 px-2 py-1 text-[10px] font-mono text-foreground hover:border-primary/40">
                  {p.platform}
                  {p.url && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}

      {report.suppressed && report.suppressed.count ? (
        <div className="rounded-lg border border-border/30 bg-secondary/20 px-4 py-2.5 text-xs text-muted-foreground">
          تم إخفاء {report.suppressed.count} نتيجة ضعيفة: {report.suppressed.reason}
        </div>
      ) : null}
    </div>
  );
}

function DataRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-background/30 border border-border/20">
      <span className="text-[10px] text-muted-foreground uppercase font-mono">{label}</span>
      <span className={`text-xs font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
