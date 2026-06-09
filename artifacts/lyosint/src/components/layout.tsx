import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarFooter,
} from "@/components/ui/sidebar";
import { Terminal, Search, Globe, History, Palette, LogOut, Crown, User as UserIcon, ChevronDown } from "lucide-react";
import { SUBSCRIPTION_PRICE_LABEL } from "@/lib/constants";
import { useTheme, type Theme } from "@/contexts/theme";
import { useAuth } from "@/contexts/auth";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaywallModal } from "@/components/paywall-modal";

const NAV_ITEMS = [
  { href: "/",          icon: Search,    label: "البحث الاستخباراتي" },
  { href: "/history",   icon: History,   label: "السجلات" },
  { href: "/platforms", icon: Globe,     label: "المنصات المدعومة" },
  { href: "/account",   icon: UserIcon,  label: "حسابي" },
];

const THEMES: { id: Theme; label: string; dot: string }[] = [
  { id: "cyan",   label: "سايان",    dot: "bg-cyan-400" },
  { id: "amber",  label: "كهرماني", dot: "bg-amber-400" },
  { id: "matrix", label: "ماتريكس", dot: "bg-green-500" },
];

function LiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  );
  useEffect(() => {
    const t = setInterval(() =>
      setTime(new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }))
    , 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-primary font-mono text-xs tabular-nums">{time}</span>;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  const isSubscribed = user?.isSubscribed ?? false;
  const searchCount = user?.searchCount ?? 0;
  const searchesLeft = isSubscribed ? null : Math.max(0, 3 - searchCount);
  const quotaFill = isSubscribed ? 0 : Math.min(100, (searchCount / 3) * 100);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen min-h-[100dvh] w-full bg-background text-foreground overflow-hidden" dir="rtl">

        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        <Sidebar side="right" className="border-l border-border/50 bg-sidebar flex flex-col shrink-0">

          {/* Brand */}
          <SidebarHeader className="border-b border-border/40 px-4 py-3.5 shrink-0">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Terminal className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-mono font-bold text-primary text-[15px] leading-none tracking-wider group-hover:opacity-75 transition-opacity">
                    LYOSINT
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">منصة الاستخبارات الليبية</div>
                </div>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

            {/* User Card */}
            {user && (
              <div className="rounded-lg border border-border/50 bg-secondary/15 p-3 space-y-3">
                <div className="flex items-center gap-2.5">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="" className="w-9 h-9 rounded-full border border-border/50 shrink-0 object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                      {user.firstName[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate leading-tight">
                      {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
                    </div>
                    {user.username && (
                      <div className="text-[11px] text-muted-foreground font-mono truncate leading-tight mt-0.5" dir="ltr">
                        @{user.username}
                      </div>
                    )}
                  </div>
                </div>

                {isSubscribed ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium bg-primary/8 rounded-md px-2.5 py-1.5 border border-primary/15">
                    <Crown className="w-3 h-3 shrink-0" />
                    <span>اشتراك نشط</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground">بحث مجاني متبقي</span>
                      <span className={`font-mono font-bold tabular-nums ${searchesLeft === 0 ? "text-destructive" : "text-primary"}`}>
                        {searchesLeft}/3
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          searchesLeft === 0 ? "bg-destructive" : searchesLeft === 1 ? "bg-amber-500" : "bg-primary"
                        }`}
                        style={{ width: `${Math.max(2, 100 - quotaFill)}%` }}
                      />
                    </div>
                    {searchesLeft === 0 && (
                      <Button
                        onClick={() => setPaywallOpen(true)}
                        size="sm"
                        className="w-full h-7 text-[11px] font-medium gap-1.5"
                      >
                        <Crown className="w-3 h-3" /> اشترك · {SUBSCRIPTION_PRICE_LABEL}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-2 mb-2">التنقل</p>
              <SidebarMenu className="space-y-0.5">
                {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                  const isActive = href === "/" ? location === "/" : location.startsWith(href);
                  return (
                    <SidebarMenuItem key={href}>
                      <Link href={href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150 cursor-pointer select-none ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-sidebar-foreground hover:bg-white/4 hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1">{label}</span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>

            {/* Theme Switcher */}
            <div>
              <button
                onClick={() => setThemeOpen(!themeOpen)}
                className="w-full flex items-center justify-between px-2 py-1 group rounded-md hover:bg-white/3 transition-colors"
              >
                <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest group-hover:text-muted-foreground transition-colors flex items-center gap-1.5">
                  <Palette className="w-3 h-3" /> الثيم
                </span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground/30 transition-transform duration-200 ${themeOpen ? "rotate-180" : ""}`} />
              </button>

              {themeOpen && (
                <div className="mt-1.5 space-y-0.5 fade-in">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13px] font-medium transition-all ${
                        theme === t.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/4"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot} ${theme === t.id ? "opacity-100" : "opacity-50"}`} />
                      {t.label}
                      {theme === t.id && <span className="mr-auto text-[10px] opacity-50 font-mono">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="border-t border-border/40 px-3 py-3 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 font-mono px-1">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                متصل
              </span>
              <LiveClock />
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all font-medium"
            >
              <LogOut className="w-3.5 h-3.5" /> تسجيل الخروج
            </button>
          </SidebarFooter>
        </Sidebar>

        {/* ── MAIN CONTENT ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-screen min-h-[100dvh] overflow-hidden min-w-0">

          {/* Topbar */}
          <header className="h-12 border-b border-border/40 flex items-center px-4 sm:px-5 shrink-0 bg-background/90 backdrop-blur-sm z-10 sticky top-0 gap-3">
            <SidebarTrigger className="mr-auto shrink-0 text-muted-foreground hover:text-foreground transition-colors" />
            <div className="flex items-center gap-2 bg-secondary/40 px-2.5 py-1 rounded-md border border-border/40">
              <span className="text-[10px] text-muted-foreground/50 uppercase font-mono hidden sm:block">UTC+2</span>
              <LiveClock />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-7 scroll-smooth" dir="rtl">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </SidebarProvider>
  );
}
