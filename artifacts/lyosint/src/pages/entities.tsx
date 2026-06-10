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
  if (score >= 90) return { label: "مؤكد", color: "text-green-400 border-green-500/30 bg-green-500/5" };
  if (score >= 70) return { label: "مرجح", color: "text-blue-400 border-blue-500/30 bg-blue-500/5" };
  if (score >= 50) return { label: "محتمل", color: "text-amber-400 border-amber-500/30 bg-amber-500/5" };
  return { label: "ضعيف", color: "text-muted-foreground border-border bg-card" };
}

export default function EntitiesPage() {
  const [, navigate] = useLocation();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const load = (q?: string) => {
    setLoading(true);
    const url = q ? `${API}/api/entities?q=${encodeURIComponent(q)}` : `${API}/api/entities`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { entities: EntityRow[] }) => { setEntities(data.entities); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => { setSearch(query); load(query); };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            قاعدة الكيانات الاستخباراتية
          </h1>
          <Button variant="ghost" size="sm" onClick={() => load(search)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="ابحث بالاسم أو المعرّف…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="flex-1"
            dir="auto"
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}

        {!loading && entities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد كيانات مسجّلة بعد.</p>
            <p className="text-xs mt-1 opacity-60">تُضاف الكيانات تلقائياً عند إجراء عمليات البحث.</p>
          </div>
        )}

        <div className="space-y-2">
          {entities.map(entity => {
            const conf = confidenceLabel(entity.confidenceScore ?? 0);
            return (
              <div
                key={entity.id}
                onClick={() => navigate(`/entities/${entity.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {entity.avatarUrl
                    ? <img src={entity.avatarUrl} className="w-full h-full object-cover rounded-xl" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : <User className="w-4.5 h-4.5 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" dir="auto">{entity.label}</div>
                  {entity.summary && <div className="text-xs text-muted-foreground line-clamp-1" dir="auto">{entity.summary}</div>}
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    <Clock className="w-3 h-3 inline ml-1" />
                    {new Date(entity.updatedAt).toLocaleDateString("ar-LY")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className={`text-xs py-0 px-1.5 ${conf.color}`}>
                    <Shield className="w-3 h-3 ml-0.5" />{entity.confidenceScore ?? 0}%
                  </Badge>
                  <span className="text-xs text-muted-foreground/60">{conf.label}</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
