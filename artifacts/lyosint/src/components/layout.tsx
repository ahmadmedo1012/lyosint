import { Link, useLocation } from "wouter";
import { 
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider, SidebarTrigger, SidebarFooter
} from "@/components/ui/sidebar";
import { Terminal, Search, Globe, History } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground font-mono">
        <Sidebar className="border-r border-border bg-sidebar">
          <SidebarHeader className="border-b border-border p-4">
            <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-wider uppercase">
              <Terminal className="w-5 h-5" />
              <span>LYOSINT</span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">
              Libya Open Source Intelligence
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu className="mt-4 px-2">
              <SidebarMenuItem>
                <Link href="/">
                  <SidebarMenuButton isActive={location === "/"} data-testid="nav-dashboard">
                    <Search className="w-4 h-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/history">
                  <SidebarMenuButton isActive={location === "/history"} data-testid="nav-history">
                    <History className="w-4 h-4" />
                    <span>History</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/platforms">
                  <SidebarMenuButton isActive={location === "/platforms"} data-testid="nav-platforms">
                    <Globe className="w-4 h-4" />
                    <span>Platform Coverage</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-4">
            <div className="text-[10px] text-muted-foreground uppercase flex items-center justify-between">
              <span>STATUS:</span>
              <span className="text-primary flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                SECURE
              </span>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-14 border-b border-border flex items-center px-4 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1 flex justify-end">
               <div className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded border border-border font-mono flex items-center gap-2">
                 <span>SYS.TIME:</span>
                 <span className="text-primary">{new Date().toISOString().replace('T', ' ').substring(0, 19)}</span>
               </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 scroll-smooth">
            <div className="max-w-6xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
