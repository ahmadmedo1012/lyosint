import { useParams } from "wouter";
import { useGetSearchStatus, getGetSearchStatusQueryKey, useGetSearchResult } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Phone, AtSign, CheckCircle2, AlertTriangle, XCircle,
  Loader2, ExternalLink, Github, Network, Globe, Shield, Wifi,
  Key, Database, Link as LinkIcon, Copy
} from "lucide-react";
import { useState } from "react";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم", phone: "هاتف", username: "معرّف", deep: "شامل",
};
const TYPE_COLORS: Record<string, string> = {
  name: "text-blue-400 bg-blue-500/10 border-blue-500/25",
  phone: "text-green-400 bg-green-500/10 border-green-500/25",
  username: "text-purple-400 bg-purple-500/10 border-purple-500/25",
  deep: "text-amber-400 bg-amber-500/10 border-amber-500/25",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground/40 hover:text-primary transition-colors"
      title="نسخ"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const { label, color, bg, border } =
    pct > 75
      ? { label: "موثوقية عالية", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25" }
      : pct > 40
        ? { label: "موثوقية متوسطة", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" }
        : { label: "موثوقية منخفضة", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/25" };

  return (
    <div className={`relative overflow-hidden rounded-xl border ${border} ${bg} px-5 py-4 flex items-center justify-between`}>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">درجة الموثوقية</div>
        <div className={`text-sm font-semibold ${color}`}>{label}</div>
      </div>
      <div className={`text-4xl font-black font-mono tabular-nums ${color} text-glow`}>{pct}%</div>
      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-border/30">
        <div className={`h-full transition-all duration-1000 ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%`, opacity: 0.5 }} />
      </div>
    </div>
  );
}

function DataRow({ label, value, mono = false, dir: d = "auto" }: { label: string; value: React.ReactNode; mono?: boolean; dir?: "ltr" | "rtl" | "auto" }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground uppercase font-mono shrink-0 mt-0.5">{label}</span>
      <span className={`text-sm font-medium text-foreground text-left ${mono ? "font-mono" : ""}`} dir={d}>{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground font-mono">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

function IdentityReport({ report }: { report: any }) {
  if (!report) return null;
  const identities = report.identities || [];
  return (
    <div className="mb-5 space-y-3">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">تقرير الربط والتحليل</div>
        <div className="text-sm text-foreground" dir="auto">{report.analysisSummary}</div>
      </div>

      {identities.length === 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
          لا توجد هوية مترابطة بثقة كافية. تم تقليل النتائج لتجنب التطابقات الكاذبة.
        </div>
      )}

      {identities.map((identity: any, index: number) => (
        <div key={identity.id || index} className="rounded-lg border border-border/40 bg-secondary/20 px-4 py-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold">الهوية {String.fromCharCode(65 + index)}</div>
              <div className="text-xs text-muted-foreground mt-0.5" dir="auto">{identity.conclusion}</div>
            </div>
            <Badge className="font-mono text-xs bg-primary/10 text-primary border-primary/25">
              {identity.confidencePercent}%
            </Badge>
          </div>

          {identity.representative && (identity.representative.displayName || identity.representative.website || identity.representative.location) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {identity.representative.displayName && <DataRow label="الاسم" value={identity.representative.displayName} dir="auto" />}
              {identity.representative.website && <DataRow label="الموقع" value={identity.representative.website} mono dir="ltr" />}
              {identity.representative.location && <DataRow label="الموقع الجغرافي" value={identity.representative.location} dir="auto" />}
            </div>
          )}

          {identity.evidence?.length > 0 && (
            <div>
              <div className="text-[10px] text-green-400 uppercase font-mono mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> أدلة داعمة
              </div>
              <ul className="space-y-1">
                {identity.evidence.map((e: any, i: number) => (
                  <li key={String(e.type) + '-' + i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span dir="auto">{e.description} <span className="font-mono text-[10px] text-muted-foreground/60">({(e.platforms || []).join(", ")})</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {identity.conflicts?.length > 0 && (
            <div>
              <div className="text-[10px] text-amber-400 uppercase font-mono mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> نقاط عدم يقين
              </div>
              <ul className="space-y-1">
                {identity.conflicts.map((e: any, i: number) => (
                  <li key={String(e.type) + '-' + i} className="text-xs text-amber-200/80 flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span dir="auto">{e.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1.5">المنصات داخل هذه الهوية</div>
            <div className="flex flex-wrap gap-1.5">
              {(identity.platforms || []).map((p: any) => (
                <a key={String(identity.id) + '-' + p.platform} href={p.url || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/40 px-2 py-1 text-[10px] font-mono text-foreground hover:border-primary/40">
                  {p.platform}
                  {p.url && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}

      {(report.suppressed?.count || 0) > 0 && (
        <div className="rounded-lg border border-border/30 bg-secondary/20 px-4 py-2.5 text-xs text-muted-foreground">
          تم إخفاء {report.suppressed.count} نتيجة ضعيفة: {report.suppressed.reason}
        </div>
      )}
    </div>
  );
}

export default function SearchResultPage() {
  const { id } = useParams();

  const { data: statusData } = useGetSearchStatus(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetSearchStatusQueryKey(id!),
      refetchInterval: (query: { state: { data: any } }) => {
        const d = query.state.data;
        if (d?.status === "completed" || d?.status === "failed") return false;
        return 1000;
      },
    },
  });

  const isCompleted = statusData?.status === "completed";
  const isFailed = statusData?.status === "failed";
  const isRunning = statusData?.status === "running" || statusData?.status === "pending";

  const { data: resultData, isLoading: resultLoading } = useGetSearchResult(id!, {
    query: {
      enabled: !!id && (isCompleted || isRunning),
      queryKey: getGetSearchStatusQueryKey(id!) as unknown as readonly unknown[],
      refetchInterval: (query: { state: { data: any } }) => {
        const d = query.state.data;
        if (isCompleted || isFailed) return false;
        if (d && d.usernameResult && Object.keys(d.usernameResult?.profilesFound || {}).length > 0) return 2000;
        return 1500;
      },
    },
  });

  const displayResult = resultData;

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto pb-10 page-transition" dir="rtl">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card px-5 py-4">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {statusData?.type && (
                <Badge className={`text-[10px] font-mono border ${TYPE_COLORS[statusData.type] ?? ""}`}>
                  {TYPE_LABELS[statusData.type] ?? statusData.type}
                </Badge>
              )}
              <div className="flex items-center gap-1.5">
                {isCompleted && <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/25">✓ مكتمل</Badge>}
                {isRunning && <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/25 animate-pulse gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> جاري</Badge>}
                {isFailed && <Badge variant="destructive" className="text-[10px]">✗ فاشل</Badge>}
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary font-mono break-all text-glow" dir="auto">
              {statusData?.query || "..."}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-mono text-muted-foreground/50 break-all" dir="ltr">{id}</span>
              {id && <CopyButton text={id} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Running State ── */}
      {isRunning && (
        <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-primary/4 scan-line">
          <div className="px-5 py-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-2 font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                فحص الشبكات والمنصات...
              </span>
              <span className="text-2xl font-black font-mono text-primary text-glow tabular-nums">
                {statusData?.progress || 0}%
              </span>
            </div>
            <Progress value={statusData?.progress || 0} className="h-1.5" />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase">
              <span>مفحوص: <span className="text-primary">{statusData?.platformsSearched || 0}</span></span>
              <span>الإجمالي: <span className="text-foreground">{statusData?.platformsTotal || 0}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* ── Failed State ── */}
      {isFailed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-5 py-4 flex items-center gap-3">
          <XCircle className="w-8 h-8 text-destructive shrink-0" />
          <div>
            <div className="font-bold text-destructive">فشلت العملية</div>
            <div className="text-sm text-muted-foreground mt-0.5">تعذّر إتمام جمع المعلومات لهذا الهدف.</div>
          </div>
        </div>
      )}

      {/* ── Results (partial during search, complete when done) ── */}
      {displayResult && (
        <div className="space-y-4 sm:space-y-5 page-transition">

          {/* Incremental badge */}
          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              نتائج أولية — جاري البحث عن المزيد...
            </div>
          )}

          {/* Confidence */}
          {displayResult.confidenceScore !== undefined && displayResult.confidenceScore !== null && (
            <ConfidenceBar score={displayResult.confidenceScore} />
          )}

          {/* ── Name Result ── */}
          {displayResult.nameResult && (
            <Card className="border-border/50 glow-box overflow-hidden">
              <CardContent className="p-5">
                <SectionHeader icon={User} title="معلومات شخصية" subtitle="تحليل الهوية والبيانات المرتبطة" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-0">
                    <DataRow label="الاسم الكامل" value={displayResult.nameResult.fullName || "غير محدد"} dir="auto" />
                    {displayResult.nameResult.possibleVariations && displayResult.nameResult.possibleVariations.length > 0 && (
                      <div className="py-2.5 border-b border-border/20">
                        <div className="text-xs text-muted-foreground uppercase font-mono mb-2">الأسماء المشابهة</div>
                        <div className="flex flex-wrap gap-1.5">
                          {displayResult.nameResult.possibleVariations.map((alias: string) => (
                            <Badge key={alias} variant="secondary" className="font-mono text-xs" dir="ltr">{alias}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {displayResult.nameResult.usernameVariants && displayResult.nameResult.usernameVariants.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase font-mono mb-2 flex items-center gap-1">
                          <AtSign className="w-3 h-3" /> متغيرات اليوزرنيم
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {displayResult.nameResult.usernameVariants.map((v) => (
                            <Badge key={v} variant="outline" className="font-mono text-xs" dir="ltr">{v}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {displayResult.nameResult.githubUsers && displayResult.nameResult.githubUsers.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase font-mono mb-2 flex items-center gap-1">
                          <Github className="w-3 h-3" /> مستخدمو GitHub المحتملون
                        </div>
                        <ul className="space-y-1.5">
                          {displayResult.nameResult.githubUsers.map((u) => (
                            <li key={u.login} className="flex items-center justify-between bg-secondary/30 px-3 py-2 rounded-lg border border-border/30">
                              <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-primary font-mono text-sm hover:underline" dir="ltr">
                                {u.login}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Phone Result ── */}
          {displayResult.phoneResult && (
            <Card className="border-border/50 glow-box overflow-hidden">
              <CardContent className="p-5">
                <SectionHeader icon={Phone} title="بيانات الاتصالات" subtitle="تحليل رقم الهاتف ومزود الخدمة" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-0">
                    <div className="py-3 border-b border-border/20 flex items-center justify-between">
                      <div className="font-mono text-xl font-bold text-foreground" dir="ltr">
                        {displayResult.phoneResult.nationalFormat || displayResult.phoneResult.phone}
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyButton text={displayResult.phoneResult.phone || ""} />
                        <Badge variant="outline" className={`font-mono text-xs ${displayResult.phoneResult.valid ? "text-green-400 border-green-500/40" : "text-destructive border-destructive/40"}`}>
                          {displayResult.phoneResult.valid ? "✓ صالح" : "✗ غير صالح"}
                        </Badge>
                      </div>
                    </div>
                    <DataRow label="المشغّل" value={
                      <span className={`flex items-center gap-1.5 ${
                        displayResult.phoneResult.carrier?.includes("Madar") ? "text-blue-400" :
                        displayResult.phoneResult.carrier?.includes("Libyana") ? "text-purple-400" : ""
                      }`}>
                        <Network className="w-3 h-3 shrink-0" />
                        {displayResult.phoneResult.carrier || "غير محدد"}
                      </span>
                    } />
                    <DataRow label="نوع الخط" value={displayResult.phoneResult.lineType || "غير محدد"} mono />
                    {displayResult.phoneResult.region && (
                      <DataRow label="المنطقة" value={displayResult.phoneResult.region} />
                    )}
                    {displayResult.phoneResult.countryName && (
                      <DataRow label="الدولة" value={`${displayResult.phoneResult.countryName}${displayResult.phoneResult.countryCode ? ` (${displayResult.phoneResult.countryCode})` : ""}`} />
                    )}
                    {displayResult.phoneResult.phoneMeta?.numberType && (
                      <DataRow
                        label="نوع الرقم (libphonenumber)"
                        value={
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">
                            {displayResult.phoneResult.phoneMeta.numberType}
                          </Badge>
                        }
                      />
                    )}
                    {displayResult.phoneResult.phoneMeta?.internationalFormat && (
                      <DataRow
                        label="الصيغة الدولية"
                        value={displayResult.phoneResult.phoneMeta.internationalFormat}
                        mono
                        dir="ltr"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase font-mono mb-2.5">المنصات المرتبطة</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { name: "WhatsApp", status: displayResult.phoneResult.messagingApps.whatsapp, color: "green" },
                          { name: "Telegram", status: displayResult.phoneResult.messagingApps.telegram, color: "blue" },
                        ].map(({ name, status, color }) => (
                          <a
                            key={name}
                            href={status.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all hover:opacity-80 ${
                              status.available === true
                                ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400`
                                : status.available === false
                                ? "bg-secondary/20 border-border/20 text-muted-foreground/40"
                                : "bg-secondary/30 border-border/30 text-foreground/70"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {status.available === true ? (
                                <Wifi className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                              )}
                              {name}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">تحقق يدوياً عبر الرابط — لا يمكن فحص التسجيل تلقائياً</p>
                    </div>

                    {displayResult.phoneResult.investigativeLinks && displayResult.phoneResult.investigativeLinks.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase font-mono mb-2 flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> روابط التحقيق
                        </div>
                        <ul className="space-y-1.5">
                          {displayResult.phoneResult.investigativeLinks.map((l) => (
                            <li key={l.url} className="flex items-center justify-between bg-secondary/30 px-3 py-2 rounded-lg border border-border/30">
                              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary font-mono text-xs hover:underline flex items-center gap-1.5">
                                {l.label}
                                <ExternalLink className="w-3 h-3 opacity-50" />
                              </a>
                              <CopyButton text={l.url} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {displayResult.phoneResult.dataSource && (
                      <p className="text-[10px] text-muted-foreground/50 font-mono">
                        مصدر البيانات: {displayResult.phoneResult.dataSource}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Username Result ── */}
          {displayResult.usernameResult && (
            <Card className="border-border/50 glow-box overflow-hidden">
              <CardContent className="p-5">
                <SectionHeader
                  icon={AtSign}
                  title="البصمة الرقمية"
                  subtitle={`${displayResult.usernameResult.totalFound} / ${displayResult.usernameResult.totalPlatformsSearched} منصة`}
                />

                <IdentityReport report={(displayResult.usernameResult as any).identityReport} />

                <details className="rounded-lg border border-border/30 bg-secondary/10 px-4 py-3">
                  <summary className="cursor-pointer text-xs font-mono text-muted-foreground hover:text-foreground">بيانات الجمع الخام والفحص الفني</summary>
                  <div className="mt-4 space-y-4">

                {(displayResult.usernameResult as any).profilePhoto && (
                  <div className="mb-4 flex items-center gap-4 px-4 py-3 bg-secondary/30 rounded-lg border border-border/40">
                    <img
                      src={(displayResult.usernameResult as any).profilePhoto as string}
                      alt="profile"
                      className="w-14 h-14 rounded-full object-cover border-2 border-primary/30 shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      {(displayResult.usernameResult as any).profileFullname && (
                        <div className="font-bold text-foreground truncate" dir="auto">
                          {(displayResult.usernameResult as any).profileFullname}
                        </div>
                      )}
                      {(displayResult.usernameResult as any).profileBio && (
                        <div className="text-xs text-muted-foreground line-clamp-2" dir="auto">
                          {(displayResult.usernameResult as any).profileBio}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Maigret rich profiles (image/fullname/bio per site) ── */}
                {(displayResult.usernameResult as any).maigretProfiles && (displayResult.usernameResult as any).maigretProfiles.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] text-muted-foreground uppercase font-mono mb-2.5 flex items-center gap-1.5">
                      <Database className="w-3 h-3 text-primary" />
                      البروفايلات من Maigret ({(displayResult.usernameResult as any).maigretProfiles.length})
                      <span className="text-[9px] text-muted-foreground/50">
                        ({((displayResult.usernameResult as any).maigretProfiles as any[]).filter(p => p.isPriority).length} تواصل اجتماعي)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {((displayResult.usernameResult as any).maigretProfiles as any[])
                        .slice(0, 12)
                        .map((p, i) => (
                          <a
                            key={`${p.site}-${i}`}
                            href={p.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                              p.isPriority
                                ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"
                                : "border-border/30 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40"
                            }`}
                          >
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.site}
                                className="w-10 h-10 rounded-full object-cover border border-border/40 shrink-0"
                                referrerPolicy="no-referrer"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                p.isPriority
                                  ? "bg-amber-500/10 border border-amber-500/30"
                                  : "bg-primary/10 border border-primary/20"
                              }`}>
                                <User className={`w-4 h-4 ${p.isPriority ? "text-amber-400" : "text-primary/60"}`} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-foreground truncate">{p.site}</span>
                                {p.isPriority && (
                                  <Badge className="text-[9px] px-1 py-0 font-mono bg-amber-500/20 text-amber-300 border-amber-500/30">
                                    ⭐ تواصل
                                  </Badge>
                                )}
                                {p.category && !p.isPriority && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                                    {p.category}
                                  </Badge>
                                )}
                              </div>
                              {p.fullname && (
                                <div className="text-xs text-foreground/80 truncate" dir="auto">{p.fullname}</div>
                              )}
                              {p.bio && (
                                <div className="text-[10px] text-muted-foreground line-clamp-1" dir="auto">{p.bio}</div>
                              )}
                            </div>
                            {p.url && <ExternalLink className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
                          </a>
                        ))}
                    </div>
                  </div>
                )}

                {(displayResult.usernameResult as any).sources && (displayResult.usernameResult as any).sources.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">المصادر:</span>
                    {((displayResult.usernameResult as any).sources as string[]).map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-mono">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    {
                      label: "موجود في",
                      value: displayResult.usernameResult.totalFound,
                      color: "text-primary",
                      bg: "bg-primary/5 border-primary/15",
                    },
                    {
                      label: "مفحوصة",
                      value: displayResult.usernameResult.totalPlatformsSearched,
                      color: "text-foreground",
                      bg: "bg-secondary/30 border-border/30",
                    },
                    {
                      label: "نسبة الظهور",
                      value: `${Math.round(((displayResult.usernameResult.totalFound ?? 0) / Math.max(1, displayResult.usernameResult.totalPlatformsSearched ?? 0)) * 100)}%`,
                      color: (displayResult.usernameResult.totalFound ?? 0) > 10 ? "text-amber-400" : "text-green-400",
                      bg: "bg-secondary/20 border-border/20",
                    },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`text-center py-3 px-2 rounded-lg border ${bg}`}>
                      <div className={`text-xl font-black font-mono ${color}`}>{value}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {displayResult.usernameResult.possibleEmail && (
                  <div className="mb-4 flex items-center gap-3 px-3.5 py-2.5 bg-secondary/30 rounded-lg border border-border/40">
                    <Key className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground uppercase font-mono">البريد المحتمل:</span>
                    <span className="text-primary font-mono text-sm flex-1" dir="ltr">{displayResult.usernameResult.possibleEmail}</span>
                    <CopyButton text={displayResult.usernameResult.possibleEmail} />
                  </div>
                )}

                {/* Breaches */}
                {displayResult.usernameResult.breaches && displayResult.usernameResult.breaches.length > 0 && (
                  <div className="mb-4 p-3.5 rounded-lg border border-red-500/25 bg-red-500/6">
                    <div className="text-[10px] font-mono text-red-400 uppercase mb-2 flex items-center gap-1">
                      <Database className="w-3 h-3" /> تسريبات بيانات ({displayResult.usernameResult.breaches.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {displayResult.usernameResult.breaches.map((b: any) => (
                        <Badge key={b.name} variant="outline" className="text-[10px] border-red-500/25 text-red-400 font-mono">
                          {b.name} {b.breachDate && `(${b.breachDate.split("-")[0]})`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Platform grid */}
                {displayResult.usernameResult.profilesFound && (
                  <>
                    {/* Found platforms */}
                    {Object.entries(displayResult.usernameResult.profilesFound).filter(([, p]: [string, any]) => p.exists).length > 0 && (
                      <div className="mb-3">
                        <div className="text-[10px] text-muted-foreground uppercase font-mono mb-2.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          الحسابات المُكتشفة
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {Object.entries(displayResult.usernameResult.profilesFound)
                            .filter(([, p]: [string, any]) => p.exists)
                            .map(([platform, profile]: [string, any]) => (
                              <div key={platform} className="group relative overflow-hidden rounded-lg border border-primary/20 bg-primary/4 hover:border-primary/40 hover:bg-primary/8 transition-all p-3">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Shield className="w-3 h-3 text-green-400 shrink-0" />
                                  <span className="text-xs font-bold uppercase tracking-wide truncate">{platform}</span>
                                </div>
                                {profile.displayName && (
                                  <div className="text-xs text-muted-foreground truncate">{profile.displayName}</div>
                                )}
                                {profile.followers !== undefined && profile.followers !== null && (
                                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    <span className="text-primary font-bold font-mono">{profile.followers.toLocaleString()}</span> متابع
                                  </div>
                                )}
                                {profile.url && (
                                  <a href={profile.url} target="_blank" rel="noopener noreferrer"
                                    className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-mono" dir="ltr">
                                    فتح الرابط <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Not found platforms */}
                    {Object.entries(displayResult.usernameResult.profilesFound).filter(([, p]: [string, any]) => !p.exists).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-muted-foreground/50 uppercase font-mono cursor-pointer hover:text-muted-foreground transition-colors flex items-center gap-1.5 py-1">
                          <Globe className="w-3 h-3" />
                          المنصات غير المُكتشفة ({Object.entries(displayResult.usernameResult.profilesFound).filter(([, p]: [string, any]) => !p.exists).length})
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(displayResult.usernameResult.profilesFound)
                            .filter(([, p]: [string, any]) => !p.exists)
                            .map(([platform]) => (
                              <span key={platform} className="text-[10px] px-2 py-0.5 rounded bg-secondary/20 border border-border/20 text-muted-foreground/40 font-mono uppercase">
                                {platform}
                              </span>
                            ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
                  </div>
                </details>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
