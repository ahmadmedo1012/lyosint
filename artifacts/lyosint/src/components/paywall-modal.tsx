import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Lock, Send, Loader2, Crown } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { SUBSCRIPTION_PRICE, SUBSCRIPTION_PRICE_LABEL, SUPPORT_EMAIL } from "@/lib/constants";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  const { token, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) { setError("فشلت عملية الاشتراك — حاول مرة أخرى"); setLoading(false); return; }
      await refreshUser();
      setDone(true);
      setTimeout(() => { setDone(false); onClose(); }, 1800);
    } catch (err) {
      setError("حدث خطأ في الاتصال — تحقق من اتصالك بالإنترنت");
      console.error("subscribe failed", err);
    } finally {
      setLoading(false);
    }
  };

  const FEATURES = [
    "بحث غير محدود عبر 40+ منصة",
    "البصمة الرقمية الكاملة",
    "بحث شامل متقاطع",
    "تقارير الاستخبارات المفصّلة",
    "أولوية المعالجة",
    "دعم فني مخصص",
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border/60 shadow-xl p-0 overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="p-5 border-b border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-base">
              <Lock className="w-4 h-4 text-primary shrink-0" />
              الخطة المجانية اكتملت
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1.5">
            اشترك للاستمرار في البحث الاستخباراتي بلا حدود.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Price */}
          <div className="bg-primary/6 border border-primary/15 rounded-lg p-4 text-center space-y-0.5">
            <div className="flex items-end justify-center gap-1">
              <span className="text-4xl font-bold text-primary font-mono">{SUBSCRIPTION_PRICE}</span>
              <span className="text-sm text-muted-foreground mb-1.5 font-medium">دينار ليبي</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono uppercase">لكل شهر · وصول كامل</div>
          </div>

          {/* Features */}
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/85">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {done ? (
            <div className="flex items-center justify-center gap-2 py-2.5 text-green-500 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              تم تفعيل الاشتراك بنجاح
            </div>
          ) : (
            <div className="space-y-2.5">
              {error && (
                <div className="text-destructive text-xs text-center bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                  {error}
                </div>
              )}
              <Button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full h-11 font-bold gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                اشترك الآن — {SUBSCRIPTION_PRICE} دينار / شهر
              </Button>

              <div className="bg-secondary/30 rounded-lg px-3 py-2.5 border border-border/40 text-center">
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 flex-wrap">
                  <Send className="w-3 h-3 text-primary shrink-0" />
                  للدفع: حوّل {SUBSCRIPTION_PRICE} دينار ثم راسلنا على تيليقرام
                  <a href="https://t.me/lyosint_support" target="_blank" rel="noopener noreferrer"
                    className="text-primary font-bold hover:underline" dir="ltr">
                    @lyosint_support
                  </a>
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                ليس الآن
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
