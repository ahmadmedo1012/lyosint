import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, Lock, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  const { user, token, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await fetch(`${BASE}/api/auth/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      await refreshUser();
      setDone(true);
      setTimeout(() => { setDone(false); onClose(); }, 1800);
    } catch {
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
    "دعم فني متخصص",
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-primary/20 border-glow p-0 overflow-hidden" dir="rtl">
        <div className="bg-gradient-to-b from-primary/10 to-transparent p-6 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-mono uppercase tracking-wider text-glow">
              <Lock className="w-5 h-5" />
              انتهت عمليات البحث المجانية
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            لقد استخدمت الـ <span className="text-primary font-bold">3 عمليات</span> المجانية. اشترك للاستمرار.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-center space-y-1 border-glow">
            <div className="text-4xl font-bold text-primary font-mono text-glow">30</div>
            <div className="text-lg text-foreground font-bold">دينار ليبي</div>
            <div className="text-xs text-muted-foreground font-mono uppercase">/ شهر · وصول كامل</div>
          </div>

          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-foreground/90">{f}</span>
              </li>
            ))}
          </ul>

          {done ? (
            <div className="flex items-center justify-center gap-2 py-3 text-green-500 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              تم تفعيل الاشتراك بنجاح!
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full h-12 font-bold text-base gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                اشترك الآن — 30 دينار / شهر
              </Button>

              <div className="bg-secondary/30 rounded-lg p-3 border border-border/40">
                <p className="text-xs text-muted-foreground text-center font-mono flex items-center justify-center gap-1.5">
                  <Send className="w-3 h-3 text-primary" />
                  للدفع: أرسل 30 دينار عبر التحويل ثم تواصل معنا على تيليقرام
                  {user?.username && (
                    <span className="text-primary font-bold"> @lyosint_support</span>
                  )}
                </p>
              </div>

              <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                ليس الآن
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
