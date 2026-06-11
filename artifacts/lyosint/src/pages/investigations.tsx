import { useState } from "react";
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
  ChevronLeft, Filter, ListTodo, Target, Shield, FileText,
} from "lucide-react";

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

const MOCK_INVESTIGATIONS: Investigation[] = [
  { id: "inv-001", title: "تحليل شبكة الاتصالات - طرابلس", status: "active", priority: "critical", entityCount: 12, evidenceCount: 48, progress: 75, createdAt: "2026-06-01", updatedAt: "2026-06-10" },
  { id: "inv-002", title: "هوية رقمية - مستخدم X", status: "active", priority: "high", entityCount: 5, evidenceCount: 23, progress: 45, createdAt: "2026-06-03", updatedAt: "2026-06-09" },
  { id: "inv-003", title: "تحليل حسابات وهمية - بنغازي", status: "pending", priority: "medium", entityCount: 8, evidenceCount: 15, progress: 20, createdAt: "2026-06-05", updatedAt: "2026-06-08" },
  { id: "inv-004", title: "متابعة قضية احتيال مالي", status: "active", priority: "critical", entityCount: 15, evidenceCount: 62, progress: 90, createdAt: "2026-05-20", updatedAt: "2026-06-10" },
  { id: "inv-005", title: "تحليل شبكة علاقات - سبها", status: "closed", priority: "high", entityCount: 9, evidenceCount: 31, progress: 100, createdAt: "2026-05-15", updatedAt: "2026-06-07" },
  { id: "inv-006", title: "تحديد هوية مصدر تهديد", status: "active", priority: "high", entityCount: 7, evidenceCount: 19, progress: 60, createdAt: "2026-06-06", updatedAt: "2026-06-10" },
  { id: "inv-007", title: "تحليل بيانات منصة تيليغرام", status: "archived", priority: "low", entityCount: 3, evidenceCount: 11, progress: 100, createdAt: "2026-04-10", updatedAt: "2026-05-01" },
  { id: "inv-008", title: "رصد حملة تضليل", status: "pending", priority: "medium", entityCount: 6, evidenceCount: 27, progress: 10, createdAt: "2026-06-08", updatedAt: "2026-06-09" },
];

const STATUS_LABELS: Record<string, string> = { active: "نشط", pending: "قيد الانتظار", closed: "مغلق", archived: "مؤرشف" };
const STATUS_COLORS: Record<string, string> = { active: "text-green-400 bg-green-500/10 border-green-500/25", pending: "text-amber-400 bg-amber-500/10 border-amber-500/25", closed: "text-blue-400 bg-blue-500/10 border-blue-500/25", archived: "text-muted-foreground bg-secondary/30 border-border/40" };
const PRIORITY_COLORS: Record<string, string> = { critical: "text-destructive bg-destructive/10 border-destructive/30", high: "text-amber-400 bg-amber-500/10 border-amber-500/25", medium: "text-blue-400 bg-blue-500/10 border-blue-500/25", low: "text-muted-foreground bg-secondary/30 border-border/30" };
const PRIORITY_LABELS: Record<string, string> = { critical: "حرج", high: "عالية", medium: "متوسطة", low: "منخفضة" };

export default function InvestigationsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<string>("medium");

  const filtered = MOCK_INVESTIGATIONS.filter((inv) => {
    if (search && !inv.title.includes(search)) return false;
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (priorityFilter !== "all" && inv.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <PageTransition>
      <div className="space-y-5" dir="rtl">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card px-5 py-4">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FolderSearch className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">التحقيقات</h1>
                <p className="text-sm text-muted-foreground">إدارة وتحليل قضايا الاستخبارات المفتوحة</p>
              </div>
            </div>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px] h-10"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="closed">مغلق</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
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
            { label: "إجمالي", value: MOCK_INVESTIGATIONS.length, icon: FolderSearch, color: "text-primary" },
            { label: "نشط", value: MOCK_INVESTIGATIONS.filter(i => i.status === "active").length, icon: TrendingUp, color: "text-green-400" },
            { label: "حرج", value: MOCK_INVESTIGATIONS.filter(i => i.priority === "critical").length, icon: AlertCircle, color: "text-destructive" },
            { label: "مكتمل", value: MOCK_INVESTIGATIONS.filter(i => i.progress === 100).length, icon: ListTodo, color: "text-blue-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/40">
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

        {/* Investigation Cards */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border/40 rounded-xl">
              <FolderSearch className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium">لا توجد تحقيقات مطابقة</p>
              <p className="text-sm mt-1">حاول تغيير معايير البحث أو الفلترة</p>
            </div>
          ) : filtered.map((inv, idx) => (
            <button key={inv.id} onClick={() => setLocation(`/investigation/${inv.id}`)}
              className="w-full text-right bg-card border border-border/40 hover:border-primary/30 hover:bg-primary/3 transition-all rounded-xl p-4 cursor-pointer group"
              style={{ animationDelay: `${idx * 35}ms` }}>
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
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{inv.title}</h3>
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
                  <ChevronLeft className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
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
              <Select value={newPriority} onValueChange={setNewPriority}>
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
            <Button disabled={!newTitle.trim()} onClick={() => { setCreateOpen(false); setNewTitle(""); }}>إنشاء التحقيق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
