import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, FolderSearch, Clock, AlertCircle, TrendingUp,
  ChevronLeft, Filter, ListTodo, Target, Shield, RefreshCw,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Investigation {
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

const STATUS_LABELS: Record<string, string> = { active: "نشط", pending: "قيد الانتظار", closed: "مغلق", archived: "مؤرشف" };
const STATUS_COLORS: Record<string, string> = { active: "text-green-600 bg-green-500/10 border-green-500/25", pending: "text-amber-600 bg-amber-500/10 border-amber-500/25", closed: "text-blue-600 bg-blue-500/10 border-blue-500/25", archived: "text-muted-foreground bg-secondary/30 border-border/40" };
const PRIORITY_COLORS: Record<string, string> = { critical: "text-red-600 bg-red-500/10 border-red-500/30", high: "text-amber-600 bg-amber-500/10 border-amber-500/25", medium: "text-blue-600 bg-blue-500/10 border-blue-500/25", low: "text-muted-foreground bg-secondary/30 border-border/30" };
const PRIORITY_LABELS: Record<string, string> = { critical: "حرج", high: "عالية", medium: "متوسطة", low: "منخفضة" };

export default function InvestigationsPage() {
  const [, setLocation] = useLocation();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<string>("medium");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/investigations`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { investigations: Investigation[] }) => {
        setInvestigations(data.investigations);
        setLoading(false);
      })
      .catch(() => { setError("تعذّر تحميل التحقيقات"); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const createInvestigation = () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    fetch(`${API}/api/investigations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), priority: newPriority }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(() => {
        setCreateOpen(false);
        setNewTitle("");
        setCreating(false);
        load();
      })
      .catch(() => { setCreating(false); });
  };

  const filtered = investigations.filter((inv) => {
    if (search && !inv.title.includes(search)) return false;
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (priorityFilter !== "all" && inv.priority !== priorityFilter) return false;
    return true;
  });

  const activeCount = investigations.filter(i => i.status === "active").length;
  const criticalCount = investigations.filter(i => i.priority === "critical").length;
  const completedCount = investigations.filter(i => i.progress === 100).length;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">التحقيقات</h1>
            <p className="text-sm text-muted-foreground">إدارة وتحليل قضايا الاستخبارات المفتوحة</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> تحقيق جديد
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="بحث في التحقيقات..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-10" />
          </div>
          <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-10"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="closed">مغلق</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v: string) => setPriorityFilter(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-10"><SelectValue placeholder="الأولوية" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              <SelectItem value="critical">حرج</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="low">منخفضة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "إجمالي", value: investigations.length, icon: FolderSearch, color: "text-primary" },
            { label: "نشط", value: activeCount, icon: TrendingUp, color: "text-green-600" },
            { label: "حرج", value: criticalCount, icon: AlertCircle, color: "text-red-600" },
            { label: "مكتمل", value: completedCount, icon: ListTodo, color: "text-blue-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color} shrink-0`} />
                <div>
                  <div className={`text-xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
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

        {/* Investigation Cards */}
        {!loading && !error && (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border/30 rounded-xl">
                <FolderSearch className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium">لا توجد تحقيقات مطابقة</p>
                <p className="text-sm mt-1">حاول تغيير معايير البحث أو الفلترة</p>
              </div>
            ) : filtered.map((inv) => (
              <button key={inv.id} onClick={() => setLocation(`/investigation/${inv.id}`)}
                className="w-full text-right bg-card border border-border/20 hover:border-border/40 hover:bg-secondary/20 transition-all rounded-xl p-4 cursor-pointer group">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] font-mono border ${STATUS_COLORS[inv.status]}`}>
                        {STATUS_LABELS[inv.status]}
                      </Badge>
                      <Badge className={`text-[10px] font-mono border ${PRIORITY_COLORS[inv.priority]}`}>
                        {PRIORITY_LABELS[inv.priority]}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-foreground">{inv.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {inv.entityCount} كيانات</span>
                      <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {inv.evidenceCount} أدلة</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {inv.updatedAt}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">{inv.progress}%</span>
                      <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          inv.progress === 100 ? "bg-green-500" : inv.progress > 50 ? "bg-primary" : "bg-amber-500"
                        }`} style={{ width: `${inv.progress}%` }} />
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تحقيق جديد</DialogTitle>
            <DialogDescription>أدخل تفاصيل التحقيق الجديد لبدء جمع الأدلة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>عنوان التحقيق</Label>
              <Input placeholder="أدخل عنوان التحقيق..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={newPriority} onValueChange={(v: string) => setNewPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button disabled={!newTitle.trim() || creating} onClick={createInvestigation}>
              {creating ? "جارٍ الإنشاء..." : "إنشاء التحقيق"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
