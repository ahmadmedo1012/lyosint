import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import SearchResultPage from "@/pages/search-result";
import PlatformsPage from "@/pages/platforms";
import HistoryPage from "@/pages/history";
import AccountPage from "@/pages/account";
import AdminPage from "@/pages/admin";
import { ThemeProvider } from "@/contexts/theme";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { LoginPage } from "@/components/telegram-login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AuthGate() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  // Admin panel is completely independent — no user auth needed
  if (location === "/admin" || location.startsWith("/admin/")) {
    return <AdminPage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-8 w-8">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
            <span className="relative inline-flex rounded-full h-8 w-8 bg-primary/20 border border-primary/50 items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            </span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">جاري التحقق من الهوية…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSuccess={() => setLocation("/")} />;
  }

  return (
    <AppLayout>
      <ErrorBoundary key={location}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/search/:id" component={SearchResultPage} />
          <Route path="/platforms" component={PlatformsPage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/account" component={AccountPage} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthGate />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
