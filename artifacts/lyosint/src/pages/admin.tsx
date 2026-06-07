import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";
import {
  Users, Crown, Search, BarChart3, RefreshCw, Trash2, CheckCircle2,
  XCircle, Shield, ChevronRight, ChevronLeft, Loader2, AlertTriangle, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdminUser {
  id: string; telegramId: string; firstName: string; lastName?: string | null;
  username?: string | null; searchCount: number; isSubscribed: boolean;
  subscriptionExpiry?: string | null; canSearch: boolean; searchesRemaining?: number | null;
}

interface AdminStats {
  totalUsers: number; totalSearches: number; subscribedUsers: number;
  recentUsers: AdminUser[];
}

function apiFetch(path: string, options: RequestInit, token: string) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers as Record<string, string> ?? {}) },
  }).then((r) => r.json());
}

export default function AdminPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

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
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [s, u] = await Promise.all([
        apiFetch("/api/admin/stats", {}, token),
        apiFetch(`/api/admin/users?page=${p}`, {}, token),
      ]);
      if (s.error) { setError(s.error); return; }
      setStats(s);
      setUsers(u.users ?? []);
      setTotal(u.total ?? 0);
      setPages(u.pages ?? 1);
      setPage(p);
    } catch {
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleAction = async (userId: string, action: string, label: string) => {
    if (!token) return;
    setActionLoading(`${userId}-${action}`);
    try {
      await apiFetch(`/api/admin/users/${userId}/${action}`, { method: action === "delete" ? "DELETE" : "POST", body: action === "subscribe" ? JSON.stringify({ months: 1 }) : undefined }, token);
      await fetchData(page);
    } catch {
      alert(`فشل: ${label}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.firstName.toLowerCase().includes(q) ||
      (u.lastName ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q) ||
      u.telegramId.includes(q);
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4" dir="rtl">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold text-destructive">{error}</h2>
        <p className="text-sm text-muted-foreground">تأكد من صلاحيات المسؤول</p>
        <Button variant="outline" onClick={() => fetchData(1)}>إعادة المحاولة</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-3 text-glow">
            <Shield className="w-7 h-7 shrink-0" />
            لوحة التحكم
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">إدارة المستخدمين والاشتراكات</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(page)} className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المستخدمين", value: stats?.totalUsers ?? "—", icon: Users, color: "text-primary" },
          { label: "المشتركون", value: stats?.subscribedUsers ?? "—", icon: Crown, color: "text-amber-400" },
          { label: "إجمالي عمليات البحث", value: stats?.totalSearches ?? "—", icon: Search, color: "text-green-400" },
          { label: "المجانيون", value: stats ? (stats.totalUsers - stats.subscribedUsers) : "—", icon: UserX, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card/60 border-border/40">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-2xl font-bold font-mono text-glow ${color}`}>{loading ? "..." : value}</p>
                </div>
                <Icon className={`w-5 h-5 mt-0.5 ${color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card className="border-border/40 bg-card/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              المستخدمون
              <Badge variant="secondary" className="font-mono ml-1">{total}</Badge>
            </CardTitle>
            <Input
              placeholder="بحث بالاسم أو المعرّف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 h-8 text-sm bg-background border-border/60"
              dir="auto"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">لا يوجد مستخدمون</div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredUsers.map((u) => {
                const subExpiry = u.subscriptionExpiry ? new Date(u.subscriptionExpiry) : null;
                const daysLeft = subExpiry ? Math.ceil((subExpiry.getTime() - Date.now()) / 86400000) : null;
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors flex-wrap sm:flex-nowrap">
                    {/* User Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                        {u.firstName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">
                          {u.firstName}{u.lastName ? ` ${u.lastName}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                          {u.username ? `@${u.username}` : `#${u.telegramId}`}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {u.isSubscribed ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1 font-mono">
                          <Crown className="w-3 h-3" />
                          {daysLeft !== null ? `${daysLeft}ي` : "مشترك"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] font-mono gap-1">
                          {u.searchCount}/3
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {u.isSubscribed ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 gap-1"
                          onClick={() => handleAction(u.id, "unsubscribe", "إلغاء الاشتراك")}
                          disabled={actionLoading === `${u.id}-unsubscribe`}
                        >
                          {actionLoading === `${u.id}-unsubscribe` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          إلغاء
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-primary hover:bg-primary/10 gap-1"
                          onClick={() => handleAction(u.id, "subscribe", "تفعيل الاشتراك")}
                          disabled={actionLoading === `${u.id}-subscribe`}
                        >
                          {actionLoading === `${u.id}-subscribe` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          فعّل
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-amber-500 hover:bg-amber-500/10 gap-1"
                        onClick={() => handleAction(u.id, "reset-quota", "إعادة تعيين الحصة")}
                        disabled={actionLoading === `${u.id}-reset-quota`}
                      >
                        {actionLoading === `${u.id}-reset-quota` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        <span className="hidden sm:inline">إعادة</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm("حذف المستخدم نهائياً؟")) handleAction(u.id, "delete", "حذف"); }}
                        disabled={actionLoading === `${u.id}-delete`}
                      >
                        {actionLoading === `${u.id}-delete` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t border-border/40">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchData(page - 1)} className="h-8 gap-1">
                <ChevronRight className="w-4 h-4" /> السابق
              </Button>
              <span className="text-xs font-mono text-muted-foreground">{page} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => fetchData(page + 1)} className="h-8 gap-1">
                التالي <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
