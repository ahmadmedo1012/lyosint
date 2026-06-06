import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth";
import { Terminal, ShieldAlert, Send, Loader2, CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    TelegramLoginCallback?: (data: Record<string, string>) => void;
  }
}

const BOT_USERNAME = "lyosintbot";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function generateLoginToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface TelegramLoginProps {
  onSuccess?: () => void;
}

type LoginState = "idle" | "waiting" | "success" | "error";

export function TelegramLoginButton({ onSuccess }: TelegramLoginProps) {
  const { login, refreshUser } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetWorking, setWidgetWorking] = useState<boolean | null>(null);
  const [loginToken] = useState(() => generateLoginToken());
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const botLoginUrl = `https://t.me/${BOT_USERNAME}?start=login_${loginToken}`;
  const currentDomain = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalhost = currentDomain === "localhost" || currentDomain === "127.0.0.1";

  // Try Telegram widget first
  useEffect(() => {
    window.TelegramLoginCallback = async (data: Record<string, string>) => {
      try {
        await login(data);
        onSuccess?.();
      } catch {
        setWidgetWorking(false);
      }
    };

    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "TelegramLoginCallback(user)");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.async = true;

    // Check if widget loaded successfully after 2s
    const checkTimer = setTimeout(() => {
      const iframe = containerRef.current?.querySelector("iframe");
      setWidgetWorking(!!iframe && !iframe.src.includes("error"));
    }, 2500);

    containerRef.current.appendChild(script);
    return () => {
      clearTimeout(checkTimer);
      delete window.TelegramLoginCallback;
    };
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

    // Stop after 5 minutes
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        setLoginState("idle");
      }
    }, 5 * 60 * 1000);
  }, [loginToken, refreshUser, onSuccess]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(currentDomain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBot = () => {
    window.open(botLoginUrl, "_blank");
    startPolling();
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="text-center space-y-1.5">
        <div className="flex items-center justify-center gap-2 text-primary">
          <ShieldAlert className="w-4 h-4" />
          <span className="font-mono text-sm uppercase tracking-widest">تسجيل الدخول الآمن</span>
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
          سجّل دخولك عبر تيليقرام — لا يتم حفظ كلمات مرور
        </p>
      </div>

      {/* Hidden widget attempt */}
      <div ref={containerRef} className={`${widgetWorking === false || widgetWorking === null ? "opacity-0 h-0 overflow-hidden" : "min-h-[48px]"} flex justify-center w-full transition-all`} />

      {/* Bot-based login (always shown, primary method) */}
      <div className="w-full space-y-3">
        {loginState === "idle" && (
          <Button
            onClick={handleOpenBot}
            className="w-full h-12 font-bold text-base gap-2.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
            تسجيل الدخول عبر تيليقرام
          </Button>
        )}

        {loginState === "waiting" && (
          <div className="space-y-3">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center space-y-2 border-glow">
              <div className="flex items-center justify-center gap-2 text-primary font-bold font-mono text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                في انتظار التأكيد من تيليقرام...
              </div>
              <p className="text-xs text-muted-foreground">
                افتح الرابط في تيليقرام واضغط <span className="text-primary font-bold">Start</span> ثم ارجع هنا
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOpenBot} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
                <Send className="w-3.5 h-3.5" /> افتح تيليقرام مجدداً
              </Button>
              <Button onClick={() => { clearInterval(pollRef.current!); setLoginState("idle"); }} variant="ghost" size="sm" className="text-xs text-muted-foreground">
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {loginState === "success" && (
          <div className="flex items-center justify-center gap-2 py-3 text-green-500 font-bold font-mono">
            <CheckCircle2 className="w-5 h-5" />
            تم تسجيل الدخول بنجاح!
          </div>
        )}

        {loginState === "error" && (
          <div className="space-y-2">
            <div className="text-destructive text-xs text-center">حدث خطأ — حاول مرة أخرى</div>
            <Button onClick={() => setLoginState("idle")} variant="outline" size="sm" className="w-full gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {loginState === "idle" && (
          <p className="text-center text-[10px] text-muted-foreground font-mono">
            سيفتح تيليقرام تلقائياً · اضغط Start في البوت ثم ارجع هنا
          </p>
        )}
      </div>

      {/* Domain setup notice - only if widget failed AND not localhost */}
      {widgetWorking === false && !isLocalhost && (
        <details className="w-full">
          <summary className="text-[10px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground font-mono text-center">
            إعداد تسجيل دخول Widget (اختياري)
          </summary>
          <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs space-y-2" dir="rtl">
            <p className="text-amber-300/80">أرسل هذه الأوامر إلى <span className="font-mono">@BotFather</span>:</p>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="bg-black/30 rounded p-1.5 text-amber-200/90">/setdomain</div>
              <div className="bg-black/30 rounded p-1.5 text-amber-200/90">@{BOT_USERNAME}</div>
              <div className="bg-black/30 rounded p-1.5 text-green-300 flex items-center justify-between border border-green-500/20">
                <span className="truncate">{currentDomain}</span>
                <button onClick={handleCopyDomain} className="shrink-0 mr-2 text-green-400">
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </details>
      )}

      <div className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest text-center">
        تشفير طرف-إلى-طرف · لا تتبع · آمن
      </div>
    </div>
  );
}

export function LoginPage({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-primary">
            <Terminal className="w-8 h-8" />
            <h1 className="text-4xl font-bold font-mono tracking-widest text-glow uppercase">LYOSINT</h1>
          </div>
          <p className="text-muted-foreground text-sm font-mono">منصة الاستخبارات الليبية المفتوحة</p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-2xl" />
          <div className="relative bg-card border border-primary/20 rounded-xl p-6 space-y-6 border-glow">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-foreground">ادخل إلى نظام الاستخبارات</h2>
              <p className="text-xs text-muted-foreground font-mono">3 عمليات بحث مجانية · ثم 30 دينار ليبي / شهر</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[{ label: "منصة", value: "40+" }, { label: "مجاني", value: "3" }, { label: "شهري", value: "30 د" }].map((item) => (
                <div key={item.label} className="bg-secondary/30 rounded-lg p-3 border border-border/40">
                  <div className="text-lg font-bold text-primary font-mono text-glow">{item.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-mono mt-1">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-border/30 pt-5">
              <TelegramLoginButton onSuccess={onSuccess} />
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/40 font-mono">LYOSINT v3.0 · OSINT PLATFORM · LIBYA</p>
      </div>
    </div>
  );
}
