import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Shield, Search, RefreshCw, ChevronLeft, Activity, Eye, Clock } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface EntityRow {
  id: string;
  label: string;
  status: string;
  confidenceScore: number;
  summary: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

function confidenceLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "مؤكد", color: "text-green-600 border-green-500/30 bg-green-500/5" };
  if (score >= 70) return { label: "مرجح", color: "text-blue-600 border-blue-500/30 bg-blue-500/5" };
  if (score >= 50) return { label: "محتمل", color: "text-amber-600 border-amber-500/30 bg-amber-500/5" };
  return { label: "ضعيف", color: "text-muted-foreground border-border bg-card" };
}

export default function EntitiesPage() {
  const [, navigate] = useLocation();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const load = (q?: string) => {
    setLoading(true);
    setError(null);
    const url = q ? `${API}/api/entities?q=${encodeURIComponent(q)}` : `${API}/api/entities`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { entities: EntityRow[] }) => { setEntities(data.entities); setLoading(false); })
      .catch(() => { setError("تعذّر تحميل الكيانات"); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => { setSearch(query); load(query); };

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">قاعدة الكيانات</h1>
            <p className="text-sm text-muted-foreground">الكيانات الاستخباراتية المسجلة</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => load(search)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input placeholder="ابحث بالاسم أو المعرّف…" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} className="flex-1" dir="auto" />
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4" />
          </Button>
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
            <Button variant="outline" size="sm" className="mt-3" onClick={() => load(search)}>إعادة المحاولة</Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && entities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border/30 rounded-xl">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد كيانات مسجّلة بعد.</p>
            <p className="text-xs mt-1 opacity-60">تُضاف الكيانات تلقائياً عند إجراء عمليات البحث.</p>
          </div>
        )}

        {/* Entity List */}
        <div className="space-y-2">
          {entities.map(entity => {
            const conf = confidenceLabel(entity.confidenceScore ?? 0);
            return (
              <div key={entity.id} onClick={() => navigate(`/entity/${entity.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border/20 bg-card px-3.5 py-3 cursor-pointer hover:border-border/40 hover:bg-secondary/20 transition-all">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {entity.avatarUrl
                    ? <img src={entity.avatarUrl} className="w-full h-full object-cover rounded-lg" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : <User className="w-4.5 h-4.5 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" dir="auto">{entity.label}</div>
                  {entity.summary && <div className="text-xs text-muted-foreground line-clamp-1" dir="auto">{entity.summary}</div>}
                  <div className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(entity.updatedAt).toLocaleDateString("ar-LY")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className={`text-xs py-0 px-1.5 ${conf.color}`}>
                    <Shield className="w-3 h-3 ml-0.5" />{entity.confidenceScore ?? 0}%
                  </Badge>
                  <span className="text-xs text-muted-foreground/60">{conf.label}</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground/30 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
