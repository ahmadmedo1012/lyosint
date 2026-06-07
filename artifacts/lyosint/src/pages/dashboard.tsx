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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Phone, AtSign, Zap, Activity, Clock, ShieldAlert, Crown, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";
import { PaywallModal } from "@/components/paywall-modal";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم", phone: "هاتف", username: "مستخدم", deep: "شامل",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, incrementSearch, refreshUser } = useAuth();

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

  const handleSuccess = async (data: { id: string }) => {
    incrementSearch();
    await refreshUser();
    queryClient.invalidateQueries({ queryKey: getListRecentSearchesQueryKey() });
    setLocation(`/search/${data.id}`);
  };

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("402") || msg.includes("QUOTA_EXCEEDED")) {
      setPaywallOpen(true);
    }
  };

  const guard = (fn: () => void) => {
    if (!canSearch) { setPaywallOpen(true); return; }
    fn();
  };

  const handleNameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    guard(() => searchByName.mutate({ data: { name } }, { onSuccess: handleSuccess, onError: handleError }));
  };

  const handlePhoneSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    guard(() => searchByPhone.mutate({ data: { phone } }, { onSuccess: handleSuccess, onError: handleError }));
  };

  const handleUsernameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    guard(() => searchByUsername.mutate({ data: { username } }, { onSuccess: handleSuccess, onError: handleError }));
  };

  const handleDeepSearch = () => {
    if (!name.trim() && !phone.trim() && !username.trim()) return;
    guard(() => deepSearch.mutate(
      { data: { name: name || undefined, phone: phone || undefined, username: username || undefined } },
      { onSuccess: handleSuccess, onError: handleError }
    ));
  };

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: recent, isLoading: recentLoading } = useListRecentSearches({ limit: 5 });
  const isAnyLoading = searchByName.isPending || searchByPhone.isPending || searchByUsername.isPending || deepSearch.isPending;

  return (
    <div className="space-y-6 page-transition" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-3 text-glow">
            <Activity className="w-7 h-7 shrink-0" />
            لوحة الاستخبارات
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            اختر نوع البحث — جميع الاستعلامات مسجّلة
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user?.isSubscribed ? (
            <Badge className="bg-primary/10 text-primary border-primary/25 gap-1.5 font-medium">
              <Crown className="w-3.5 h-3.5" /> مشترك نشط
            </Badge>
          ) : (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              searchesRemaining === 0
                ? "bg-destructive/10 text-destructive border-destructive/25"
                : "bg-secondary/50 text-muted-foreground border-border/50"
            }`}>
              {searchesRemaining === 0 ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <button onClick={() => setPaywallOpen(true)} className="hover:underline">
                    اشترك للاستمرار — 30 د.ل
                  </button>
                </>
              ) : (
                <span>{searchesRemaining} بحث مجاني متبقي</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Search Card */}
        <div className="lg:col-span-3 space-y-5">
          <Card className="border-primary/20 bg-card/60 backdrop-blur border-glow">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                محرك البحث الاستخباراتي
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <Tabs defaultValue="name" dir="rtl">
                <TabsList className="grid w-full grid-cols-3 bg-secondary/40 mb-5 h-10 rounded-xl p-1 gap-1">
                  {[
                    { value: "name", icon: User, label: "الاسم" },
                    { value: "phone", icon: Phone, label: "الهاتف" },
                    { value: "username", icon: AtSign, label: "المعرّف" },
                  ].map(({ value, icon: Icon, label }) => (
                    <TabsTrigger key={value} value={value}
                      className="text-sm font-medium gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all rounded-lg">
                      <Icon className="w-3.5 h-3.5 shrink-0" />{label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="name">
                  <form onSubmit={handleNameSearch} className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder="أدخل الاسم الكامل أو جزء منه…" value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 bg-background border-border/60 focus-visible:ring-primary text-sm" dir="auto" />
                    <Button type="submit" disabled={isAnyLoading || !name.trim()} className="h-11 px-7 font-bold shrink-0 gap-2">
                      {!canSearch && <Lock className="w-3.5 h-3.5" />}
                      {searchByName.isPending ? "جاري البحث…" : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="phone">
                  <form onSubmit={handlePhoneSearch} className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder="+21891XXXXXXX أو 092XXXXXXX" value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-11 bg-background border-border/60 focus-visible:ring-primary text-sm font-mono" dir="ltr" />
                    <Button type="submit" disabled={isAnyLoading || !phone.trim()} className="h-11 px-7 font-bold shrink-0 gap-2">
                      {!canSearch && <Lock className="w-3.5 h-3.5" />}
                      {searchByPhone.isPending ? "جاري البحث…" : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="username">
                  <form onSubmit={handleUsernameSearch} className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder="@username" value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-11 bg-background border-border/60 focus-visible:ring-primary text-sm font-mono" dir="ltr" />
                    <Button type="submit" disabled={isAnyLoading || !username.trim()} className="h-11 px-7 font-bold shrink-0 gap-2">
                      {!canSearch && <Lock className="w-3.5 h-3.5" />}
                      {searchByUsername.isPending ? "جاري البحث…" : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Deep Search */}
              <div className="mt-5 pt-5 border-t border-border/40 flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground font-medium">أو استخدم محرك الربط المتقاطع</p>
                <Button
                  onClick={handleDeepSearch}
                  disabled={isAnyLoading || (!name.trim() && !phone.trim() && !username.trim())}
                  className="w-full max-w-sm h-11 font-bold bg-destructive/12 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/30 gap-2"
                >
                  {!canSearch ? <Lock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  بحث شامل في جميع الاتجاهات
                </Button>
                <p className="text-[11px] text-muted-foreground/60 text-center">
                  يجمع الاسم + الهاتف + المعرّف في بحث واحد متزامن
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent searches */}
          <div className="space-y-3">
            <h2 className="text-xs text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> آخر العمليات
            </h2>
            <div className="space-y-2">
              {recentLoading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
              ) : recent?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed border-border/50 rounded-xl text-sm">
                  لا توجد عمليات بحث حديثة
                </div>
              ) : recent?.map((item, idx) => (
                <button key={item.id} onClick={() => setLocation(`/search/${item.id}`)}
                  className="w-full text-right bg-card border border-border/50 hover:border-primary/30 transition-all px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer group hover:bg-primary/4"
                  style={{ animationDelay: `${idx * 40}ms` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="uppercase font-mono text-[10px] text-primary border-primary/25 bg-primary/6 shrink-0">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </Badge>
                    <span className="font-medium text-sm group-hover:text-primary transition-colors truncate" dir="auto">
                      {item.query}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mr-2">
                    {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                      <span className={`font-mono font-bold text-sm tabular-nums ${
                        item.confidenceScore > 0.75 ? "text-green-500" : item.confidenceScore > 0.4 ? "text-amber-500" : "text-destructive"
                      }`}>
                        {Math.round(item.confidenceScore * 100)}%
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono hidden sm:block tabular-nums">
                      {new Date(item.createdAt).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          <Card className="bg-secondary/15 border-border/40">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> إحصائيات النظام
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {statsLoading ? (
                <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
              ) : stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  {[
                    { label: "إجمالي الاستعلامات", value: stats.totalSearches.toLocaleString("ar"), color: "text-primary" },
                    { label: "نسبة النتائج", value: `${Math.round((stats.totalFindings / Math.max(1, stats.totalSearches)) * 100)}%`, color: "text-foreground" },
                    { label: "المنصات", value: String(stats.platformsCovered), color: "text-primary" },
                    { label: "اليوم", value: String(stats.recentSearchCount), color: "text-green-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-lg bg-background/40 border border-border/30">
                      <div className="text-[10px] text-muted-foreground mb-1 uppercase font-medium">{label}</div>
                      <div className={`text-2xl font-bold font-mono tabular-nums text-glow ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}
