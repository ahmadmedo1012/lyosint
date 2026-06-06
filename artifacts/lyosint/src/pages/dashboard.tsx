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
  const { user, token, incrementSearch, refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);

  const authHeader = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

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
    if (err instanceof Error && err.message.includes("402")) {
      setPaywallOpen(true);
    }
  };

  const guardedSearch = (fn: () => void) => {
    if (!canSearch) { setPaywallOpen(true); return; }
    fn();
  };

  const handleNameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    guardedSearch(() => searchByName.mutate({ data: { name }, ...authHeader }, { onSuccess: handleSuccess, onError: handleError }));
  };

  const handlePhoneSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    guardedSearch(() => searchByPhone.mutate({ data: { phone }, ...authHeader }, { onSuccess: handleSuccess, onError: handleError }));
  };

  const handleUsernameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    guardedSearch(() => searchByUsername.mutate({ data: { username }, ...authHeader }, { onSuccess: handleSuccess, onError: handleError }));
  };

  const handleDeepSearch = () => {
    if (!name.trim() && !phone.trim() && !username.trim()) return;
    guardedSearch(() => deepSearch.mutate(
      { data: { name: name || undefined, phone: phone || undefined, username: username || undefined }, ...authHeader },
      { onSuccess: handleSuccess, onError: handleError }
    ));
  };

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: recent, isLoading: recentLoading } = useListRecentSearches({ limit: 5 }, { headers: { Authorization: `Bearer ${token ?? ""}` } });

  const isAnyLoading = searchByName.isPending || searchByPhone.isPending || searchByUsername.isPending || deepSearch.isPending;

  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-3 text-glow">
            <Activity className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            لوحة الاستخبارات
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm cursor-blink">
            اختر نوع البحث. جميع الاستعلامات مسجّلة ومراقبة.
          </p>
        </div>

        {!user?.isSubscribed && (
          <div className="flex items-center gap-2 shrink-0">
            {searchesRemaining === 0 ? (
              <button
                onClick={() => setPaywallOpen(true)}
                className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/30 px-3 py-2 rounded-lg text-xs font-mono uppercase hover:bg-primary/20 transition-colors"
              >
                <Crown className="w-3.5 h-3.5" />
                اشترك — 30 د.ل / شهر
              </button>
            ) : (
              <div className="bg-secondary/40 px-3 py-2 rounded-lg border border-border text-xs font-mono text-muted-foreground flex items-center gap-2">
                <span className="text-primary font-bold">{searchesRemaining}</span>
                <span>بحث مجاني متبقي</span>
              </div>
            )}
          </div>
        )}

        {user?.isSubscribed && (
          <Badge className="bg-primary/10 text-primary border-primary/30 font-mono gap-1.5 shrink-0">
            <Crown className="w-3 h-3" /> مشترك نشط
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <Card className="border-primary/20 bg-card/60 backdrop-blur border-glow">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base uppercase tracking-widest text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                بدء الاستعلام
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <Tabs defaultValue="name" className="w-full" dir="rtl">
                <TabsList className="grid w-full grid-cols-3 bg-secondary/40 mb-5 h-10 sm:h-11 rounded-lg p-1 gap-1">
                  <TabsTrigger value="name" className="text-xs sm:text-sm font-medium gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all rounded-md">
                    <User className="w-3.5 h-3.5 shrink-0" /><span>الاسم</span>
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="text-xs sm:text-sm font-medium gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all rounded-md">
                    <Phone className="w-3.5 h-3.5 shrink-0" /><span>الهاتف</span>
                  </TabsTrigger>
                  <TabsTrigger value="username" className="text-xs sm:text-sm font-medium gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all rounded-md">
                    <AtSign className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">اسم المستخدم</span>
                    <span className="sm:hidden">مستخدم</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="name" className="mt-0">
                  <form onSubmit={handleNameSearch} className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder="أدخل الاسم الكامل أو جزء منه" value={name} onChange={(e) => setName(e.target.value)} className="h-11 sm:h-12 bg-background border-primary/30 focus-visible:ring-primary text-sm sm:text-base" dir="auto" />
                    <Button type="submit" disabled={isAnyLoading || !name.trim()} className="h-11 sm:h-12 px-6 sm:px-8 font-mono uppercase font-bold tracking-wider shrink-0 gap-2">
                      {!canSearch && <Lock className="w-3.5 h-3.5" />}
                      {searchByName.isPending ? "..." : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="phone" className="mt-0">
                  <form onSubmit={handlePhoneSearch} className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder="+21891XXXXXXX  أو  092XXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 sm:h-12 bg-background border-primary/30 focus-visible:ring-primary text-sm sm:text-base font-mono" dir="ltr" />
                    <Button type="submit" disabled={isAnyLoading || !phone.trim()} className="h-11 sm:h-12 px-6 sm:px-8 font-mono uppercase font-bold tracking-wider shrink-0 gap-2">
                      {!canSearch && <Lock className="w-3.5 h-3.5" />}
                      {searchByPhone.isPending ? "..." : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="username" className="mt-0">
                  <form onSubmit={handleUsernameSearch} className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder="@username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 sm:h-12 bg-background border-primary/30 focus-visible:ring-primary text-sm sm:text-base font-mono" dir="ltr" />
                    <Button type="submit" disabled={isAnyLoading || !username.trim()} className="h-11 sm:h-12 px-6 sm:px-8 font-mono uppercase font-bold tracking-wider shrink-0 gap-2">
                      {!canSearch && <Lock className="w-3.5 h-3.5" />}
                      {searchByUsername.isPending ? "..." : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-5 pt-5 border-t border-border/40 flex flex-col items-center gap-3">
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                  محرك الربط المتقاطع
                </div>
                <Button
                  onClick={handleDeepSearch}
                  disabled={isAnyLoading || (!name.trim() && !phone.trim() && !username.trim())}
                  className="w-full max-w-sm h-11 sm:h-12 font-bold tracking-wider bg-destructive/15 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/40 gap-2 text-sm"
                >
                  {!canSearch ? <Lock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  بحث شامل في جميع الاتجاهات
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 font-mono">
              <Clock className="w-4 h-4" /> العمليات الأخيرة
            </h2>
            <div className="grid gap-2">
              {recentLoading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-secondary/40 rounded-lg" />)
              ) : recent?.map((item, idx) => (
                <a key={item.id} href={`/search/${item.id}`} onClick={(e) => { e.preventDefault(); setLocation(`/search/${item.id}`); }}>
                  <div
                    className="bg-card border border-border hover:border-primary/40 transition-all duration-200 p-3 sm:p-4 rounded-lg flex items-center justify-between cursor-pointer group stagger-item hover:bg-primary/5"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <Badge variant="outline" className="uppercase font-mono text-[10px] text-primary border-primary/30 bg-primary/5 shrink-0">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                      <span className="font-medium group-hover:text-primary transition-colors truncate text-sm" dir="auto">{item.query}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0 mr-2">
                      {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                        <span className={`font-mono font-bold ${item.confidenceScore > 0.75 ? "text-green-500" : item.confidenceScore > 0.4 ? "text-amber-500" : "text-destructive"}`}>
                          {Math.round(item.confidenceScore * 100)}%
                        </span>
                      )}
                      <span className="text-muted-foreground font-mono hidden sm:inline">
                        {new Date(item.createdAt).toLocaleTimeString("ar-LY")}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
              {recent?.length === 0 && (
                <div className="text-center p-10 text-muted-foreground border border-dashed border-border rounded-lg text-sm">
                  لا توجد عمليات بحث حديثة
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="bg-secondary/20 border-border border-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4" /> حالة النظام
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  {[
                    { label: "إجمالي الاستعلامات", value: stats.totalSearches.toLocaleString("ar"), color: "text-primary" },
                    { label: "نسبة النتائج", value: `${Math.round((stats.totalFindings / Math.max(1, stats.totalSearches)) * 100)}%`, color: "text-foreground" },
                    { label: "المنصات المغطّاة", value: String(stats.platformsCovered), color: "text-primary" },
                    { label: "اليوم", value: String(stats.recentSearchCount), color: "text-green-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded bg-background/40 border border-border/30 space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase font-mono">{label}</div>
                      <div className={`text-2xl font-bold font-mono text-glow ${color}`}>{value}</div>
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
