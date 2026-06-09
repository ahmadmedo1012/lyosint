import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  User, Phone, AtSign, Search, ChevronLeft, Loader2,
  Zap, Clock, Sparkles, ArrowRight, Filter, X,
} from "lucide-react";

type SearchTab = "name" | "phone" | "username";

const TABS: { id: SearchTab; icon: typeof User; label: string; placeholder: string; pattern?: RegExp }[] = [
  { id: "name",     icon: User,   label: "الاسم",     placeholder: "أدخل الاسم الكامل…",   pattern: /^[\p{L}\s]{2,}$/u },
  { id: "phone",    icon: Phone,  label: "الهاتف",    placeholder: "+218 91 XXX XXXX",      pattern: /^[\d\s+\-()]{7,}$/ },
  { id: "username", icon: AtSign, label: "المُعرّف",   placeholder: "@username أو أي معرف",  pattern: /^[\w.\-_]{2,}$/ },
];

function detectTab(input: string, currentTab: SearchTab): SearchTab | null {
  const v = input.trim();
  if (!v) return null;
  if (/^[\d\s+\-()]{7,}$/.test(v) && /[\d]{7,}/.test(v.replace(/\D/g, ""))) return "phone";
  if (/^[\w.\-_]{2,}$/.test(v) && !/^[\p{L}\s]{2,}$/u.test(v)) return "username";
  if (/^[\p{L}\s]{2,}$/u.test(v)) return "name";
  return null;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, incrementSearch, refreshUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<SearchTab>("name");
  const [input, setInput] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  const searchByName = useSearchByName();
  const searchByPhone = useSearchByPhone();
  const searchByUsername = useSearchByUsername();
  const deepSearch = useDeepSearch();

  const canSearch = user?.canSearch ?? false;
  const searchesRemaining = user?.isSubscribed ? null : (user ? Math.max(0, 3 - user.searchCount) : 0);

  const isAnyLoading = searchByName.isPending || searchByPhone.isPending || searchByUsername.isPending || deepSearch.isPending;

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: recent, isLoading: recentLoading } = useListRecentSearches({ limit: 10 });

  const sanitized = useMemo(() => input.trim(), [input]);
  const currentValue = sanitized;

  const detected = useMemo(() => {
    if (!sanitized || autoDetected) return null;
    return detectTab(sanitized, activeTab);
  }, [sanitized, activeTab, autoDetected]);

  const activePattern = TABS.find(t => t.id === activeTab)?.pattern;
  const isValid = !sanitized || (activePattern ? activePattern.test(sanitized) : true);

  useEffect(() => {
    if (detected && detected !== activeTab) {
      setActiveTab(detected);
      setAutoDetected(true);
    }
    if (!sanitized) setAutoDetected(false);
  }, [detected, activeTab, sanitized]);

  const handleSuccess = useCallback(async (data: { id: string }) => {
    incrementSearch();
    await refreshUser();
    queryClient.invalidateQueries({ queryKey: getListRecentSearchesQueryKey() });
    setLocation(`/search/${data.id}`);
  }, [incrementSearch, refreshUser, queryClient, setLocation]);

  const handleError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("402") || msg.includes("QUOTA_EXCEEDED")) setPaywallOpen(true);
  }, []);

  const guard = useCallback((fn: () => void) => {
    if (!canSearch) { setPaywallOpen(true); return; }
    fn();
  }, [canSearch]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!sanitized || !isValid) return;

    const body = sanitized;
    if (activeTab === "name")
      guard(() => searchByName.mutate({ data: { name: body } }, { onSuccess: handleSuccess, onError: handleError }));
    else if (activeTab === "phone")
      guard(() => searchByPhone.mutate({ data: { phone: body } }, { onSuccess: handleSuccess, onError: handleError }));
    else if (activeTab === "username")
      guard(() => searchByUsername.mutate({ data: { username: body } }, { onSuccess: handleSuccess, onError: handleError }));
  }, [sanitized, isValid, activeTab, guard, searchByName, searchByPhone, searchByUsername, handleSuccess, handleError]);

  const handleDeepSearch = useCallback(() => {
    if (!sanitized) return;
    guard(() => deepSearch.mutate(
      { data: { name: activeTab === "name" ? sanitized : undefined, phone: activeTab === "phone" ? sanitized : undefined, username: activeTab === "username" ? sanitized : undefined } },
      { onSuccess: handleSuccess, onError: handleError }
    ));
  }, [sanitized, activeTab, guard, deepSearch, handleSuccess, handleError]);

  const activeTabInfo = TABS.find(t => t.id === activeTab) ?? TABS[0];
  const ActiveIcon = activeTabInfo.icon;

  return (
    <div className="space-y-5 page-transition" dir="rtl">

      {/* ── Quick status header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </span>
            البحث الاستخباراتي
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">OSINT — استعلام سريع في المنصات المفتوحة</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user?.isSubscribed ? (
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/25 text-[10px] font-semibold gap-1 px-2.5 py-1">
              <Zap className="w-3 h-3" /> غير محدود
            </Badge>
          ) : searchesRemaining !== null && (
            <Badge variant="outline" className={`text-[10px] font-mono px-2.5 py-1 ${searchesRemaining === 0 ? "text-destructive border-destructive/40" : "text-muted-foreground"}`}>
              {searchesRemaining} / 3
            </Badge>
          )}
        </div>
      </div>

      {/* ── Search card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card card-elevated">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
        <div className="relative p-4 sm:p-5 space-y-4">

          {/* Tab bar */}
          <div className="flex gap-1 bg-secondary/40 border border-border/40 p-0.5 rounded-lg">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setAutoDetected(false); inputRef.current?.focus(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition-all ${
                  activeTab === id
                    ? "bg-card text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Input row */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ActiveIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                {activeTab === "phone" && (
                  <span className="absolute left-28 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/30 font-mono pointer-events-none select-none ltr-direction">+218</span>
                )}
                <Input
                  ref={inputRef}
                  key={activeTab}
                  placeholder={activeTabInfo.placeholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  dir={activeTab === "phone" ? "ltr" : "auto"}
                  className={`h-11 pr-9 bg-background border-border/50 text-sm rounded-lg transition-all ${
                    !isValid && sanitized ? "border-destructive/50 ring-destructive/20" : "focus-visible:ring-primary/30"
                  }`}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
                {sanitized && (
                  <button
                    type="button"
                    onClick={() => setInput("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                disabled={isAnyLoading || !sanitized || !isValid}
                className="h-11 px-5 font-bold rounded-lg gap-1.5 shrink-0 text-sm"
              >
                {isAnyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !canSearch ? (
                  <Filter className="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{isAnyLoading ? "جارٍ…" : "بحث"}</span>
              </Button>
            </div>
          </form>

          {/* Deep search toggle */}
          <button
            onClick={handleDeepSearch}
            disabled={isAnyLoading || !sanitized}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/3 transition-all text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 transition-colors" />
            <span>بحث متقاطع شامل — يجمع جميع أنواع البحث في عملية واحدة</span>
            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Quick hints */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 font-mono">
            <span>تلميح:</span>
            <span className={activeTab !== "phone" ? "opacity-40" : ""}>أرقام ← هاتف</span>
            <span className="opacity-20">·</span>
            <span className={activeTab !== "username" ? "opacity-40" : ""}>@ أو أحرف/أرقام ← مُعرّف</span>
            <span className="opacity-20">·</span>
            <span className={activeTab !== "name" ? "opacity-40" : ""}>حروف عربية/إنجليزية ← اسم</span>
          </div>
        </div>
      </div>

      {/* ── Two-column content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Main: Recent / History */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> آخر العمليات
            </h2>
            {recent && recent.length > 0 && (
              <span className="text-[10px] text-muted-foreground/30 font-mono">{recent.length} عملية</span>
            )}
          </div>

          <div className="space-y-1">
            {recentLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))
            ) : recent?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground/40 border border-dashed border-border/30 rounded-lg text-xs space-y-2">
                <Search className="w-6 h-6 mx-auto opacity-30" />
                <p>لا توجد عمليات سابقة — ابدأ أول استعلام</p>
              </div>
            ) : recent?.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setLocation(`/search/${item.id}`)}
                className="w-full text-right bg-card border border-border/40 hover:border-primary/25 hover:bg-primary/[0.02] transition-all px-3.5 py-2.5 rounded-lg flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 shrink-0 uppercase opacity-60">
                    {item.type}
                  </Badge>
                  <span className="font-medium text-sm group-hover:text-primary transition-colors truncate" dir="auto">
                    {item.query}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 mr-2">
                  {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                    <span className={`font-mono font-bold text-xs tabular-nums ${
                      item.confidenceScore > 0.75 ? "text-green-500/80" : item.confidenceScore > 0.4 ? "text-amber-500/80" : "text-destructive/60"
                    }`}>
                      {Math.round(item.confidenceScore * 100)}%
                    </span>
                  )}
                  <ChevronLeft className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar: Stats */}
        <div className="space-y-3">
          <h2 className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">
            إحصائيات
          </h2>

          {statsLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`stat-${i}`} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "كل الاستعلامات", value: stats.totalSearches.toLocaleString("ar"), color: "text-primary" },
                { label: "نسبة الاكتشاف",  value: `${Math.round((stats.totalFindings / Math.max(1, stats.totalSearches)) * 100)}%`, color: "text-green-500" },
                { label: "المنصات",        value: String(stats.platformsCovered), color: "text-blue-400" },
                { label: "عمليات اليوم",   value: String(stats.recentSearchCount), color: "text-amber-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-3 rounded-lg border border-border/30 bg-card flex flex-col gap-1">
                  <div className="text-[10px] text-muted-foreground/60 font-medium">{label}</div>
                  <div className={`text-lg font-black font-mono tabular-nums ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}
