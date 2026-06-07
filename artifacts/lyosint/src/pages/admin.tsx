import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Users, Crown, Search, RefreshCw, Trash2, CheckCircle2,
  XCircle, Shield, ChevronRight, ChevronLeft, Loader2,
  LogOut, Lock, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const ADMIN_TOKEN_KEY = "lyosint_admin_token";

interface AdminUser {
  id: string; telegramId: string; firstName: string; lastName?: string | null;
  username?: string | null; searchCount: number; isSubscribed: boolean;
  subscriptionExpiry?: string | null;
}

interface AdminStats {
  totalUsers: number; totalSearches: number; subscribedUsers: number;
}

function apiFetch(path: string, options: RequestInit, token: string) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...(options.headers as Record<string, string> ?? {}),
    },
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? r.statusText);
    return data;
  });
}

/* ── Admin Login Gate ─────────────────────────────────────────── */
function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل تسجيل الدخول");
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground">أدخل بيانات الوصول للمتابعة</p>
        </div>

        <Card className="border-border/60 shadow-md">
          <CardContent className="pt-5 pb-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">اسم المستخدم</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="h-10 bg-background border-border/60"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">كلمة المرور</label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-10 bg-background border-border/60 pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2 text-center">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading || !username || !password} className="w-full h-10 font-bold gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                دخول
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground/40 font-mono">
          هذه الصفحة للمسؤولين فقط
        </p>
      </div>
    </div>
  );
}

/* ── Admin Dashboard ──────────────────────────────────────────── */
function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const [s, u] = await Promise.all([
        apiFetch("/api/admin/stats", {}, token),
        apiFetch(`/api/admin/users?page=${p}`, {}, token),
      ]);
      setStats(s);
      setUsers(u.users ?? []);
      setTotal(u.total ?? 0);
      setPages(u.pages ?? 1);
      setPage(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("جلسة منتهية") || msg.includes("غير مصرح")) {
        onLogout();
      } else {
        setError(msg || "فشل تحميل البيانات");
      }
    } finally {
      setLoading(false);
    }
  }, [token, onLogout]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleAction = async (userId: string, action: string) => {
    setActionLoading(`${userId}-${action}`);
    try {
      await apiFetch(
        `/api/admin/users/${userId}/${action}`,
        {
          method: action === "delete" ? "DELETE" : "POST",
          body: action === "subscribe" ? JSON.stringify({ months: 1 }) : undefined,
        },
        token
      );
      await fetchData(page);
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشلت العملية");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    try { await apiFetch("/api/admin/logout", { method: "POST" }, token); } catch {}
    onLogout();
  };

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.firstName.toLowerCase().includes(q) ||
      (u.lastName ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q) ||
      u.telegramId.includes(q);
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">لوحة التحكم</h1>
              <p className="text-xs text-muted-foreground">LYOSINT Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchData(page)} className="h-8 gap-1.5 text-xs border-border/60">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/8 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "المستخدمون", value: stats?.totalUsers, icon: Users },
            { label: "المشتركون", value: stats?.subscribedUsers, icon: Crown },
            { label: "عمليات البحث", value: stats?.totalSearches, icon: Search },
            { label: "المجانيون", value: stats && (stats.totalUsers - stats.subscribedUsers), icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1 uppercase font-medium">{label}</p>
                    <p className="text-2xl font-bold font-mono text-primary tabular-nums">
                      {loading ? <span className="text-muted-foreground">···</span> : (value ?? 0)}
                    </p>
                  </div>
                  <Icon className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users Table */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/40 pb-3 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold">المستخدمون</CardTitle>
                <Badge variant="secondary" className="font-mono text-[11px] h-5">{total}</Badge>
              </div>
              <Input
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 h-7 text-xs bg-background border-border/60"
                dir="auto"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">لا يوجد مستخدمون</div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredUsers.map((u) => {
                  const subExpiry = u.subscriptionExpiry ? new Date(u.subscriptionExpiry) : null;
                  const daysLeft = subExpiry ? Math.ceil((subExpiry.getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {u.firstName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {u.firstName}{u.lastName ? ` ${u.lastName}` : ""}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">
                          {u.username ? `@${u.username}` : `id:${u.telegramId}`}
                        </div>
                      </div>
                      <div className="shrink-0 hidden sm:flex items-center gap-2">
                        {u.isSubscribed ? (
                          <Badge className="bg-primary/8 text-primary border-primary/20 text-[10px] gap-1 font-mono">
                            <Crown className="w-2.5 h-2.5" />
                            {daysLeft !== null ? `${daysLeft}د` : "✓"}
                          </Badge>
                        ) : (
                          <span className="text-[11px] font-mono text-muted-foreground">{u.searchCount}/3</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {u.isSubscribed ? (
                          <Button size="sm" variant="ghost"
                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                            onClick={() => handleAction(u.id, "unsubscribe")}
                            disabled={!!actionLoading}>
                            {actionLoading === `${u.id}-unsubscribe` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost"
                            className="h-7 px-2 text-[11px] text-primary hover:bg-primary/8"
                            onClick={() => handleAction(u.id, "subscribe")}
                            disabled={!!actionLoading}>
                            {actionLoading === `${u.id}-subscribe` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost"
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-amber-500 hover:bg-amber-500/8"
                          onClick={() => handleAction(u.id, "reset-quota")}
                          disabled={!!actionLoading}
                          title="إعادة تعيين الحصة">
                          {actionLoading === `${u.id}-reset-quota` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                          onClick={() => { if (confirm("حذف هذا المستخدم نهائياً؟")) handleAction(u.id, "delete"); }}
                          disabled={!!actionLoading}>
                          {actionLoading === `${u.id}-delete` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 p-3 border-t border-border/30">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => fetchData(page - 1)} className="h-7 gap-1 text-xs">
                  <ChevronRight className="w-3.5 h-3.5" /> السابق
                </Button>
                <span className="text-xs font-mono text-muted-foreground">{page} / {pages}</span>
                <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => fetchData(page + 1)} className="h-7 gap-1 text-xs">
                  التالي <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Main Export ──────────────────────────────────────────────── */
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(ADMIN_TOKEN_KEY));

  const handleLogin = (t: string) => setToken(t);

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
  };

  if (!token) return <AdminLogin onLogin={handleLogin} />;
  return <AdminDashboard token={token} onLogout={handleLogout} />;
}
