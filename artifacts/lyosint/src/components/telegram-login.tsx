import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth";
import { Terminal, ShieldAlert, Send, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    TelegramLoginCallback?: (data: Record<string, string>) => void;
  }
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "lyosintbot";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function generateLoginToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type LoginState = "idle" | "waiting" | "success" | "error";

export function TelegramLoginButton({ onSuccess }: { onSuccess?: () => void }) {
  const { login, refreshUser } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loginToken] = useState(() => generateLoginToken());
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const botLoginUrl = `https://t.me/${BOT_USERNAME}?start=login_${loginToken}`;

  useEffect(() => {
    window.TelegramLoginCallback = async (data: Record<string, string>) => {
      try {
        await login(data);
        setLoginState("success");
        onSuccess?.();
      } catch {
        // fallback to bot method
      }
    };
    return () => { delete window.TelegramLoginCallback; };
  }, [login, onSuccess]);

  const startPolling = useCallback(() => {
    setLoginState("waiting");
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/bot-poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginToken }),
        });
        const data = await res.json();
        if (data.ready) {
          clearInterval(pollRef.current!);
          localStorage.setItem("lyosint_session", data.sessionToken);
          setLoginState("success");
          await refreshUser();
          onSuccess?.();
        }
      } catch {
        // keep polling
      }
    }, 2000);

    setTimeout(() => {
      if (pollRef.current) { clearInterval(pollRef.current); setLoginState("idle"); }
    }, 5 * 60 * 1000);
  }, [loginToken, refreshUser, onSuccess]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleOpenBot = () => {
    window.open(botLoginUrl, "_blank");
    startPolling();
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div ref={containerRef} className="opacity-0 h-0 overflow-hidden" />

      {loginState === "idle" && (
        <div className="space-y-3">
          <Button onClick={handleOpenBot} className="w-full h-11 font-bold gap-2.5 text-[15px]">
            <Send className="w-4 h-4" />
            تسجيل الدخول عبر تيليقرام
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            سيفتح تيليقرام تلقائياً — اضغط Start ثم عُد هنا
          </p>
        </div>
      )}

      {loginState === "waiting" && (
        <div className="space-y-3">
          <div className="bg-secondary/30 border border-border/50 rounded-lg p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-foreground font-medium text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              في انتظار التأكيد…
            </div>
            <p className="text-xs text-muted-foreground">
              افتح تيليقرام واضغط <span className="font-bold text-foreground">Start</span> ثم ارجع هنا
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenBot} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
              <Send className="w-3.5 h-3.5" /> افتح تيليقرام مجدداً
            </Button>
            <Button
              onClick={() => { clearInterval(pollRef.current!); setLoginState("idle"); }}
              variant="ghost" size="sm" className="text-xs text-muted-foreground"
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {loginState === "success" && (
        <div className="flex items-center justify-center gap-2 py-3 text-green-500 font-bold">
          <CheckCircle2 className="w-5 h-5" />
          تم تسجيل الدخول بنجاح
        </div>
      )}

      {loginState === "error" && (
        <div className="space-y-2">
          <div className="text-destructive text-xs text-center bg-destructive/8 rounded-lg py-2 border border-destructive/20">
            حدث خطأ — حاول مرة أخرى
          </div>
          <Button onClick={() => setLoginState("idle")} variant="outline" size="sm" className="w-full gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
          </Button>
        </div>
      )}
    </div>
  );
}

export function LoginPage({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-10 relative overflow-hidden" dir="rtl">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/8 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-[420px] space-y-6">

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="relative w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
              <Terminal className="w-7 h-7 text-primary" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black font-mono tracking-[0.2em] text-primary uppercase text-glow">LYOSINT</h1>
            <p className="text-sm text-muted-foreground mt-1.5">منصة الاستخبارات الليبية المفتوحة</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { value: "75+",    label: "منصة OSINT",   color: "text-primary" },
            { value: "مجاني",  label: "3 بحث أولاً",  color: "text-green-400" },
            { value: "30 د.ل", label: "اشتراك/شهر",   color: "text-amber-400" },
          ].map(({ value, label, color }) => (
            <div key={label} className="bg-card border border-border/50 rounded-xl p-3 text-center">
              <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-secondary/30 border-b border-border/40 px-5 py-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">تسجيل دخول آمن — بلا كلمات مرور</span>
          </div>
          <div className="p-5">
            <TelegramLoginButton onSuccess={onSuccess} />
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {["بحث بالاسم", "بحث بالهاتف", "بحث بالمعرّف", "بحث شامل", "crt.sh", "GitHub OSINT"].map((f) => (
            <span key={f} className="text-[10px] px-2.5 py-1 rounded-full border border-border/30 text-muted-foreground/60 font-mono">
              {f}
            </span>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/30 font-mono uppercase tracking-widest">
          LYOSINT v3.0 · OSINT PLATFORM · LIBYA
        </p>
      </div>
    </div>
  );
}
