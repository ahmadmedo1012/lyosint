import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DossierView } from "@/components/dossier-view";
import {
  FileText, ChevronLeft, Download, FileJson, FileSpreadsheet,
  Clock, User, Target, FilePlus, History as HistoryIcon, RefreshCw, XCircle,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DossierEntry {
  id: string;
  title: string;
  entityName: string;
  status: "draft" | "final" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
  sections?: Array<{ type: string; title: string; content: string }>;
  summary?: string;
}

interface DossierVersion {
  version: number;
  date: string;
  summary: string;
}

const STATUS_LABELS: Record<string, string> = { draft: "مسودة", final: "نهائي", archived: "مؤرشف" };
const STATUS_COLORS: Record<string, string> = { draft: "text-amber-600 bg-amber-500/10 border-amber-500/25", final: "text-green-600 bg-green-500/10 border-green-500/25", archived: "text-muted-foreground bg-secondary/30 border-border/40" };

function DossierDetail({ id: dossierId }: { id: string }) {
  const [, setLocation] = useLocation();
  const [dossier, setDossier] = useState<DossierEntry | null>(null);
  const [versions, setVersions] = useState<DossierVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dossierId) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/api/entities/${dossierId}/dossier`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: DossierEntry) => {
        setDossier(data);
        setLoading(false);
      })
      .catch(() => {
        fetch(`${API}/api/dossiers/${dossierId}`)
          .then(r => r.ok ? r.json() : Promise.reject(r.status))
          .then((data: DossierEntry) => {
            setDossier(data);
            setLoading(false);
          })
          .catch(() => { setError("تعذّر تحميل الملف"); setLoading(false); });
      });
  }, [dossierId]);

  useEffect(() => {
    if (!dossierId) return;
    fetch(`${API}/api/dossiers/${dossierId}/versions`)
      .then(r => r.ok ? r.json() : Promise.reject(null))
      .then((data: { versions: DossierVersion[] }) => setVersions(data.versions))
      .catch(() => {});
  }, [dossierId]);

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[40vh]">
          <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (error || !dossier) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
        <p className="font-medium">{error || "الملف غير موجود"}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/dossiers")}>العودة للملفات</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5" dir="rtl">
      <button onClick={() => setLocation("/dossiers")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> العودة للملفات
      </button>

      {/* Header */}
      <div className="rounded-xl border border-border/30 bg-card px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
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
            <Button size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> تصدير</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <DossierView dossier={dossier} />
        </div>

        {/* Version History Sidebar */}
        {versions.length > 0 && (
          <div className="space-y-3">
            <Card className="border-border/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <HistoryIcon className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold">سجل الإصدارات</h3>
                </div>
                <div className="space-y-3">
                  {versions.map((v, i) => (
                    <div key={v.version} className="relative pr-4 pb-3 border-r border-border/20 last:pb-0">
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
            <Card className="border-border/20">
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">الكيان المستهدف</p>
                <p className="font-bold text-sm mt-1">{dossier.entityName}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DossiersPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [dossiers, setDossiers] = useState<DossierEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/dossiers`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { dossiers: DossierEntry[] }) => {
        setDossiers(data.dossiers);
        setLoading(false);
      })
      .catch(() => { setError("تعذّر تحميل الملفات"); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  if (id) return <DossierDetail id={id} />;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">الملفات</h1>
            <p className="text-sm text-muted-foreground">ملفات التحقيق المجمعة والتقارير</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button className="gap-2"><FilePlus className="w-4 h-4" /> ملف جديد</Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>إعادة المحاولة</Button>
          </div>
        )}

        {/* Dossier Cards */}
        {!loading && !error && (
          <>
            {dossiers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border/30 rounded-xl">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium">لا توجد ملفات بعد</p>
                <p className="text-sm mt-1">يتم إنشاء الملفات تلقائياً من التحقيقات</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dossiers.map((d) => (
                  <button key={d.id} onClick={() => setLocation(`/dossier/${d.id}`)}
                    className="text-right bg-card border border-border/20 hover:border-border/40 hover:bg-secondary/20 transition-all rounded-xl p-4 cursor-pointer group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <Badge className={`text-[9px] font-mono border ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">{d.title}</h3>
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
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
