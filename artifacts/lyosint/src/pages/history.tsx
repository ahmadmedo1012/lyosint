import { useListRecentSearches } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { History as HistoryIcon, Loader2, AlertCircle, CheckCircle2, Clock, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const TYPE_LABELS: Record<string, string> = { name: "اسم", phone: "هاتف", username: "مستخدم", deep: "شامل" };
const TYPE_COLORS: Record<string, string> = {
  name: "text-blue-600 bg-blue-500/10 border-blue-500/25",
  phone: "text-green-600 bg-green-500/10 border-green-500/25",
  username: "text-purple-600 bg-purple-500/10 border-purple-500/25",
  deep: "text-amber-600 bg-amber-500/10 border-amber-500/25",
};

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const { data: history, isLoading, isError, refetch } = useListRecentSearches({ limit: 50 });
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = history?.filter(h => typeFilter === "all" || h.type === typeFilter) ?? [];

  const types = history ? [...new Set(history.map(h => h.type))] : [];

  return (
    <div className="max-w-4xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">سجل العمليات</h1>
          <p className="text-sm text-muted-foreground">سجل زمني لجميع جلسات الاستقصاء</p>
        </div>
        <div className="flex items-center gap-2">
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-all ${
                typeFilter === t ? "bg-primary/10 text-primary border-primary/30" : "border-border/30 text-muted-foreground hover:text-foreground"
              }`}>
              {TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border/20 bg-card overflow-hidden">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-border/10 bg-secondary/20 text-[10px] text-muted-foreground font-medium">
          <div className="col-span-3">الوقت</div>
          <div className="col-span-2">النوع</div>
          <div className="col-span-4">الاستعلام</div>
          <div className="col-span-2">الحالة</div>
          <div className="col-span-1 text-center">الثقة</div>
        </div>

        <div className="divide-y divide-border/10">
          {isError ? (
            <div className="p-14 text-center text-sm space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/60" />
              <p className="text-muted-foreground">فشل تحميل سجل العمليات</p>
              <button onClick={() => refetch()} className="text-primary hover:underline text-xs">إعادة المحاولة</button>
            </div>
          ) : isLoading ? (
            Array(8).fill(0).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-5 w-full bg-secondary/30" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="p-14 text-center text-muted-foreground text-sm space-y-2">
              <Search className="w-8 h-8 mx-auto text-muted-foreground/30" />
              <p>لا توجد سجلات عمليات في النظام بعد.</p>
            </div>
          ) : filtered.map((session, idx) => (
            <div key={session.id} onClick={() => setLocation(`/search/${session.id}`)}
              className="cursor-pointer hover:bg-secondary/20 transition-colors"
              data-testid={`log-row-${session.id}`}>
              {/* Desktop */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 items-center">
                <div className="col-span-3 text-muted-foreground text-xs font-mono">
                  {new Date(session.createdAt).toLocaleString("ar-LY", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
                <div className="col-span-2">
                  <Badge className={`text-[10px] font-mono border ${TYPE_COLORS[session.type] || ""}`}>
                    {TYPE_LABELS[session.type] ?? session.type}
                  </Badge>
                </div>
                <div className="col-span-4 font-medium text-foreground truncate text-sm" dir="auto">
                  {session.query}
                </div>
                <div className="col-span-2">
                  <span className={`text-xs flex items-center gap-1.5 font-medium ${
                    session.status === "completed" ? "text-green-600"
                    : session.status === "failed" ? "text-red-600"
                    : "text-amber-600"
                  }`}>
                    {session.status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {session.status === "failed" && <AlertCircle className="w-3 h-3" />}
                    {session.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                    {session.status === "completed" ? "مكتمل" :
                     session.status === "failed" ? "فاشل" :
                     session.status === "running" ? "جاري" : "انتظار"}
                  </span>
                </div>
                <div className="col-span-1 text-center">
                  {session.confidenceScore !== null && session.confidenceScore !== undefined ? (
                    <span className={`font-bold font-mono text-sm ${
                      session.confidenceScore > 0.75 ? "text-green-600"
                      : session.confidenceScore > 0.4 ? "text-amber-600"
                      : "text-red-600"
                    }`}>
                      {Math.round(session.confidenceScore * 100)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </div>
              </div>

              {/* Mobile */}
              <div className="flex md:hidden items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Badge className={`text-[10px] font-mono border ${TYPE_COLORS[session.type] || ""} shrink-0`}>
                    {TYPE_LABELS[session.type] ?? session.type}
                  </Badge>
                  <span className="font-medium text-sm truncate" dir="auto">
                    {session.query}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {session.confidenceScore !== null && session.confidenceScore !== undefined && (
                    <span className={`font-bold font-mono text-xs ${
                      session.confidenceScore > 0.75 ? "text-green-600"
                      : session.confidenceScore > 0.4 ? "text-amber-600"
                      : "text-red-600"
                    }`}>
                      {Math.round(session.confidenceScore * 100)}%
                    </span>
                  )}
                  <span className="text-muted-foreground text-[10px] font-mono flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(session.createdAt).toLocaleString("ar-LY", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
