import { useState, useEffect, useCallback } from "react";
import {
  Users, Crown, Search, RefreshCw, Trash2, CheckCircle2, XCircle,
  Shield, ChevronRight, ChevronLeft, Loader2, LogOut, Lock, Eye,
  EyeOff, Key, ExternalLink, Zap, AlertCircle, Settings2, Sliders,
  UserCog, Globe, ToggleLeft, ToggleRight, Save, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const ADMIN_TOKEN_KEY = "lyosint_admin_token";

type Tab = "users" | "services" | "system" | "credentials";

interface AdminUser {
  id: string; telegramId: string; firstName: string; lastName?: string | null;
  username?: string | null; searchCount: number; isSubscribed: boolean;
  subscriptionExpiry?: string | null;
}
interface AdminStats { totalUsers: number; totalSearches: number; subscribedUsers: number; }
interface ServiceConfig {
  key: string; name: string; category: string; description: string;
  url: string; scope: string; freeLimit: string;
  isConfigured: boolean; updatedAt: string | null;
}
interface SystemConfigItem {
  key: string; name: string; description: string;
  type: "number" | "text" | "boolean";
  value: string; defaultValue: string;
  min?: number; max?: number;
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

/* ── Admin Login Gate ─────────────────────────────────────────────────────── */
function AdminLogin({ onLogin }: { onLogin: (t: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
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
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground">أدخل بيانات الوصول للمتابعة</p>
        </div>
        <Card className="border-border/60 shadow-md">
          <CardContent className="pt-5 pb-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">اسم المستخدم</label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin" autoComplete="username"
                  className="h-10 bg-background border-border/60" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">كلمة المرور</label>
                <div className="relative">
                  <Input type={showPass ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password"
                    className="h-10 bg-background border-border/60 pl-10" dir="ltr" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
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
        <p className="text-center text-[10px] text-muted-foreground/40 font-mono">هذه الصفحة للمسؤولين فقط</p>
      </div>
    </div>
  );
}

/* ── Services / API Keys Tab ──────────────────────────────────────────────── */
function ServicesTab({ token }: { token: string }) {
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [showVal, setShowVal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ key: string; ok: boolean } | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/settings", {}, token);
      setServices(data.services ?? []);
    } catch { } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/settings/${key}`, { method: "PUT", body: JSON.stringify({ value: inputVal.trim() }) }, token);
      setSaveMsg({ key, ok: true });
      setTimeout(() => setSaveMsg(null), 2500);
      setEditing(null); setInputVal("");
      await fetchServices();
    } catch {
      setSaveMsg({ key, ok: false });
      setTimeout(() => setSaveMsg(null), 2500);
    } finally { setSaving(false); }
  };

  const handleDelete = async (key: string) => {
    if (!confirm("إزالة هذا المفتاح؟")) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/settings/${key}`, { method: "DELETE" }, token);
      await fetchServices();
    } catch { } finally { setSaving(false); }
  };

  const categoryColors: Record<string, string> = {
    developer:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
    email:        "text-purple-400 bg-purple-500/10 border-purple-500/20",
    breach:       "text-red-400 bg-red-500/10 border-red-500/20",
    network:      "text-orange-400 bg-orange-500/10 border-orange-500/20",
    phone:        "text-green-400 bg-green-500/10 border-green-500/20",
    threat:       "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    social:       "text-pink-400 bg-pink-500/10 border-pink-500/20",
  };
  const categoryLabels: Record<string, string> = {
    developer: "مطور", email: "بريد", breach: "اختراق",
    network: "شبكة", phone: "هاتف", threat: "تهديد", social: "تواصل",
  };

  const configured = services.filter((s) => s.isConfigured).length;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <p className="text-xs text-muted-foreground">المفاتيح مشفرة في قاعدة البيانات — لن تُعرض بعد الحفظ</p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {configured}/{services.length} مُفعَّل
        </Badge>
      </div>

      {services.map((svc) => {
        const isEditing = editing === svc.key;
        const msgForThis = saveMsg?.key === svc.key;
        return (
          <Card key={svc.key} className={`border-border/50 shadow-sm transition-all ${svc.isConfigured ? "border-primary/20" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">{svc.name}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 border ${categoryColors[svc.category] ?? "text-muted-foreground"}`}>
                      {categoryLabels[svc.category] ?? svc.category}
                    </Badge>
                    {svc.isConfigured ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-500 border border-green-500/20 gap-1">
                        <Zap className="w-2.5 h-2.5" /> مُفعَّل
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        غير مُهيَّأ
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{svc.description}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 font-mono flex-wrap">
                    <span>{svc.freeLimit}</span>
                    <a href={svc.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline">
                      احصل على المفتاح <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {svc.isConfigured && !isEditing && (
                    <Button size="sm" variant="ghost"
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                      onClick={() => handleDelete(svc.key)} disabled={saving}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="sm" variant={svc.isConfigured ? "outline" : "default"}
                    className={`h-7 px-3 text-[11px] gap-1.5 ${svc.isConfigured ? "border-border/60" : ""}`}
                    onClick={() => { setEditing(isEditing ? null : svc.key); setInputVal(""); setShowVal(false); }}>
                    <Key className="w-3 h-3" />
                    {isEditing ? "إلغاء" : svc.isConfigured ? "تغيير" : "تعيين"}
                  </Button>
                </div>
              </div>
              {isEditing && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                  <div className="relative">
                    <Input type={showVal ? "text" : "password"} value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder={`أدخل ${svc.name} API Key...`}
                      className="h-9 bg-background border-border/60 text-sm pl-10 font-mono" dir="ltr"
                      onKeyDown={(e) => { if (e.key === "Enter" && inputVal.trim()) handleSave(svc.key); }} />
                    <button type="button" onClick={() => setShowVal(!showVal)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleSave(svc.key)} disabled={!inputVal.trim() || saving}
                      className="h-7 px-3 text-[11px] gap-1.5">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      حفظ
                    </Button>
                    {msgForThis && (
                      <span className={`text-[11px] font-medium ${saveMsg?.ok ? "text-green-500" : "text-destructive"}`}>
                        {saveMsg?.ok ? "✓ تم الحفظ" : "✗ فشل الحفظ"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── System Config Tab ────────────────────────────────────────────────────── */
function SystemConfigTab({ token }: { token: string }) {
  const [config, setConfig] = useState<SystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, { ok: boolean; text: string }>>({});

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/system-config", {}, token);
      setConfig(data.config ?? []);
    } catch { } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const startEdit = (key: string, current: string) => {
    setEditing((prev) => ({ ...prev, [key]: current }));
  };
  const cancelEdit = (key: string) => {
    setEditing((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSave = async (item: SystemConfigItem) => {
    const val = editing[item.key] ?? item.value;
    setSaving(item.key);
    try {
      await apiFetch(`/api/admin/system-config/${item.key}`, {
        method: "PUT", body: JSON.stringify({ value: val }),
      }, token);
      setMsgs((p) => ({ ...p, [item.key]: { ok: true, text: "✓ تم الحفظ" } }));
      setTimeout(() => setMsgs((p) => { const n = { ...p }; delete n[item.key]; return n; }), 2500);
      cancelEdit(item.key);
      await fetchConfig();
    } catch {
      setMsgs((p) => ({ ...p, [item.key]: { ok: false, text: "✗ فشل الحفظ" } }));
      setTimeout(() => setMsgs((p) => { const n = { ...p }; delete n[item.key]; return n; }), 2500);
    } finally { setSaving(null); }
  };

  const handleReset = async (item: SystemConfigItem) => {
    if (!confirm(`إعادة تعيين "${item.name}" للقيمة الافتراضية (${item.defaultValue})؟`)) return;
    setSaving(item.key);
    try {
      await apiFetch(`/api/admin/system-config/${item.key}`, {
        method: "PUT", body: JSON.stringify({ value: item.defaultValue }),
      }, token);
      await fetchConfig();
    } catch { } finally { setSaving(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-primary/60" />
        <p className="text-xs text-muted-foreground">إعدادات النظام — تُطبَّق فوراً دون إعادة تشغيل</p>
      </div>

      {config.map((item) => {
        const isEditing = item.key in editing;
        const currentVal = editing[item.key] ?? item.value;
        const isChanged = currentVal !== item.value;
        const isBool = item.type === "boolean";
        const msg = msgs[item.key];

        return (
          <Card key={item.key} className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{item.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 bg-secondary px-1.5 py-0.5 rounded">
                      {item.key}
                    </span>
                    {item.value !== item.defaultValue && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-500 border-amber-500/30">مُعدَّل</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  <p className="text-[11px] text-muted-foreground/50 font-mono">افتراضي: {item.defaultValue}</p>
                </div>

                {isBool ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        const newVal = item.value === "true" ? "false" : "true";
                        setSaving(item.key);
                        try {
                          await apiFetch(`/api/admin/system-config/${item.key}`, {
                            method: "PUT", body: JSON.stringify({ value: newVal }),
                          }, token);
                          await fetchConfig();
                        } catch { } finally { setSaving(null); }
                      }}
                      disabled={saving === item.key}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      {saving === item.key ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : item.value === "true" ? (
                        <ToggleRight className="w-8 h-8 text-primary" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                      )}
                    </button>
                    <span className={`text-xs font-medium ${item.value === "true" ? "text-primary" : "text-muted-foreground"}`}>
                      {item.value === "true" ? "مفعَّل" : "معطَّل"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isEditing ? (
                      <>
                        <span className="text-sm font-mono text-primary font-bold min-w-[2rem] text-center">
                          {item.value}
                        </span>
                        <Button size="sm" variant="outline" className="h-7 px-2 border-border/60 text-[11px]"
                          onClick={() => startEdit(item.key, item.value)}>
                          <Sliders className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type={item.type === "number" ? "number" : "text"}
                          value={currentVal}
                          onChange={(e) => setEditing((p) => ({ ...p, [item.key]: e.target.value }))}
                          className="h-7 w-20 text-xs font-mono bg-background border-border/60 text-center"
                          min={item.min} max={item.max} dir="ltr"
                          onKeyDown={(e) => { if (e.key === "Enter") handleSave(item); if (e.key === "Escape") cancelEdit(item.key); }}
                        />
                        <Button size="sm" onClick={() => handleSave(item)} disabled={saving === item.key}
                          className="h-7 px-2 text-[11px] gap-1">
                          {saving === item.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelEdit(item.key)}
                          className="h-7 px-2 text-[11px]">
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg && (
                <p className={`text-[11px] font-medium mt-1.5 ${msg.ok ? "text-green-500" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              {!isBool && item.value !== item.defaultValue && !isEditing && (
                <button onClick={() => handleReset(item)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mt-1.5 transition-colors">
                  <RotateCcw className="w-2.5 h-2.5" /> إعادة تعيين للافتراضي
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Change Credentials Tab ────────────────────────────────────────────────── */
function CredentialsTab({ token, onSessionExpired }: { token: string; onSessionExpired: () => void }) {
  const [form, setForm] = useState({ currentPassword: "", newUsername: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    if (!form.currentPassword) return "أدخل كلمة المرور الحالية";
    if (form.newUsername && form.newUsername.trim().length < 3) return "اسم المستخدم يجب أن يكون 3 أحرف على الأقل";
    if (form.newPassword && form.newPassword.length < 6) return "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل";
    if (form.newPassword && form.newPassword !== form.confirmPassword) return "كلمة المرور الجديدة غير متطابقة";
    if (!form.newUsername && !form.newPassword) return "أدخل اسم مستخدم جديد أو كلمة مرور جديدة";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setMsg({ ok: false, text: err }); return; }
    setLoading(true); setMsg(null);
    try {
      await apiFetch("/api/admin/change-credentials", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          ...(form.newUsername ? { newUsername: form.newUsername.trim() } : {}),
          ...(form.newPassword ? { newPassword: form.newPassword } : {}),
        }),
      }, token);
      setMsg({ ok: true, text: "✓ تم تحديث بيانات الاعتماد — يُرجى تسجيل الدخول مرة أخرى إذا غيرت كلمة المرور" });
      setForm({ currentPassword: "", newUsername: "", newPassword: "", confirmPassword: "" });
      if (form.newPassword) {
        setTimeout(() => onSessionExpired(), 2000);
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "فشل التحديث" });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <UserCog className="w-4 h-4 text-primary/60" />
        <p className="text-xs text-muted-foreground">تغيير بيانات دخول لوحة التحكم — تُطبَّق فوراً</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">كلمة المرور الحالية <span className="text-destructive">*</span></label>
              <div className="relative">
                <Input type={show.current ? "text" : "password"} value={form.currentPassword}
                  onChange={(e) => update("currentPassword", e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="h-9 bg-background border-border/60 pl-10 text-sm" dir="ltr" />
                <button type="button" onClick={() => setShow((p) => ({ ...p, current: !p.current }))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {show.current ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="h-px bg-border/40" />

            {/* New Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">اسم المستخدم الجديد (اختياري)</label>
              <Input value={form.newUsername} onChange={(e) => update("newUsername", e.target.value)}
                placeholder="admin" autoComplete="username"
                className="h-9 bg-background border-border/60 text-sm" dir="ltr" />
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">كلمة المرور الجديدة (اختياري)</label>
              <div className="relative">
                <Input type={show.new ? "text" : "password"} value={form.newPassword}
                  onChange={(e) => update("newPassword", e.target.value)}
                  placeholder="••••••••" autoComplete="new-password"
                  className="h-9 bg-background border-border/60 pl-10 text-sm" dir="ltr" />
                <button type="button" onClick={() => setShow((p) => ({ ...p, new: !p.new }))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {show.new ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            {form.newPassword && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <Input type={show.confirm ? "text" : "password"} value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    placeholder="••••••••" autoComplete="new-password"
                    className="h-9 bg-background border-border/60 pl-10 text-sm" dir="ltr" />
                  <button type="button" onClick={() => setShow((p) => ({ ...p, confirm: !p.confirm }))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {show.confirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {form.newPassword && form.confirmPassword && form.newPassword !== form.confirmPassword && (
                  <p className="text-[11px] text-destructive">كلمتا المرور غير متطابقتين</p>
                )}
              </div>
            )}

            {msg && (
              <div className={`text-xs rounded-lg px-3 py-2.5 border text-center ${msg.ok ? "text-green-600 bg-green-500/8 border-green-500/20" : "text-destructive bg-destructive/8 border-destructive/20"}`}>
                {msg.text}
              </div>
            )}

            <Button type="submit" disabled={loading || !form.currentPassword} className="w-full h-9 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ التغييرات
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-amber-600">تنبيهات مهمة:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>تغيير كلمة المرور يلغي جميع الجلسات النشطة</li>
                <li>البيانات محفوظة في قاعدة البيانات وتتجاوز المتغيرات البيئية</li>
                <li>احتفظ بكلمة المرور في مكان آمن</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Users Tab ────────────────────────────────────────────────────────────── */
function UsersTab({ token, onSessionExpired }: { token: string; onSessionExpired: () => void }) {
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
    setLoading(true); setError(null);
    try {
      const [s, u] = await Promise.all([
        apiFetch("/api/admin/stats", {}, token),
        apiFetch(`/api/admin/users?page=${p}`, {}, token),
      ]);
      setStats(s); setUsers(u.users ?? []);
      setTotal(u.total ?? 0); setPages(u.pages ?? 1); setPage(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("جلسة منتهية") || msg.includes("غير مصرح")) onSessionExpired();
      else setError(msg || "فشل تحميل البيانات");
    } finally { setLoading(false); }
  }, [token, onSessionExpired]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleAction = async (userId: string, action: string) => {
    setActionLoading(`${userId}-${action}`);
    try {
      await apiFetch(
        `/api/admin/users/${userId}/${action}`,
        { method: action === "delete" ? "DELETE" : "POST", body: action === "subscribe" ? JSON.stringify({ months: 1 }) : undefined },
        token,
      );
      await fetchData(page);
    } catch (err) { alert(err instanceof Error ? err.message : "فشلت العملية"); }
    finally { setActionLoading(null); }
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.firstName.toLowerCase().includes(q) || (u.lastName ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q) || u.telegramId.includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "المستخدمون",   value: stats?.totalUsers,                               icon: Users },
          { label: "المشتركون",    value: stats?.subscribedUsers,                          icon: Crown },
          { label: "عمليات البحث", value: stats?.totalSearches,                            icon: Search },
          { label: "المجانيون",    value: stats && (stats.totalUsers - stats.subscribedUsers), icon: Users },
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

      {error && <div className="bg-destructive/8 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive text-center">{error}</div>}

      {/* Users Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/40 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">المستخدمون</CardTitle>
              <Badge variant="secondary" className="font-mono text-[11px] h-5">{total}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-40 h-7 text-xs bg-background border-border/60" dir="auto" />
              <Button variant="outline" size="sm" onClick={() => fetchData(page)} className="h-7 gap-1.5 text-xs border-border/60 shrink-0">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">لا يوجد مستخدمون</div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((u) => {
                const subExpiry = u.subscriptionExpiry ? new Date(u.subscriptionExpiry) : null;
                const daysLeft = subExpiry ? Math.ceil((subExpiry.getTime() - Date.now()) / 86400000) : null;
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {u.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.firstName}{u.lastName ? ` ${u.lastName}` : ""}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">
                        {u.username ? `@${u.username}` : `id:${u.telegramId}`}
                      </div>
                    </div>
                    <div className="shrink-0 hidden sm:flex items-center gap-2">
                      {u.isSubscribed ? (
                        <Badge className="bg-primary/8 text-primary border-primary/20 text-[10px] gap-1 font-mono">
                          <Crown className="w-2.5 h-2.5" />{daysLeft !== null ? `${daysLeft}د` : "✓"}
                        </Badge>
                      ) : (
                        <span className="text-[11px] font-mono text-muted-foreground">{u.searchCount}/بحث</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.isSubscribed ? (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                          onClick={() => handleAction(u.id, "unsubscribe")} disabled={!!actionLoading}>
                          {actionLoading === `${u.id}-unsubscribe` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-primary hover:bg-primary/8"
                          onClick={() => handleAction(u.id, "subscribe")} disabled={!!actionLoading}>
                          {actionLoading === `${u.id}-subscribe` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-amber-500 hover:bg-amber-500/8"
                        onClick={() => handleAction(u.id, "reset-quota")} disabled={!!actionLoading} title="إعادة تعيين الحصة">
                        {actionLoading === `${u.id}-reset-quota` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                        onClick={() => { if (confirm("حذف هذا المستخدم نهائياً؟")) handleAction(u.id, "delete"); }} disabled={!!actionLoading}>
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
  );
}

/* ── Admin Dashboard ─────────────────────────────────────────────────────── */
function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("users");

  const handleLogout = async () => {
    try { await apiFetch("/api/admin/logout", { method: "POST" }, token); } catch {}
    onLogout();
  };

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "users",       label: "المستخدمون",     icon: Users },
    { id: "services",    label: "API Keys & OSINT", icon: Settings2 },
    { id: "system",      label: "إعدادات النظام",  icon: Sliders },
    { id: "credentials", label: "بيانات الدخول",   icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">لوحة التحكم</h1>
              <p className="text-[11px] text-muted-foreground font-mono">LYOSINT Admin</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}
            className="h-8 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <LogOut className="w-3.5 h-3.5" /> خروج
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-lg border border-border/40 flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-all ${
                tab === id
                  ? "bg-background shadow-sm text-foreground border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "users" && <UsersTab token={token} onSessionExpired={handleLogout} />}
        {tab === "services" && <ServicesTab token={token} />}
        {tab === "system" && <SystemConfigTab token={token} />}
        {tab === "credentials" && <CredentialsTab token={token} onSessionExpired={handleLogout} />}
      </div>
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */
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
