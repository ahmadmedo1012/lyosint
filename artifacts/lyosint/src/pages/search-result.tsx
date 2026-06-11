import { useParams, useLocation } from "wouter";
import { useGetSearchStatus, getGetSearchStatusQueryKey, useGetSearchResult, getGetSearchResultQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/page-transition";
import { IdentityReport } from "@/components/search/identity-report";
import { EvidencePanel } from "@/components/evidence-panel";
import { GraphVisualization } from "@/components/graph-visualization";
import {
  User, Phone, AtSign, CheckCircle2, AlertTriangle, XCircle,
  Loader2, ExternalLink, Github, Network, Shield, Wifi,
  Key, Database, Link as LinkIcon, Copy, Globe, Search,
  FolderSearch, Plus, Target, GitFork
} from "lucide-react";
import { useState } from "react";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم", phone: "هاتف", username: "معرّف", deep: "شامل",
};
const TYPE_COLORS: Record<string, string> = {
  name: "text-blue-600 bg-blue-500/10 border-blue-500/25",
  phone: "text-green-600 bg-green-500/10 border-green-500/25",
  username: "text-purple-600 bg-purple-500/10 border-purple-500/25",
  deep: "text-amber-600 bg-amber-500/10 border-amber-500/25",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground/40 hover:text-primary transition-colors" title="نسخ">
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const { label, color } =
    pct > 75 ? { label: "موثوقية عالية", color: "text-green-600" }
    : pct > 40 ? { label: "موثوقية متوسطة", color: "text-amber-600" }
    : { label: "موثوقية منخفضة", color: "text-red-600" };

  return (
    <div className="rounded-xl border border-border/30 bg-card px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground font-medium">درجة الموثوقية</div>
          <div className={`text-sm font-semibold ${color}`}>{label}</div>
        </div>
        <div className={`text-3xl font-bold font-mono tabular-nums ${color}`}>{pct}%</div>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DataRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/10 last:border-0">
      <span className="text-xs text-muted-foreground font-medium shrink-0 mt-0.5">{label}</span>
      <span className={`text-sm font-medium text-foreground text-right ${mono ? "font-mono" : ""}`} dir="auto">{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-3 h-3 text-primary" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

interface NameResult {
  fullName?: string | null;
  possibleVariations?: string[];
  usernameVariants?: string[];
  githubUsers?: Array<{ login: string; url: string }>;
}

interface PhoneResult {
  phone?: string;
  nationalFormat?: string;
  valid?: boolean;
  carrier?: string | null;
  lineType?: string | null;
  region?: string | null;
  countryName?: string | null;
  countryCode?: string | null;
  phoneMeta?: {
    numberType?: string;
    internationalFormat?: string;
  } | null;
  messagingApps?: {
    whatsapp: { available?: boolean | null; url?: string };
    telegram: { available?: boolean | null; url?: string };
  };
  investigativeLinks?: Array<{ url: string; label: string }>;
  dataSource?: string | null;
}

interface ProfileEntry {
  url?: string | null;
  exists?: boolean;
  status?: string;
  verified?: boolean;
  displayName?: string | null;
  followers?: number | null;
  bio?: string | null;
  profileData?: Record<string, unknown>;
}

interface UsernameResult {
  totalFound?: number;
  totalPlatformsSearched?: number;
  profilesFound?: Record<string, ProfileEntry>;
  possibleEmail?: string | null;
  breaches?: Array<{ name: string; breachDate?: string }>;
  identityReport?: {
    identities?: Array<Record<string, unknown>>;
    analysisSummary?: string;
    suppressed?: { count?: number; reason?: string } | null;
  };
  maigretProfiles?: Array<{
    site: string; url?: string; image?: string | null;
    fullname?: string | null; bio?: string | null;
    isPriority?: boolean; category?: string;
  }>;
  sources?: string[];
  profilePhoto?: string | null;
  profileFullname?: string | null;
  profileBio?: string | null;
  githubProfile?: Record<string, unknown> | null;
}

function SkeletonCard() {
  return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-20 w-full rounded-xl bg-secondary/30" />
      <Skeleton className="h-40 w-full rounded-xl bg-secondary/20" />
      <Skeleton className="h-60 w-full rounded-xl bg-secondary/20" />
    </div>
  );
}

export default function SearchResultPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const { data: statusData } = useGetSearchStatus(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetSearchStatusQueryKey(id!),
      refetchInterval: (query) => {
        const d = query.state.data as { status?: string } | undefined;
        if (d?.status === "completed" || d?.status === "failed") return false;
        return 500;
      },
    },
  });

  const isCompleted = statusData?.status === "completed";
  const isFailed = statusData?.status === "failed";
  const isRunning = statusData?.status === "running" || statusData?.status === "pending";

  const { data: resultData } = useGetSearchResult(id!, {
    query: {
      queryKey: getGetSearchResultQueryKey(id!),
      enabled: !!id && (isCompleted || isRunning),
      refetchInterval: (query) => {
        const d = query.state.data as Record<string, unknown> | undefined;
        if (isCompleted || isFailed) return false;
        const ur = d?.usernameResult as Record<string, unknown> | undefined;
        if (ur && Object.keys((ur.profilesFound as Record<string, unknown>) || {}).length > 0) return 2000;
        return 1500;
      },
    },
  });

  const nameResult = resultData?.nameResult as NameResult | undefined;
  const phoneResult = resultData?.phoneResult as PhoneResult | undefined;
  const usernameResult = resultData?.usernameResult as UsernameResult | undefined;
  const confidenceScore = resultData?.confidenceScore as number | undefined;
  const entityId = (resultData as unknown as Record<string, unknown>)?.entityId as string | undefined;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-4 pb-10" dir="rtl">
        {/* Header */}
        <div className="rounded-xl border border-border/30 bg-card px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {statusData?.type && (
                  <Badge className={`text-[10px] font-mono border ${TYPE_COLORS[statusData.type] ?? ""}`}>
                    {TYPE_LABELS[statusData.type] ?? statusData.type}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5">
                  {isCompleted && <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/25">✓ مكتمل</Badge>}
                  {isRunning && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/25 animate-pulse gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> جاري</Badge>}
                  {isFailed && <Badge variant="destructive" className="text-[10px]">✗ فاشل</Badge>}
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground" dir="auto">
                {statusData?.query || "..."}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-mono text-muted-foreground/50 break-all" dir="ltr">{id}</span>
                {id && <CopyButton text={id} />}
              </div>
            </div>
          </div>
        </div>

        {/* Running State */}
        {isRunning && (
          <div className="rounded-xl border border-primary/20 bg-primary/4 px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                فحص الشبكات والمنصات...
              </span>
              <span className="text-2xl font-bold font-mono text-primary tabular-nums">
                {statusData?.progress || 0}%
              </span>
            </div>
            <Progress value={statusData?.progress || 0} className="h-1" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>مفحوص: <span className="text-primary font-medium">{statusData?.platformsSearched || 0}</span></span>
              <span>الإجمالي: <span className="text-foreground font-medium">{statusData?.platformsTotal || 0}</span></span>
            </div>
          </div>
        )}

        {/* Failed State */}
        {isFailed && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-5 py-4 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <div className="font-medium text-red-500">فشلت العملية</div>
              <div className="text-sm text-muted-foreground mt-0.5">تعذّر إتمام جمع المعلومات لهذا الهدف.</div>
            </div>
          </div>
        )}

        {/* Initial loading state */}
        {!resultData && !isRunning && !isFailed && !isCompleted && <SkeletonCard />}

        {/* Results */}
        {resultData && (
          <PageTransition>
            <div className="space-y-4">
              {isRunning && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-600 text-xs animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  نتائج أولية — جاري البحث عن المزيد...
                </div>
              )}

              {confidenceScore !== undefined && confidenceScore !== null && (
                <ConfidenceBar score={confidenceScore} />
              )}

              {nameResult && <NameResultSection data={nameResult} />}
              {phoneResult && <PhoneResultSection data={phoneResult} />}
              {usernameResult && <UsernameResultSection data={usernameResult} />}

              {/* Entity Resolution */}
              {confidenceScore !== undefined && confidenceScore !== null && (
                <Card className="border-border/30">
                  <CardContent className="p-5">
                    <SectionHeader icon={Target} title="حل الهوية" subtitle="تحليل الهوية الرقمية والأدلة المرتبطة" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "درجة الثقة", value: `${Math.round(confidenceScore * 100)}%`, color: confidenceScore > 0.75 ? "text-green-600" : confidenceScore > 0.4 ? "text-amber-600" : "text-red-600" },
                        { label: "الأدلة", value: usernameResult ? Object.keys(usernameResult.profilesFound || {}).length : 0, color: "text-primary" },
                        { label: "المصادر", value: usernameResult?.sources?.length || 0, color: "text-blue-600" },
                        { label: "المنصات", value: usernameResult?.totalPlatformsSearched || 0, color: "text-purple-600" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border border-border/20 bg-secondary/20 p-3 text-center">
                          <div className={`text-lg font-bold font-mono tabular-nums ${s.color}`}>{s.value}</div>
                          <div className="text-[10px] text-muted-foreground">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation(entityId ? `/entity/${entityId}` : `/entity/${id}`)}>
                        <Target className="w-3.5 h-3.5" /> عرض تفاصيل الكيان
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => setLocation("/investigations")}>
                        <Plus className="w-3.5 h-3.5" /> إضافة لتحقيق
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Evidence Panel */}
              {usernameResult && Object.keys(usernameResult.profilesFound || {}).length > 0 && (
                <Card className="border-border/30">
                  <CardContent className="p-5">
                    <SectionHeader icon={Shield} title="الأدلة المجمعة" subtitle="مصادر وتوثيق المعلومات" />
                    <EvidencePanel
                      evidence={Object.entries(usernameResult.profilesFound || {})
                        .filter(([, p]) => p.exists)
                        .slice(0, 10)
                        .map(([source, profile], idx) => ({
                          id: `ev-search-${idx}`,
                          title: `حساب ${source}`,
                          source,
                          sourceType: profile.verified ? "social" : "web",
                          confidence: profile.exists ? (profile.verified ? 90 : 70) : 30,
                          date: statusData?.completedAt || statusData?.createdAt || "",
                          summary: profile.displayName ? `اسم العرض: ${profile.displayName}` : `حساب على ${source}`,
                        }))}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Graph Mini-View */}
              {usernameResult && Object.keys(usernameResult.profilesFound || {}).length > 1 && (
                <Card className="border-border/30">
                  <CardContent className="p-5">
                    <SectionHeader icon={GitFork} title="خريطة العلاقات" subtitle="تصور بياني للكيانات المرتبطة" />
                    <div className="h-[250px] rounded-lg border border-border/20 bg-card overflow-hidden">
                      <GraphVisualization
                        nodes={[
                          { id: "main", label: statusData?.query || "الهدف", type: "person", confidence: Math.round((confidenceScore || 0) * 100) },
                          ...Object.entries(usernameResult.profilesFound || {})
                            .filter(([, p]) => p.exists)
                            .slice(0, 8)
                            .map(([platform], idx) => ({
                              id: `p-${idx}`,
                              label: platform,
                              type: "username",
                              confidence: 70,
                            })),
                        ]}
                        edges={Object.entries(usernameResult.profilesFound || {})
                          .filter(([, p]) => p.exists)
                          .slice(0, 8)
                          .map((_, idx) => ({
                            source: "main",
                            target: `p-${idx}`,
                            type: "uses",
                            label: "مرتبط",
                          }))}
                        height={230}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </PageTransition>
        )}
      </div>
    </PageTransition>
  );
}

function NameResultSection({ data }: { data: NameResult }) {
  return (
    <Card className="border-border/30">
      <CardContent className="p-5">
        <SectionHeader icon={User} title="معلومات شخصية" subtitle="تحليل الهوية والبيانات المرتبطة" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-0">
            <DataRow label="الاسم الكامل" value={data.fullName || "غير محدد"} />
            {data.possibleVariations && data.possibleVariations.length > 0 && (
              <div className="py-2.5 border-b border-border/10">
                <div className="text-xs text-muted-foreground font-medium mb-2">الأسماء المشابهة</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.possibleVariations.map((alias) => (
                    <Badge key={alias} variant="secondary" className="font-mono text-xs" dir="ltr">{alias}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {data.usernameVariants && data.usernameVariants.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <AtSign className="w-3 h-3" /> متغيرات اليوزرنيم
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.usernameVariants.map((v) => (
                    <Badge key={v} variant="outline" className="font-mono text-xs" dir="ltr">{v}</Badge>
                  ))}
                </div>
              </div>
            )}
            {data.githubUsers && data.githubUsers.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <Github className="w-3 h-3" /> مستخدمو GitHub المحتملون
                </div>
                <ul className="space-y-1">
                  {data.githubUsers.map((u) => (
                    <li key={u.login} className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-lg border border-border/20">
                      <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-primary font-mono text-sm hover:underline" dir="ltr">{u.login}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PhoneResultSection({ data }: { data: PhoneResult }) {
  return (
    <Card className="border-border/30">
      <CardContent className="p-5">
        <SectionHeader icon={Phone} title="بيانات الاتصالات" subtitle="تحليل رقم الهاتف ومزود الخدمة" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-0">
            <div className="py-3 border-b border-border/10 flex items-center justify-between">
              <div className="font-mono text-xl font-bold text-foreground" dir="ltr">
                {data.nationalFormat || data.phone}
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={data.phone || ""} />
                <Badge variant="outline" className={`font-mono text-xs ${data.valid ? "text-green-600 border-green-500/40" : "text-red-600 border-red-500/40"}`}>
                  {data.valid ? "✓ صالح" : "✗ غير صالح"}
                </Badge>
              </div>
            </div>
            <DataRow label="المشغّل" value={
              <span className={`flex items-center gap-1.5 ${
                data.carrier?.includes("Madar") ? "text-blue-600" :
                data.carrier?.includes("Libyana") ? "text-purple-600" : ""
              }`}>
                <Network className="w-3 h-3 shrink-0" />
                {data.carrier || "غير محدد"}
              </span>
            } />
            <DataRow label="نوع الخط" value={data.lineType || "غير محدد"} mono />
            {data.region && <DataRow label="المنطقة" value={data.region} />}
            {data.countryName && (
              <DataRow label="الدولة" value={`${data.countryName}${data.countryCode ? ` (${data.countryCode})` : ""}`} />
            )}
            {data.phoneMeta?.numberType && (
              <DataRow label="نوع الرقم" value={
                <Badge variant="outline" className="font-mono text-[10px] uppercase">{data.phoneMeta.numberType}</Badge>
              } />
            )}
            {data.phoneMeta?.internationalFormat && (
              <DataRow label="الصيغة الدولية" value={data.phoneMeta.internationalFormat} mono />
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium mb-2.5">المنصات المرتبطة</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "WhatsApp", app: data.messagingApps?.whatsapp, color: "green" },
                  { name: "Telegram", app: data.messagingApps?.telegram, color: "blue" },
                ].map(({ name, app, color }) => app && (
                  <a key={name} href={app.url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all hover:opacity-80 ${
                      app.available === true
                        ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-600`
                        : app.available === false
                        ? "bg-secondary/20 border-border/20 text-muted-foreground/40"
                        : "bg-secondary/30 border-border/30 text-foreground/70"
                    }`}>
                    <span className="flex items-center gap-2">
                      {app.available === true ? <Wifi className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {name}
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">تحقق يدوياً عبر الرابط</p>
            </div>

            {data.investigativeLinks && data.investigativeLinks.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> روابط التحقيق
                </div>
                <ul className="space-y-1">
                  {data.investigativeLinks.map((l) => (
                    <li key={l.url} className="flex items-center justify-between bg-secondary/20 px-3 py-2 rounded-lg border border-border/20">
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary font-mono text-xs hover:underline flex items-center gap-1.5">
                        {l.label} <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                      <CopyButton text={l.url} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.dataSource && (
              <p className="text-[10px] text-muted-foreground/50 font-mono">مصدر البيانات: {data.dataSource}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsernameResultSection({ data }: { data: UsernameResult }) {
  const profilesFound = data.profilesFound || {};
  const foundEntries = Object.entries(profilesFound).filter(([, p]) => p.exists);
  const notFoundEntries = Object.entries(profilesFound).filter(([, p]) => !p.exists);

  return (
    <Card className="border-border/30">
      <CardContent className="p-5">
        <SectionHeader icon={AtSign} title="البصمة الرقمية" subtitle={`${data.totalFound ?? 0} / ${data.totalPlatformsSearched ?? 0} منصة`} />

        <IdentityReport report={(data.identityReport ?? null) as React.ComponentProps<typeof IdentityReport>['report']} />

        {data.profilePhoto && <ProfileCard data={data} />}

        {data.maigretProfiles && data.maigretProfiles.length > 0 && (
          <MaigretSection profiles={data.maigretProfiles} />
        )}

        {data.sources && data.sources.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">المصادر:</span>
            {data.sources.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
            ))}
          </div>
        )}

        <SummaryStats data={data} />

        {data.possibleEmail && (
          <div className="mb-4 flex items-center gap-3 px-3.5 py-2.5 bg-secondary/20 rounded-lg border border-border/20">
            <Key className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-medium">البريد المحتمل:</span>
            <span className="text-primary font-mono text-sm flex-1" dir="ltr">{data.possibleEmail}</span>
            <CopyButton text={data.possibleEmail} />
          </div>
        )}

        {data.breaches && data.breaches.length > 0 && <BreachSection breaches={data.breaches} />}

        {foundEntries.length > 0 && <FoundPlatforms entries={foundEntries} />}

        {notFoundEntries.length > 0 && <NotFoundPlatforms entries={notFoundEntries} />}
      </CardContent>
    </Card>
  );
}

function ProfileCard({ data }: { data: UsernameResult }) {
  return (
    <div className="mb-4 flex items-center gap-4 px-4 py-3 bg-secondary/20 rounded-lg border border-border/20">
      <img src={data.profilePhoto!} alt="profile" className="w-14 h-14 rounded-full object-cover border-2 border-primary/30 shrink-0"
        referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      <div className="min-w-0 flex-1 space-y-0.5">
        {data.profileFullname && <div className="font-bold text-foreground truncate" dir="auto">{data.profileFullname}</div>}
        {data.profileBio && <div className="text-xs text-muted-foreground line-clamp-2" dir="auto">{data.profileBio}</div>}
      </div>
    </div>
  );
}

function MaigretSection({ profiles }: { profiles: UsernameResult['maigretProfiles'] }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] text-muted-foreground font-medium mb-2.5 flex items-center gap-1.5">
        <Database className="w-3 h-3 text-primary" />
        البروفايلات من Maigret ({profiles!.length})
        <span className="text-[9px] text-muted-foreground/50">({profiles!.filter(p => p.isPriority).length} تواصل اجتماعي)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {profiles!.slice(0, 12).map((p, i) => (
          <a key={`${p.site}-${i}`} href={p.url || "#"} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
              p.isPriority
                ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"
                : "border-border/20 bg-secondary/20 hover:border-border/40 hover:bg-secondary/40"
            }`}>
            {p.image ? (
              <img src={p.image} alt={p.site} className="w-10 h-10 rounded-full object-cover border border-border/40 shrink-0"
                referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                p.isPriority ? "bg-amber-500/10 border border-amber-500/30" : "bg-primary/10 border border-primary/20"
              }`}>
                <User className={`w-4 h-4 ${p.isPriority ? "text-amber-500" : "text-primary/60"}`} />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground truncate">{p.site}</span>
                {p.isPriority && <Badge className="text-[9px] px-1 py-0 font-mono bg-amber-500/20 text-amber-600 border-amber-500/30">⭐ تواصل</Badge>}
                {p.category && !p.isPriority && <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">{p.category}</Badge>}
              </div>
              {p.fullname && <div className="text-xs text-foreground/80 truncate" dir="auto">{p.fullname}</div>}
              {p.bio && <div className="text-[10px] text-muted-foreground line-clamp-1" dir="auto">{p.bio}</div>}
            </div>
            {p.url && <ExternalLink className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
          </a>
        ))}
      </div>
    </div>
  );
}

function SummaryStats({ data }: { data: UsernameResult }) {
  const totalFound = data.totalFound ?? 0;
  const totalSearched = data.totalPlatformsSearched ?? 0;
  const ratio = `${Math.round((totalFound / Math.max(1, totalSearched)) * 100)}%`;
  const ratioColor = totalFound > 10 ? "text-amber-600" : "text-green-600";

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {[
        { label: "موجود في", value: totalFound, color: "text-primary", bg: "bg-primary/5 border-primary/15" },
        { label: "مفحوصة", value: totalSearched, color: "text-foreground", bg: "bg-secondary/20 border-border/20" },
        { label: "نسبة الظهور", value: ratio, color: ratioColor, bg: "bg-secondary/20 border-border/20" },
      ].map(({ label, value, color, bg }) => (
        <div key={label} className={`text-center py-3 px-2 rounded-lg border ${bg}`}>
          <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function BreachSection({ breaches }: { breaches: UsernameResult['breaches'] }) {
  return (
    <div className="mb-4 p-3.5 rounded-lg border border-red-500/25 bg-red-500/6">
      <div className="text-[10px] text-red-500 font-medium mb-2 flex items-center gap-1">
        <Database className="w-3 h-3" /> تسريبات بيانات ({breaches!.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {breaches!.map((b) => (
          <Badge key={b.name} variant="outline" className="text-[10px] border-red-500/25 text-red-500 font-mono">
            {b.name}{b.breachDate ? ` (${b.breachDate.split("-")[0]})` : ""}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function FoundPlatforms({ entries }: { entries: [string, ProfileEntry][] }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] text-muted-foreground font-medium mb-2.5 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-green-500" />
        الحسابات المُكتشفة
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {entries.map(([platform, profile]) => (
          <div key={platform} className="group relative overflow-hidden rounded-lg border border-primary/20 bg-primary/4 hover:border-primary/30 hover:bg-primary/8 transition-all p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Shield className="w-3 h-3 text-green-500 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wide truncate">{platform}</span>
            </div>
            {profile.displayName && <div className="text-xs text-muted-foreground truncate">{profile.displayName}</div>}
            {profile.followers !== undefined && profile.followers !== null && (
              <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                <span className="text-primary font-bold font-mono">{profile.followers.toLocaleString()}</span> متابع
              </div>
            )}
            {profile.url && (
              <a href={profile.url} target="_blank" rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-500 font-mono" dir="ltr">
                فتح الرابط <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotFoundPlatforms({ entries }: { entries: [string, ProfileEntry][] }) {
  if (entries.length === 0) return null;
  return (
    <details className="mt-2 group">
      <summary className="text-[10px] text-muted-foreground/50 font-medium cursor-pointer hover:text-muted-foreground transition-colors flex items-center gap-1.5 py-1">
        <Search className="w-3 h-3" />
        المنصات غير المُكتشفة ({entries.length})
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {entries.map(([platform]) => (
          <span key={platform} className="text-[10px] px-2 py-0.5 rounded bg-secondary/20 border border-border/20 text-muted-foreground/40 font-mono uppercase">{platform}</span>
        ))}
      </div>
    </details>
  );
}
