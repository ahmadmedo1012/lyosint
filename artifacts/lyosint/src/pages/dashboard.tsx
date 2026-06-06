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
import { User, Phone, AtSign, Zap, Activity, Clock, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم",
  phone: "هاتف",
  username: "مستخدم",
  deep: "شامل",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "مكتمل",
  failed: "فاشل",
  running: "جاري",
  pending: "انتظار",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");

  const searchByName = useSearchByName();
  const searchByPhone = useSearchByPhone();
  const searchByUsername = useSearchByUsername();
  const deepSearch = useDeepSearch();

  const handleSuccess = (data: { id: string }) => {
    queryClient.invalidateQueries({ queryKey: getListRecentSearchesQueryKey() });
    setLocation(`/search/${data.id}`);
  };

  const handleNameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    searchByName.mutate({ data: { name } }, { onSuccess: handleSuccess });
  };

  const handlePhoneSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    searchByPhone.mutate({ data: { phone } }, { onSuccess: handleSuccess });
  };

  const handleUsernameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    searchByUsername.mutate({ data: { username } }, { onSuccess: handleSuccess });
  };

  const handleDeepSearch = () => {
    if (!name.trim() && !phone.trim() && !username.trim()) return;
    deepSearch.mutate(
      { data: { name: name || undefined, phone: phone || undefined, username: username || undefined } },
      { onSuccess: handleSuccess }
    );
  };

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: recent, isLoading: recentLoading } = useListRecentSearches({ limit: 5 });

  const isAnyLoading = searchByName.isPending || searchByPhone.isPending || searchByUsername.isPending || deepSearch.isPending;

  return (
    <div className="space-y-8 page-transition">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-3 text-glow">
          <Activity className="w-8 h-8 shrink-0" />
          لوحة الاستخبارات
        </h1>
        <p className="text-muted-foreground mt-2 text-sm cursor-blink">
          اختر نوع البحث. جميع الاستعلامات مسجّلة ومراقبة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-6">
          <Card className="border-primary/20 bg-card/60 backdrop-blur border-glow">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base uppercase tracking-widest text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                بدء الاستعلام
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="name" className="w-full" dir="rtl">
                <TabsList className="grid w-full grid-cols-3 bg-secondary/40 mb-6 h-11">
                  <TabsTrigger value="name" className="font-medium gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                    <User className="w-4 h-4" /> الاسم
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="font-medium gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                    <Phone className="w-4 h-4" /> الهاتف
                  </TabsTrigger>
                  <TabsTrigger value="username" className="font-medium gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                    <AtSign className="w-4 h-4" /> اسم المستخدم
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="name">
                  <form onSubmit={handleNameSearch} className="flex gap-3">
                    <Input
                      placeholder="أدخل الاسم الكامل أو جزء منه (عربي / إنجليزي)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 bg-background border-primary/30 focus-visible:ring-primary text-base"
                      data-testid="input-search-name"
                      dir="auto"
                    />
                    <Button
                      type="submit"
                      disabled={isAnyLoading || !name.trim()}
                      className="h-12 px-8 font-mono uppercase font-bold tracking-wider shrink-0"
                      data-testid="button-search-name"
                    >
                      {searchByName.isPending ? "..." : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="phone">
                  <form onSubmit={handlePhoneSearch} className="flex gap-3">
                    <Input
                      placeholder="+21891XXXXXXX  أو  092XXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-12 bg-background border-primary/30 focus-visible:ring-primary text-base font-mono"
                      data-testid="input-search-phone"
                      dir="ltr"
                    />
                    <Button
                      type="submit"
                      disabled={isAnyLoading || !phone.trim()}
                      className="h-12 px-8 font-mono uppercase font-bold tracking-wider shrink-0"
                      data-testid="button-search-phone"
                    >
                      {searchByPhone.isPending ? "..." : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="username">
                  <form onSubmit={handleUsernameSearch} className="flex gap-3">
                    <Input
                      placeholder="@username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-12 bg-background border-primary/30 focus-visible:ring-primary text-base font-mono"
                      data-testid="input-search-username"
                      dir="ltr"
                    />
                    <Button
                      type="submit"
                      disabled={isAnyLoading || !username.trim()}
                      className="h-12 px-8 font-mono uppercase font-bold tracking-wider shrink-0"
                      data-testid="button-search-username"
                    >
                      {searchByUsername.isPending ? "..." : "ابحث"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-8 pt-6 border-t border-border/40 flex flex-col items-center gap-3">
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                  محرك الربط المتقاطع
                </div>
                <Button
                  onClick={handleDeepSearch}
                  disabled={isAnyLoading || (!name.trim() && !phone.trim() && !username.trim())}
                  className="w-full max-w-sm h-12 font-bold tracking-wider bg-destructive/15 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/40 gap-2"
                  data-testid="button-deep-search"
                >
                  <Zap className="w-5 h-5" />
                  بحث شامل في جميع الاتجاهات
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 font-mono">
              <Clock className="w-4 h-4" />
              العمليات الأخيرة
            </h2>
            <div className="grid gap-2">
              {recentLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-secondary/40 rounded-lg" />
                ))
              ) : recent?.map((item, idx) => (
                <a key={item.id} href={`/search/${item.id}`} onClick={(e) => { e.preventDefault(); setLocation(`/search/${item.id}`); }}>
                  <div
                    className="bg-card border border-border hover:border-primary/40 transition-all duration-200 p-4 rounded-lg flex items-center justify-between cursor-pointer group stagger-item hover:bg-primary/5"
                    style={{ animationDelay: `${idx * 50}ms` }}
                    data-testid={`history-item-${item.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="uppercase font-mono text-[10px] text-primary border-primary/30 bg-primary/5 shrink-0"
                      >
                        {TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                      <span className="font-medium group-hover:text-primary transition-colors" dir="auto">
                        {item.query}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                        <span className={`font-mono font-bold ${item.confidenceScore > 0.75 ? "text-green-500" : item.confidenceScore > 0.4 ? "text-amber-500" : "text-destructive"}`}>
                          {Math.round(item.confidenceScore * 100)}%
                        </span>
                      )}
                      <span className="text-muted-foreground font-mono">
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
                <ShieldAlert className="w-4 h-4" />
                حالة النظام
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {statsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : stats ? (
                <>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-mono">إجمالي الاستعلامات</div>
                    <div className="text-3xl font-bold text-primary text-glow font-mono">{stats.totalSearches.toLocaleString("ar")}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-mono">نتائج النتائج</div>
                    <div className="text-3xl font-bold text-foreground font-mono">
                      {Math.round((stats.totalFindings / Math.max(1, stats.totalSearches)) * 100)}%
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-mono">المنصات المغطّاة</div>
                    <div className="text-3xl font-bold text-primary text-glow font-mono">{stats.platformsCovered}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-mono">اليوم</div>
                    <div className="text-3xl font-bold text-green-500 font-mono">{stats.recentSearchCount}</div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
