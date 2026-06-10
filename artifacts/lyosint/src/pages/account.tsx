import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";
import { PaywallModal } from "@/components/paywall-modal";
import {
  User, Crown, Shield, Phone, AtSign, Calendar, Search,
  LogOut, Send, CheckCircle2, Clock, Zap, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SUBSCRIPTION_PRICE_LABEL } from "@/lib/constants";

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        <Icon className="w-4 h-4 text-primary/60" />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground font-mono" dir="ltr">{value}</span>
    </div>
  );
}

export default function AccountPage() {
  const { user, token, logout, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  if (!user) return (
    <div className="space-y-6 page-transition" dir="rtl">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const isSubscribed = user.isSubscribed;
  const searchesRemaining = isSubscribed ? null : Math.max(0, 3 - user.searchCount);
  const subExpiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
  const daysLeft = subExpiry ? Math.ceil((subExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const handleLogout = async () => {
    setLoading("logout");
    await logout();
    setLocation("/");
  };

  const handleSubscribeClick = () => setPaywallOpen(true);

  return (
    <div className="space-y-6 page-transition" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-3 text-glow">
            <User className="w-7 h-7 shrink-0" />
            حساب المستخدم
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">إدارة ملفك الشخصي والاشتراك</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-primary/20 bg-card/60">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                الملف الشخصي
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4 mb-6 pb-5 border-b border-border/40">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt="" className="w-16 h-16 rounded-full border-2 border-primary/30 shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0">
                    <User className="w-8 h-8 text-primary/60" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground">
                    {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
                  </h2>
                  {user.username && (
                    <p className="text-sm text-muted-foreground font-mono" dir="ltr">@{user.username}</p>
                  )}
                  <div className="mt-2">
                    {isSubscribed ? (
                      <Badge className="bg-primary/15 text-primary border-primary/30 gap-1.5 font-medium">
                        <Crown className="w-3 h-3" /> مشترك نشط
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1.5">
                        <User className="w-3 h-3" /> حساب مجاني
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-0.5">
                <InfoRow icon={AtSign} label="اسم المستخدم في تيليقرام" value={user.username ? `@${user.username}` : "—"} />
                <InfoRow icon={Phone} label="رقم التعريف" value={user.telegramId} />
                <InfoRow icon={Search} label="إجمالي عمليات البحث" value={String(user.searchCount)} />
              </div>
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card className={`border-2 ${isSubscribed ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/60"}`}>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Crown className={`w-4 h-4 ${isSubscribed ? "text-primary" : "text-muted-foreground"}`} />
                الاشتراك
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {isSubscribed ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-bold">اشتراك نشط</span>
                    </div>
                    {daysLeft !== null && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 font-mono gap-1">
                        <Clock className="w-3 h-3" />
                        {daysLeft} يوم متبقي
                      </Badge>
                    )}
                  </div>
                  {subExpiry && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>ينتهي في: </span>
                      <span className="font-mono text-foreground">
                        {subExpiry.toLocaleDateString("ar-LY", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                  )}
                  <div className="bg-primary/8 rounded-lg p-3 border border-primary/15 text-sm text-foreground/80">
                    للتجديد أو الاستفسار تواصل معنا عبر تيليقرام على
                    <a href="https://t.me/lyosint_support" target="_blank" rel="noopener noreferrer"
                       className="text-primary font-bold mr-1 hover:underline" dir="ltr">@lyosint_support</a>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">أنت على الخطة المجانية</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">عمليات البحث المستخدمة</span>
                      <span className={`font-mono font-bold ${searchesRemaining === 0 ? "text-destructive" : "text-primary"}`}>
                        {user.searchCount} / 3
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${searchesRemaining === 0 ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, (user.searchCount / 3) * 100)}%` }}
                      />
                    </div>
                    {searchesRemaining === 0 && (
                      <p className="text-xs text-destructive">
                        لقد استنفدت عمليات البحث المجانية. اشترك للاستمرار.
                      </p>
                    )}
                  </div>

                  <Button onClick={handleSubscribeClick} className="w-full h-11 font-bold gap-2">
                    <Zap className="w-4 h-4" />
                    الاشتراك — {SUBSCRIPTION_PRICE_LABEL}
                  </Button>

                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    {["بحث غير محدود", "40+ منصة", "تقارير مفصّلة", "دعم متخصص"].map((f) => (
                      <div key={f} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Actions */}
        <div className="space-y-4">
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">إجراءات سريعة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Button variant="outline" className="w-full justify-start gap-2.5 h-10 text-sm border-border/60"
                onClick={() => setLocation("/")}>
                <Search className="w-4 h-4 text-primary" />
                بدء بحث جديد
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2.5 h-10 text-sm border-border/60"
                onClick={() => setLocation("/history")}>
                <Clock className="w-4 h-4 text-primary" />
                عرض السجل
              </Button>
              <a href="https://t.me/lyosint_support" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full justify-start gap-2.5 h-10 text-sm border-border/60">
                  <Send className="w-4 h-4 text-primary" />
                  تواصل مع الدعم
                </Button>
              </a>
              <div className="pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  disabled={loading === "logout"}
                  className="w-full justify-start gap-2.5 h-10 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border/40">
            <CardContent className="pt-4 space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">إحصائياتك</h3>
              {[
                { label: "عمليات البحث الكلية", value: user.searchCount, color: "text-primary" },
                { label: "حالة الحساب", value: isSubscribed ? "مشترك" : "مجاني", color: isSubscribed ? "text-green-500" : "text-muted-foreground" },
                { label: "بحث متاح", value: isSubscribed ? "∞" : `${searchesRemaining} متبقي`, color: searchesRemaining === 0 && !isSubscribed ? "text-destructive" : "text-foreground" },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                  <span className={`text-sm font-bold font-mono ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => { setPaywallOpen(false); refreshUser(); }} />
    </div>
  );
}
