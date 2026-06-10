import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStats,
  useSearchByName,
  useSearchByPhone,
  useSearchByUsername,
  useDeepSearch,
  useListRecentSearches,
  getListRecentSearchesQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth";
import { PaywallModal } from "@/components/paywall-modal";
import {
  User, Phone, AtSign, Zap, Activity, Clock, ShieldAlert, AlertCircle,
  Crown, Lock, Search, ChevronLeft, TrendingUp, Globe,
  Loader2, Layers
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم", phone: "هاتف", username: "معرّف", deep: "شامل",
};
const TYPE_COLORS: Record<string, string> = {
  name: "text-blue-400 bg-blue-500/10 border-blue-500/25",
  phone: "text-green-400 bg-green-500/10 border-green-500/25",
  username: "text-purple-400 bg-purple-500/10 border-purple-500/25",
  deep: "text-amber-400 bg-amber-500/10 border-amber-500/25",
};

type SearchTab = "name" | "phone" | "username";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, incrementSearch, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<SearchTab>("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);

  const searchByName = useSearchByName();
  const searchByPhone = useSearchByPhone();
  const searchByUsername = useSearchByUsername();
  const deepSearch = useDeepSearch();

  const canSearch = user?.canSearch ?? false;
  const searchesRemaining = user?.isSubscribed ? null : (user ? Math.max(0, 3 - user.searchCount) : 0);
  const isAnyLoading = searchByName.isPending || searchByPhone.isPending || searchByUsername.isPending || deepSearch.isPending;

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useGetStats();
  const { data: recent, isLoading: recentLoading, isError: recentError, refetch: refetchRecent } = useListRecentSearches({ limit: 8 });

  const handleSuccess = async (data: { id: string }) => {
    incrementSearch();
    await refreshUser();
    queryClient.invalidateQueries({ queryKey: getListRecentSearchesQueryKey() });
    setLocation(`/search/${data.id}`);
  };

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("402") || msg.includes("QUOTA_EXCEEDED")) setPaywallOpen(true);
  };

  const guard = (fn: () => void) => {
    if (!canSearch) { setPaywallOpen(true); return; }
    fn();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "name" && name.trim())
      guard(() => searchByName.mutate({ data: { name } }, { onSuccess: handleSuccess, onError: handleError }));
    if (activeTab === "phone" && phone.trim())
      guard(() => searchByPhone.mutate({ data: { phone } }, { onSuccess: handleSuccess, onError: handleError }));
    if (activeTab === "username" && username.trim())
      guard(() => searchByUsername.mutate({ data: { username } }, { onSuccess: handleSuccess, onError: handleError }));
  };

  const handleDeepSearch = () => {
    if (!name.trim() && !phone.trim() && !username.trim()) return;
    guard(() => deepSearch.mutate(
      { data: { name: name || undefined, phone: phone || undefined, username: username || undefined } },
      { onSuccess: handleSuccess, onError: handleError }
    ));
  };

  const currentValue = activeTab === "name" ? name : activeTab === "phone" ? phone : username;
  const setCurrentValue = activeTab === "name" ? setName : activeTab === "phone" ? setPhone : setUsername;

  const tabs: { id: SearchTab; icon: React.ElementType; label: string; placeholder: string; dir: "ltr" | "rtl" | "auto" }[] = [
    { id: "name", icon: User, label: "الاسم", placeholder: "أدخل الاسم الكامل أو جزء منه…", dir: "auto" },
    { id: "phone", icon: Phone, label: "الهاتف", placeholder: "+218 91 XXX XXXX أو 092XXXXXXX", dir: "ltr" },
    { id: "username", icon: AtSign, label: "المعرّف", placeholder: "@username", dir: "ltr" },
  ];

  return (
    <div className="space-y-6 page-transition" dir="rtl">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-secondary/20 p-5 sm:p-7">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.025] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                لوحة الاستخبارات
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              منصة OSINT متكاملة — تحليل المعلومات المفتوحة في ثوانٍ
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user?.isSubscribed ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold">
                <Crown className="w-3.5 h-3.5" />
                مشترك نشط
              </div>
            ) : searchesRemaining === 0 ? (
              <button onClick={() => setPaywallOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs font-semibold hover:bg-destructive/15 transition-colors">
                <Lock className="w-3.5 h-3.5" />
                اشترك للمتابعة
              </button>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/50 text-xs text-muted-foreground font-medium">
                {searchesRemaining} بحث مجاني متبقي
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">

        {/* ── Search Panel ── */}
        <div className="xl:col-span-3 space-y-4">

          {/* Tab Selector */}
          <div className="flex gap-1.5 bg-secondary/30 border border-border/40 p-1 rounded-xl">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearch}>
            <div className="relative group">
              <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity -m-0.5 blur-sm" />
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    key={activeTab}
                    placeholder={tabs.find(t => t.id === activeTab)?.placeholder}
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    dir={tabs.find(t => t.id === activeTab)?.dir}
                    className="h-12 pr-10 bg-background border-border/60 focus-visible:ring-primary text-sm rounded-xl"
                    autoFocus
                  />
                </div>
                <Button type="submit"
                  disabled={isAnyLoading || !currentValue.trim()}
                  className="h-12 px-6 font-bold rounded-xl gap-2 shrink-0">
                  {isAnyLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : !canSearch ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isAnyLoading ? "جاري البحث…" : "بحث"}
                  </span>
                </Button>
              </div>
            </div>
          </form>

          {/* Deep Search */}
          <button onClick={handleDeepSearch}
            disabled={isAnyLoading || (!name.trim() && !phone.trim() && !username.trim())}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-dashed border-primary/30 text-muted-foreground hover:text-primary hover:border-primary/60 hover:bg-primary/4 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed group">
            <Layers className="w-4 h-4 group-hover:text-primary transition-colors" />
            بحث شامل متقاطع — يجمع الاسم + الهاتف + المعرّف في عملية واحدة
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          </button>

          {/* Recent Searches */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xs text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> آخر العمليات
              </h2>
              {recent && recent.length > 0 && (
                <span className="text-[11px] text-muted-foreground/50 font-mono">{recent.length} عملية</span>
              )}
            </div>

            <div className="space-y-1.5">
              {recentError ? (
                <div className="text-center py-8 text-destructive border border-dashed border-border/40 rounded-xl text-sm space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
                  <p className="font-medium">فشل تحميل آخر العمليات</p>
                  <button onClick={() => refetchRecent()} className="text-primary hover:underline text-xs">
                    إعادة المحاولة
                  </button>
                </div>
              ) : recentLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-13 rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />
                ))
              ) : recent?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border/40 rounded-xl text-sm space-y-2">
                  <Search className="w-8 h-8 mx-auto text-muted-foreground/30" />
                  <p>لا توجد عمليات بحث بعد — ابدأ أول استعلام</p>
                </div>
              ) : recent?.map((item, idx) => (
                <button key={item.id} onClick={() => setLocation(`/search/${item.id}`)}
                  className="w-full text-right bg-card border border-border/40 hover:border-primary/30 hover:bg-primary/3 transition-all px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer group"
                  style={{ animationDelay: `${idx * 35}ms` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={`text-[10px] font-mono px-2 py-0.5 border shrink-0 ${TYPE_COLORS[item.type] ?? "text-muted-foreground"}`}>
                      {TYPE_LABELS[item.type] ?? item.type}
                    </Badge>
                    <span className="font-medium text-sm group-hover:text-primary transition-colors truncate" dir="auto">
                      {item.query}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mr-2">
                    {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                      <span className={`font-mono font-bold text-sm tabular-nums ${
                        item.confidenceScore > 0.75 ? "text-green-400" : item.confidenceScore > 0.4 ? "text-amber-400" : "text-destructive"
                      }`}>
                        {Math.round(item.confidenceScore * 100)}%
                      </span>
                    )}
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats Sidebar ── */}
        <div className="space-y-3">
          <h2 className="text-xs text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> إحصائيات النظام
          </h2>

          {statsError ? (
            <div className="text-center py-8 text-destructive border border-dashed border-border/40 rounded-xl text-sm space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
              <p className="font-medium">فشل تحميل الإحصائيات</p>
              <button onClick={() => refetchStats()} className="text-primary hover:underline text-xs">
                إعادة المحاولة
              </button>
            </div>
          ) : statsLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2.5">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2.5">
              {[
                {
                  label: "إجمالي الاستعلامات",
                  value: stats.totalSearches.toLocaleString("ar"),
                  icon: Search,
                  color: "text-primary",
                  bg: "bg-primary/5 border-primary/15",
                },
                {
                  label: "نسبة الاكتشاف",
                  value: `${Math.round((stats.totalFindings / Math.max(1, stats.totalSearches)) * 100)}%`,
                  icon: TrendingUp,
                  color: "text-green-400",
                  bg: "bg-green-500/5 border-green-500/15",
                },
                {
                  label: "المنصات المفحوصة",
                  value: String(stats.platformsCovered),
                  icon: Globe,
                  color: "text-blue-400",
                  bg: "bg-blue-500/5 border-blue-500/15",
                },
                {
                  label: "عمليات اليوم",
                  value: String(stats.recentSearchCount),
                  icon: Activity,
                  color: "text-amber-400",
                  bg: "bg-amber-500/5 border-amber-500/15",
                },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={`p-3.5 rounded-xl border ${bg} flex flex-col gap-2`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
                    <Icon className={`w-3.5 h-3.5 ${color} opacity-70`} />
                  </div>
                  <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Platform count chip */}
          <div className="mt-2 p-3 rounded-xl bg-secondary/20 border border-border/30 text-center">
            <div className="text-[11px] text-muted-foreground mb-1">منصات OSINT نشطة</div>
            <div className="text-lg font-bold text-foreground font-mono">75+</div>
            <div className="text-[10px] text-muted-foreground/50 mt-0.5">GitHub، Instagram، X، TikTok، وأكثر</div>
          </div>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}
