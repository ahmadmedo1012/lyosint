import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth";
import { Terminal, ShieldAlert, Send, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    TelegramLoginCallback?: (data: Record<string, string>) => void;
  }
}

const BOT_USERNAME = "lyosintbot";
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-10" dir="rtl">
      <div className="w-full max-w-[400px] space-y-7">

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold font-mono tracking-widest text-primary uppercase">LYOSINT</h1>
          <p className="text-sm text-muted-foreground">منصة الاستخبارات الليبية المفتوحة</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-xl shadow-md overflow-hidden">
          {/* Stats Strip */}
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/40 border-b border-border/40">
            {[
              { value: "30 د", sub: "شهرياً" },
              { value: "3",    sub: "مجانياً" },
              { value: "40+",  sub: "منصة" },
            ].map(({ value, sub }) => (
              <div key={sub} className="py-3 text-center">
                <div className="text-lg font-bold text-primary font-mono">{value}</div>
                <div className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Login Section */}
          <div className="p-5 space-y-4">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>تسجيل دخول آمن — بلا كلمات مرور</span>
              </div>
            </div>
            <TelegramLoginButton onSuccess={onSuccess} />
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest">
          LYOSINT v3.0 · OSINT PLATFORM · LIBYA
        </p>
      </div>
    </div>
  );
}
