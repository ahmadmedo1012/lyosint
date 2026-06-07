import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Terminal, Search, Globe, History, Palette, LogOut, Crown,
  User as UserIcon, Shield, ChevronDown,
} from "lucide-react";
import { useTheme, type Theme } from "@/contexts/theme";
import { useAuth } from "@/contexts/auth";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaywallModal } from "@/components/paywall-modal";

const NAV_ITEMS = [
  { href: "/", icon: Search, label: "لوحة التحكم" },
  { href: "/history", icon: History, label: "السجلات" },
  { href: "/platforms", icon: Globe, label: "المنصات" },
  { href: "/account", icon: UserIcon, label: "حسابي" },
];

const ADMIN_NAV = { href: "/admin", icon: Shield, label: "إدارة النظام" };

const THEMES: { id: Theme; label: string; color: string }[] = [
  { id: "cyan", label: "سايان", color: "#00d2e6" },
  { id: "amber", label: "كهرماني", color: "#f5a623" },
  { id: "matrix", label: "ماتريكس", color: "#32c850" },
];

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      return now.toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    };
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
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

  const searchesRemaining = user?.isSubscribed ? null : (user ? Math.max(0, 3 - user.searchCount) : 3);
  const quotaPercent = user?.isSubscribed ? 100 : Math.min(100, ((user?.searchCount ?? 0) / 3) * 100);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen min-h-[100dvh] w-full bg-background text-foreground overflow-hidden" dir="rtl">

        {/* ── SIDEBAR ── */}
        <Sidebar side="right" className="border-l border-border/60 bg-sidebar shrink-0 flex flex-col">

          {/* Brand */}
          <SidebarHeader className="border-b border-border/40 px-4 py-4 shrink-0">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer group">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Terminal className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-mono font-bold text-primary text-base leading-none tracking-wider text-glow group-hover:opacity-80 transition-opacity">
                    LYOSINT
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">منصة الاستخبارات الليبية</div>
                </div>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

            {/* User card */}
            {user && (
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-3">
                <div className="flex items-center gap-2.5">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="" className="w-9 h-9 rounded-full border border-border/60 shrink-0 object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
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

                {user.isSubscribed ? (
                  <Badge className="w-full justify-center bg-primary/12 text-primary border border-primary/25 text-[11px] font-medium gap-1.5 py-1">
                    <Crown className="w-3 h-3" /> مشترك نشط
                  </Badge>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">بحث مجاني متبقي</span>
                      <span className={`font-mono font-bold tabular-nums ${searchesRemaining === 0 ? "text-destructive" : "text-primary"}`}>
                        {searchesRemaining}/3
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          searchesRemaining === 0 ? "bg-destructive" : searchesRemaining === 1 ? "bg-amber-500" : "bg-primary"
                        }`}
                        style={{ width: `${100 - quotaPercent}%` }}
                      />
                    </div>
                    {searchesRemaining === 0 ? (
                      <Button onClick={() => setPaywallOpen(true)} size="sm"
                        className="w-full h-7 text-[11px] font-medium gap-1.5">
                        <Crown className="w-3 h-3" /> اشترك الآن · 30 د.ل/شهر
                      </Button>
                    ) : searchesRemaining === 1 && (
                      <p className="text-[10px] text-amber-500/80 text-center">آخر بحث مجاني — اشترك للاستمرار</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground/60 uppercase font-medium tracking-widest px-2 mb-2">القائمة</p>
              <SidebarMenu className="space-y-0.5">
                {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                  const isActive = href === "/" ? location === "/" : location.startsWith(href);
                  return (
                    <SidebarMenuItem key={href}>
                      <Link href={href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                            isActive
                              ? "bg-primary/12 text-primary border border-primary/20"
                              : "text-sidebar-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1">{label}</span>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}

                {/* Admin link - always show for now */}
                <SidebarMenuItem>
                  <Link href={ADMIN_NAV.href}>
                    <SidebarMenuButton
                      isActive={location === ADMIN_NAV.href}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                        location === ADMIN_NAV.href
                          ? "bg-primary/12 text-primary border border-primary/20"
                          : "text-sidebar-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                      }`}
                    >
                      <ADMIN_NAV.icon className="w-4 h-4 shrink-0 text-amber-500/70" />
                      <span className="flex-1">{ADMIN_NAV.label}</span>
                      <Badge className="text-[9px] bg-amber-500/15 text-amber-400 border-amber-500/20 font-mono py-0 px-1.5">
                        ADM
                      </Badge>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>

            {/* Theme Switcher */}
            <div>
              <button
                onClick={() => setThemeOpen(!themeOpen)}
                className="w-full flex items-center justify-between px-2 mb-2 group"
              >
                <p className="text-[10px] text-muted-foreground/60 uppercase font-medium tracking-widest group-hover:text-muted-foreground transition-colors">
                  <Palette className="w-3 h-3 inline ml-1.5" />الثيم
                </p>
                <ChevronDown className={`w-3 h-3 text-muted-foreground/40 transition-transform ${themeOpen ? "rotate-180" : ""}`} />
              </button>
              {themeOpen && (
                <div className="space-y-1">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        theme === t.id
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color, boxShadow: theme === t.id ? `0 0 8px ${t.color}80` : "none" }}
                      />
                      {t.label}
                      {theme === t.id && <span className="mr-auto text-[10px] opacity-60">نشط</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="border-t border-border/40 px-3 py-3 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 font-mono px-1">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                متصل
              </span>
              <span>v3.0</span>
            </div>
            {user && (
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" /> تسجيل الخروج
              </button>
            )}
          </SidebarFooter>
        </Sidebar>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col min-h-screen min-h-[100dvh] overflow-hidden min-w-0">

          {/* Topbar */}
          <header className="h-13 sm:h-14 border-b border-border/50 flex items-center px-3 sm:px-5 shrink-0 bg-background/95 backdrop-blur-sm z-10 sticky top-0 gap-3">
            <SidebarTrigger className="mr-auto shrink-0 text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/40">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider hidden sm:block">
                UTC+2
              </span>
              <LiveClock />
            </div>
          </header>

          {/* Page */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-7 scroll-smooth" dir="rtl">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </SidebarProvider>
  );
}
