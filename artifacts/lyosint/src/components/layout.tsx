import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider, SidebarTrigger, SidebarFooter,
} from "@/components/ui/sidebar";
import { Terminal, Search, Globe, History, Palette, LogOut, Crown, User as UserIcon } from "lucide-react";
import { useTheme, type Theme } from "@/contexts/theme";
import { useAuth } from "@/contexts/auth";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaywallModal } from "@/components/paywall-modal";

const NAV_ITEMS = [
  { href: "/", icon: Search, label: "لوحة التحكم" },
  { href: "/history", icon: History, label: "السجلات" },
  { href: "/platforms", icon: Globe, label: "تغطية المنصات" },
];

const THEMES: { id: Theme; label: string; color: string }[] = [
  { id: "cyan", label: "سايان", color: "#00d2e6" },
  { id: "amber", label: "كهرماني", color: "#f5a623" },
  { id: "matrix", label: "ماتريكس", color: "#32c850" },
];

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toISOString().replace("T", " ").substring(0, 19));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toISOString().replace("T", " ").substring(0, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-primary font-mono text-xs">{time}</span>;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const searchesRemaining = user?.isSubscribed ? null : (user ? Math.max(0, 3 - user.searchCount) : 3);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen min-h-[100dvh] w-full bg-background text-foreground overflow-hidden" dir="rtl">
        <Sidebar side="right" className="border-l border-border bg-sidebar shrink-0">
          <SidebarHeader className="border-b border-border p-4">
            <div className="flex items-center gap-3 text-primary font-bold text-lg tracking-widest">
              <Terminal className="w-5 h-5 shrink-0" />
              <span className="text-glow font-mono">LYOSINT</span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1 font-mono tracking-widest">
              منصة الاستخبارات الليبية المفتوحة
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 pt-4 overflow-y-auto flex flex-col gap-0">
            {user && (
              <div className="px-3 mb-4">
                <div className="bg-secondary/30 rounded-lg p-3 border border-border/40 space-y-2">
                  <div className="flex items-center gap-2.5">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt="" className="w-8 h-8 rounded-full border border-border shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                        <UserIcon className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">
                        {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
                      </div>
                      {user.username && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate" dir="ltr">@{user.username}</div>
                      )}
                    </div>
                  </div>
                  {user.isSubscribed ? (
                    <Badge className="w-full justify-center bg-primary/15 text-primary border-primary/30 text-[10px] font-mono uppercase gap-1">
                      <Crown className="w-3 h-3" /> مشترك نشط
                    </Badge>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>باقي مجاني</span>
                        <span className={searchesRemaining === 0 ? "text-destructive font-bold" : "text-primary font-bold"}>
                          {searchesRemaining} / 3
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${searchesRemaining === 0 ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${Math.round((searchesRemaining ?? 0) / 3 * 100)}%` }}
                        />
                      </div>
                      {searchesRemaining === 0 && (
                        <Button
                          onClick={() => setPaywallOpen(true)}
                          size="sm"
                          className="w-full h-7 text-[10px] font-mono uppercase gap-1 bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground"
                        >
                          <Crown className="w-3 h-3" /> اشترك الآن
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <SidebarMenu className="space-y-1">
              {NAV_ITEMS.map(({ href, icon: Icon, label }, idx) => {
                const isActive = href === "/" ? location === "/" : location.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <Link href={href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "nav-active-indicator bg-primary/10 text-primary border border-primary/20"
                            : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary border border-transparent"
                        }`}
                        style={{ animationDelay: `${idx * 60}ms` }}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{label}</span>
                        {isActive && <span className="mr-auto w-1.5 h-1.5 rounded-full bg-primary glow-box" />}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            <div className="mt-6 px-3">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-mono mb-3">
                <Palette className="w-3 h-3" /> الثيم
              </div>
              <div className="flex flex-col gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded text-xs font-medium transition-all duration-200 ${
                      theme === t.id
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0 border border-white/10" style={{ backgroundColor: t.color, boxShadow: theme === t.id ? `0 0 6px ${t.color}` : "none" }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-3 space-y-2 shrink-0">
            <div className="text-[10px] text-muted-foreground uppercase flex items-center justify-between font-mono">
              <span className="text-primary flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                آمن
              </span>
              <span>الحالة:</span>
            </div>
            {user && (
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-destructive transition-colors font-mono rounded hover:bg-destructive/10 border border-transparent hover:border-destructive/20"
              >
                <LogOut className="w-3.5 h-3.5" /> تسجيل الخروج
              </button>
            )}
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen min-h-[100dvh] overflow-hidden min-w-0">
          <header className="h-13 sm:h-14 border-b border-border flex items-center px-3 sm:px-4 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0 gap-3">
            <SidebarTrigger className="ml-auto shrink-0" />
            <div className="flex items-center gap-2 bg-secondary/60 px-2.5 sm:px-3 py-1.5 rounded border border-border font-mono overflow-hidden">
              <span className="text-[10px] text-muted-foreground uppercase hidden sm:inline">التوقيت:</span>
              <LiveClock />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 scroll-smooth" dir="rtl">
            <div className="max-w-6xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </SidebarProvider>
  );
}
