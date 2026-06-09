import { useListRecentSearches } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { History as HistoryIcon, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم",
  phone: "هاتف",
  username: "مستخدم",
  deep: "شامل",
};

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const { data: history, isLoading } = useListRecentSearches({ limit: 50 });

  return (
    <div className="space-y-8 page-transition" dir="rtl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-3 text-glow">
          <HistoryIcon className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
          سجل العمليات
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          سجل زمني لجميع جلسات الاستقصاء.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden border-glow">
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b border-border/50 bg-secondary/30 text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
          <div className="col-span-3">الوقت</div>
          <div className="col-span-2">النوع</div>
          <div className="col-span-4">الاستعلام</div>
          <div className="col-span-2">الحالة</div>
          <div className="col-span-1 text-center">الثقة</div>
        </div>

        <div className="divide-y divide-border/40">
          {isLoading
            ? Array(8).fill(0).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-5 w-full bg-secondary/30" />
                </div>
              ))
            : history && history.length > 0
            ? history.map((session, idx) => (
                <div
                  key={session.id}
                  onClick={() => setLocation(`/search/${session.id}`)}
                  className="cursor-pointer hover:bg-primary/5 transition-colors group stagger-item"
                  style={{ animationDelay: `${idx * 30}ms` }}
                  data-testid={`log-row-${session.id}`}
                >
                  <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 items-center">
                    <div className="col-span-3 text-muted-foreground text-xs font-mono">
                      {new Date(session.createdAt).toLocaleString("ar-LY", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="col-span-2">
                      <Badge
                        variant="outline"
                        className="uppercase text-[10px] text-primary border-primary/30 bg-primary/5"
                      >
                        {TYPE_LABELS[session.type] ?? session.type}
                      </Badge>
                    </div>
                    <div
                      className="col-span-4 font-bold text-foreground group-hover:text-primary transition-colors truncate text-sm"
                      dir="auto"
                    >
                      {session.query}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`text-xs flex items-center gap-1.5 font-mono ${
                          session.status === "completed"
                            ? "text-green-500"
                            : session.status === "failed"
                            ? "text-destructive"
                            : "text-amber-500"
                        }`}
                      >
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
                        <span
                          className={`font-bold font-mono text-sm ${
                            session.confidenceScore > 0.75
                              ? "text-green-500"
                              : session.confidenceScore > 0.4
                              ? "text-amber-500"
                              : "text-destructive"
                          }`}
                        >
                          {Math.round(session.confidenceScore * 100)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </div>

                  <div className="flex md:hidden items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Badge
                        variant="outline"
                        className="uppercase text-[10px] text-primary border-primary/30 bg-primary/5 shrink-0"
                      >
                        {TYPE_LABELS[session.type] ?? session.type}
                      </Badge>
                      <span
                        className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate"
                        dir="auto"
                      >
                        {session.query}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {session.confidenceScore !== null && session.confidenceScore !== undefined && (
                        <span
                          className={`font-bold font-mono text-xs ${
                            session.confidenceScore > 0.75
                              ? "text-green-500"
                              : session.confidenceScore > 0.4
                              ? "text-amber-500"
                              : "text-destructive"
                          }`}
                        >
                          {Math.round(session.confidenceScore * 100)}%
                        </span>
                      )}
                      <span className="text-muted-foreground text-[10px] font-mono flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(session.createdAt).toLocaleString("ar-LY", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            : (
              <div className="p-14 text-center text-muted-foreground text-sm">
                لا توجد سجلات عمليات في النظام بعد.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
