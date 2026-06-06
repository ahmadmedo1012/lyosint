import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider, SidebarTrigger, SidebarFooter,
} from "@/components/ui/sidebar";
import { Terminal, Search, Globe, History, Palette } from "lucide-react";
import { useTheme, type Theme } from "@/contexts/theme";
import { useEffect, useState } from "react";

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground" dir="rtl">
        <Sidebar side="right" className="border-l border-border bg-sidebar">
          <SidebarHeader className="border-b border-border p-5">
            <div className="flex items-center gap-3 text-primary font-bold text-xl tracking-widest">
              <Terminal className="w-5 h-5 shrink-0" />
              <span className="text-glow font-mono">LYOSINT</span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1 font-mono tracking-widest">
              منصة الاستخبارات الليبية المفتوحة
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 pt-4">
            <SidebarMenu className="space-y-1">
              {NAV_ITEMS.map(({ href, icon: Icon, label }, idx) => {
                const isActive = href === "/" ? location === "/" : location.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <Link href={href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        data-testid={`nav-${href.replace("/", "") || "dashboard"}`}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium
                          transition-all duration-200 cursor-pointer
                          ${isActive
                            ? "nav-active-indicator bg-primary/10 text-primary border border-primary/20"
                            : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary border border-transparent"
                          }
                        `}
                        style={{ animationDelay: `${idx * 60}ms` }}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{label}</span>
                        {isActive && (
                          <span className="mr-auto w-1.5 h-1.5 rounded-full bg-primary glow-box" />
                        )}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            <div className="mt-8 px-3">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-mono mb-3">
                <Palette className="w-3 h-3" />
                الثيم
              </div>
              <div className="flex flex-col gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    data-testid={`theme-${t.id}`}
                    className={`
                      flex items-center gap-3 w-full px-3 py-2 rounded text-xs font-medium
                      transition-all duration-200
                      ${theme === t.id
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                      }
                    `}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/10"
                      style={{ backgroundColor: t.color, boxShadow: theme === t.id ? `0 0 6px ${t.color}` : "none" }}
                    />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-4 space-y-2">
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
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0 gap-4">
            <SidebarTrigger className="ml-auto" />
            <div className="flex items-center gap-2 bg-secondary/60 px-3 py-1.5 rounded border border-border font-mono">
              <span className="text-[10px] text-muted-foreground uppercase">التوقيت:</span>
              <LiveClock />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6 scroll-smooth" dir="rtl">
            <div className="max-w-6xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
