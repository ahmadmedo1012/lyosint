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
import { FallingPattern } from "@/components/ui/falling-pattern";
import {
  User, Phone, AtSign, Zap, Activity, Clock, ShieldAlert,
  Crown, Lock, Search, ChevronLeft, TrendingUp, Globe,
  Loader2, Layers, AlertCircle
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم", phone: "هاتف", username: "معرّف", deep: "شامل",
};
const TYPE_COLORS: Record<string, string> = {
  name: "text-blue-600 bg-blue-500/10 border-blue-500/25",
  phone: "text-green-600 bg-green-500/10 border-green-500/25",
  username: "text-purple-600 bg-purple-500/10 border-purple-500/25",
  deep: "text-amber-600 bg-amber-500/10 border-amber-500/25",
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
    <div className="relative">
      <FallingPattern
        className="fixed inset-0 -z-10"
        color="var(--primary)"
        duration={200}
        density={1.5}
        blurIntensity="0.8em"
      />
      <div className="max-w-3xl mx-auto py-4 space-y-6" dir="rtl">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          مرحباً، {user?.firstName || "المستخدم"}
        </h1>
        <p className="text-sm text-muted-foreground">
          منصة OSINT متكاملة — تحليل المعلومات المفتوحة في ثوانٍ
        </p>
      </div>

      {/* Quota Banner */}
      {user?.isSubscribed ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/30 bg-card text-sm">
          <Crown className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-foreground">اشتراك نشط</span>
          <span className="text-muted-foreground mr-auto">بحث غير محدود</span>
        </div>
      ) : searchesRemaining === 0 ? (
        <button onClick={() => setPaywallOpen(true)}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/8 text-sm text-red-500 font-medium hover:bg-red-500/12 transition-colors">
          <Lock className="w-4 h-4" />
          لقد استنفدت عمليات البحث المجانية — اشترك للمتابعة
          <span className="mr-auto">↑</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/30 bg-card text-sm">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">بحث مجاني متبقي:</span>
          <span className="font-bold text-foreground">{searchesRemaining} / 3</span>
        </div>
      )}

      {/* Search Section */}
      <div className="space-y-3">
        {/* Tab Selector */}
        <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg border border-border/30">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-card text-foreground shadow-sm border border-border/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                key={activeTab}
                placeholder={tabs.find(t => t.id === activeTab)?.placeholder}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                dir={tabs.find(t => t.id === activeTab)?.dir}
                className="h-12 pr-10 bg-card border-border/40 focus-visible:ring-primary/30 text-sm rounded-xl"
                autoFocus
              />
            </div>
            <Button type="submit"
              disabled={isAnyLoading || !currentValue.trim()}
              className="h-12 px-5 font-medium rounded-xl gap-2 shrink-0">
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
        </form>

        {/* Deep Search */}
        <button onClick={handleDeepSearch}
          disabled={isAnyLoading || (!name.trim() && !phone.trim() && !username.trim())}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-border/40 text-sm text-muted-foreground hover:text-foreground hover:border-border/60 hover:bg-secondary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <Layers className="w-4 h-4" />
          بحث شامل متقاطع — يجمع الاسم + الهاتف + المعرّف في عملية واحدة
          <Zap className="w-3.5 h-3.5 text-amber-500" />
        </button>
      </div>

      {/* Stats + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Searches */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> آخر العمليات
            </h2>
            {recent && recent.length > 0 && (
              <span className="text-[11px] text-muted-foreground/50 font-mono">{recent.length} عملية</span>
            )}
          </div>

          <div className="space-y-1">
            {recentError ? (
              <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border/30 rounded-xl space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-destructive/60" />
                <p>فشل تحميل آخر العمليات</p>
                <button onClick={() => refetchRecent()} className="text-primary hover:underline text-xs">إعادة المحاولة</button>
              </div>
            ) : recentLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
              ))
            ) : recent?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border/30 rounded-xl text-sm space-y-2">
                <Search className="w-8 h-8 mx-auto text-muted-foreground/30" />
                <p>لا توجد عمليات بحث بعد — ابدأ أول استعلام</p>
              </div>
            ) : recent?.map((item, idx) => (
              <button key={item.id} onClick={() => setLocation(`/search/${item.id}`)}
                className="w-full text-right bg-card border border-border/20 hover:border-border/50 hover:bg-secondary/30 transition-all px-3.5 py-2.5 rounded-lg flex items-center justify-between cursor-pointer group"
                style={{ animationDelay: `${idx * 35}ms` }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Badge className={`text-[10px] font-mono px-2 py-0.5 border shrink-0 ${TYPE_COLORS[item.type] ?? "text-muted-foreground"}`}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </Badge>
                  <span className="font-medium text-sm truncate" dir="auto">
                    {item.query}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 mr-2">
                  {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                    <span className={`font-mono font-bold text-sm tabular-nums ${
                      item.confidenceScore > 0.75 ? "text-green-600" : item.confidenceScore > 0.4 ? "text-amber-600" : "text-red-600"
                    }`}>
                      {Math.round(item.confidenceScore * 100)}%
                    </span>
                  )}
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <h2 className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> إحصائيات
          </h2>

          {statsError ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border/30 rounded-xl space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-destructive/60" />
              <p className="font-medium">فشل التحميل</p>
              <button onClick={() => refetchStats()} className="text-primary hover:underline text-xs">إعادة المحاولة</button>
            </div>
          ) : statsLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "إجمالي الاستعلامات", value: stats.totalSearches.toLocaleString("ar"), icon: Search, color: "text-primary" },
                { label: "نسبة الاكتشاف", value: `${Math.round((stats.totalFindings / Math.max(1, stats.totalSearches)) * 100)}%`, icon: TrendingUp, color: "text-green-600" },
                { label: "المنصات المفحوصة", value: String(stats.platformsCovered), icon: Globe, color: "text-blue-600" },
                { label: "عمليات اليوم", value: String(stats.recentSearchCount), icon: Activity, color: "text-amber-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl border border-border/20 bg-card p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                    <Icon className={`w-3.5 h-3.5 ${color} opacity-70`} />
                  </div>
                  <div className={`text-xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-xl border border-border/20 bg-card p-3.5 text-center">
            <div className="text-[11px] text-muted-foreground">منصات OSINT نشطة</div>
            <div className="text-lg font-bold text-foreground font-mono">75+</div>
            <div className="text-[10px] text-muted-foreground/50 mt-0.5">GitHub، Instagram، X، TikTok، وأكثر</div>
          </div>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
      </div>
    </div>
  );
}
