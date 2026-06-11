import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DossierView } from "@/components/dossier-view";
import {
  FileText, ChevronLeft, Download, FileJson, FileDown, FileSpreadsheet,
  Clock, User, Target, FilePlus, History as HistoryIcon,
} from "lucide-react";

interface DossierEntry {
  id: string;
  title: string;
  entityName: string;
  status: "draft" | "final" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface DossierVersion {
  version: number;
  date: string;
  summary: string;
}

const MOCK_DOSSIERS: DossierEntry[] = [
  { id: "dos-001", title: "ملف تحليل - أحمد علي محمد", entityName: "أحمد علي محمد", status: "final", version: 3, createdAt: "2026-06-01", updatedAt: "2026-06-10" },
  { id: "dos-002", title: "ملف شبكة الاتصالات - طرابلس", entityName: "LibyaTech", status: "draft", version: 1, createdAt: "2026-06-05", updatedAt: "2026-06-09" },
  { id: "dos-003", title: "ملف قضية احتيال مالي", entityName: "محمود علي", status: "final", version: 2, createdAt: "2026-05-20", updatedAt: "2026-06-08" },
  { id: "dos-004", title: "تقرير تحليل حسابات وهمية", entityName: "بنغازي تك", status: "draft", version: 1, createdAt: "2026-06-07", updatedAt: "2026-06-07" },
  { id: "dos-005", title: "ملف حملة تضليل إعلامي", entityName: "سارة أحمد", status: "archived", version: 4, createdAt: "2026-04-15", updatedAt: "2026-05-30" },
];

const MOCK_VERSIONS: DossierVersion[] = [
  { version: 3, date: "2026-06-10", summary: "إضافة أدلة جديدة وتحليل العلاقات" },
  { version: 2, date: "2026-06-05", summary: "تحديث قسم الأدلة وإضافة مصادر" },
  { version: 1, date: "2026-06-01", summary: "مسودة أولية للملف" },
];

const STATUS_LABELS: Record<string, string> = { draft: "مسودة", final: "نهائي", archived: "مؤرشف" };
const STATUS_COLORS: Record<string, string> = { draft: "text-amber-400 bg-amber-500/10 border-amber-500/25", final: "text-green-400 bg-green-500/10 border-green-500/25", archived: "text-muted-foreground bg-secondary/30 border-border/40" };

function DossierDetail({ id: dossierId }: { id: string }) {
  const [, setLocation] = useLocation();
  const dossier = MOCK_DOSSIERS.find(d => d.id === dossierId);

  if (!dossier) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
        <p className="font-medium">الملف غير موجود</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <button onClick={() => setLocation("/dossiers")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ChevronLeft className="w-4 h-4" /> العودة للملفات
      </button>

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card px-5 py-4">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-[10px] font-mono border ${STATUS_COLORS[dossier.status]}`}>{STATUS_LABELS[dossier.status]}</Badge>
              <Badge variant="outline" className="text-[10px] font-mono">إصدار {dossier.version}</Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">{dossier.title}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {dossier.entityName}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> آخر تحديث: {dossier.updatedAt}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5"><FileJson className="w-3.5 h-3.5" /> JSON</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> PDF</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><FileDown className="w-3.5 h-3.5" /> Markdown</Button>
            <Button size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> تصدير</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <DossierView dossier={dossier} />
        </div>

        {/* Version History Sidebar */}
        <div className="space-y-3">
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <HistoryIcon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold">سجل الإصدارات</h3>
              </div>
              <div className="space-y-3">
                {MOCK_VERSIONS.map((v, i) => (
                  <div key={v.version} className="relative pr-4 pb-3 border-r border-border/30 last:pb-0">
                    {i === 0 && <span className="absolute right-[-4px] top-0 w-2 h-2 rounded-full bg-primary" />}
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px] font-mono">v{v.version}</Badge>
                      <span className="text-[10px] text-muted-foreground">{v.date}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{v.summary}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4 text-center">
              <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">الكيان المستهدف</p>
              <p className="font-bold text-sm mt-1">{dossier.entityName}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DossiersPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  if (id) return <DossierDetail id={id} />;

  return (
    <PageTransition>
      <div className="space-y-5" dir="rtl">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card px-5 py-4">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">الملفات</h1>
                <p className="text-sm text-muted-foreground">ملفات التحقيق المجمعة والتقارير</p>
              </div>
            </div>
            <Button className="gap-2"><FilePlus className="w-4 h-4" /> ملف جديد</Button>
          </div>
        </div>

        {/* Dossier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MOCK_DOSSIERS.map((d) => (
            <button key={d.id} onClick={() => setLocation(`/dossier/${d.id}`)}
              className="text-right bg-card border border-border/40 hover:border-primary/30 hover:bg-primary/3 transition-all rounded-xl p-4 cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <Badge className={`text-[9px] font-mono border ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</Badge>
              </div>
              <h3 className="font-semibold text-sm mb-2 group-hover:text-primary transition-colors line-clamp-2">{d.title}</h3>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                <User className="w-3 h-3" />
                <span>{d.entityName}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                <Badge variant="outline" className="text-[9px] font-mono">إصدار {d.version}</Badge>
                <span>{d.updatedAt}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
