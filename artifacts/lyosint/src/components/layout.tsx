import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, LayoutDashboard, SearchCheck, Network, FileText,
  Globe, Clock, User, Settings, Shield, Menu, Sun, Moon,
  Monitor, X,
} from "lucide-react";
import { useTheme } from "@/contexts/theme";
import { useAuth } from "@/contexts/auth";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/investigations", icon: SearchCheck, label: "Investigations" },
  { href: "/graph", icon: Network, label: "Knowledge Graph" },
  { href: "/dossiers", icon: FileText, label: "Dossiers" },
  { href: "/platforms", icon: Globe, label: "Platforms" },
  { href: "/history", icon: Clock, label: "History" },
  { href: "/account", icon: User, label: "Account" },
  { href: "/admin", icon: Shield, label: "Admin" },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/investigations": "Investigations",
  "/graph": "Knowledge Graph",
  "/dossiers": "Dossiers",
  "/platforms": "Platforms",
  "/history": "History",
  "/account": "Account",
  "/admin": "Admin",
  "/entities": "Entities",
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/search/")) return "Search Results";
  if (pathname.startsWith("/entity/")) return "Entity Detail";
  if (pathname.startsWith("/investigation/")) return "Investigation Detail";
  if (pathname.startsWith("/dossier/")) return "Dossier";
  if (pathname.startsWith("/settings")) return "Settings";
  return PAGE_TITLES[pathname] || "Lyosint";
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      onClick={cycle}
      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all duration-150 ${
        collapsed ? "justify-center px-0" : ""
      }`}
      title={collapsed ? label : undefined}
    >
      <Icon className="w-4 h-4 shrink-0 transition-transform duration-300" />
      {!collapsed && <span className="flex-1">{label}</span>}
    </button>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const isRtl = document.documentElement.dir === "rtl";

  const pageTitle = getPageTitle(location);

  const isActivePath = (href: string) => {
    if (href === "/") return location === "/";
    if (href === "/search") return location.startsWith("/search");
    return location.startsWith(href);
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const sidebarWidth = collapsed ? 56 : 240;

  const sidebarContent = (
    <>
      <div className="flex items-center h-12 px-3 border-b border-sidebar-border shrink-0">
        <button
          onClick={() => (isMobile ? setMobileOpen(false) : setCollapsed(!collapsed))}
          className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          {isMobile && mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        {!collapsed && (
          <Link href="/" className={`${isRtl ? "mr-2" : "ml-2"} font-semibold text-sm text-sidebar-foreground tracking-tight`}>
            Lyosint
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActivePath(href);
          return (
            <Link key={href} href={href}>
              <div
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer select-none ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
              </div>
            </Link>
          );
        })}

        <div
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-sidebar-foreground/40 cursor-not-allowed ${
            collapsed ? "justify-center px-0" : ""
          }`}
          title={collapsed ? "Settings (coming soon)" : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="flex-1">Settings</span>}
        </div>
      </nav>

      <div className="border-t border-sidebar-border px-2 py-3 shrink-0 space-y-1">
        <ThemeToggle collapsed={collapsed} />
        {user && (
          <div className={`flex items-center gap-2.5 px-2.5 py-2 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
              {user.firstName[0]}
            </div>
            {!collapsed && (
              <span className="text-xs text-sidebar-foreground truncate">
                {user.firstName}
                {user.lastName ? ` ${user.lastName}` : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="lyosint-app min-h-screen bg-background text-foreground">
      {!isMobile && (
        <aside
          className={`fixed top-0 bottom-0 z-30 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 left-0`}
          style={{ width: sidebarWidth }}
        >
          {sidebarContent}
        </aside>
      )}

      {isMobile && (
        <>
          {mobileOpen && (
            <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setMobileOpen(false)} />
          )}
          <aside
            className={`fixed top-0 bottom-0 z-40 w-[240px] flex flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 left-0 ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {sidebarContent}
          </aside>
        </>
      )}

      {isMobile && !mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-20 p-2 rounded-md bg-background border border-border shadow-sm text-foreground hover:bg-accent/10 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      <div
        className="lyosint-main transition-all duration-300"
        style={!isMobile ? { marginLeft: sidebarWidth } : undefined}
      >
        <header className="h-12 border-b border-border/40 flex items-center px-4 sm:px-6 shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1 -ml-1 mr-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-sm font-medium text-foreground">{pageTitle}</h1>
        </header>

        <div className="lyosint-content max-w-[900px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
