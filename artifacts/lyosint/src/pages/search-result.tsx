import { useParams } from "wouter";
import { useGetSearchStatus, getGetSearchStatusQueryKey, useGetSearchResult } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { User, Phone, AtSign, CheckCircle2, AlertTriangle, XCircle, Loader2, ExternalLink, MapPin, Network, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_LABELS: Record<string, string> = {
  name: "اسم",
  phone: "هاتف",
  username: "مستخدم",
  deep: "شامل",
};

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct > 75 ? "text-green-500" : pct > 40 ? "text-amber-500" : "text-destructive";
  const glowColor = pct > 75 ? "rgba(34,197,94,0.4)" : pct > 40 ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)";
  return (
    <div className="bg-card border border-border rounded-lg p-3 sm:p-4 flex items-center justify-between border-glow">
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">درجة موثوقية الهدف</span>
        <span className="sm:hidden">الموثوقية</span>
      </div>
      <div
        className={`text-2xl sm:text-3xl font-mono font-bold ${color}`}
        style={{ textShadow: `0 0 20px ${glowColor}` }}
      >
        {pct}%
      </div>
    </div>
  );
}

export default function SearchResultPage() {
  const { id } = useParams();

  const { data: statusData } = useGetSearchStatus(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetSearchStatusQueryKey(id!),
      refetchInterval: (data) => {
        if (data?.status === "completed" || data?.status === "failed") return false;
        return 1500;
      },
    },
  });

  const isCompleted = statusData?.status === "completed";
  const isFailed = statusData?.status === "failed";
  const isRunning = statusData?.status === "running" || statusData?.status === "pending";

  const { data: resultData, isLoading: resultLoading } = useGetSearchResult(id!, {
    query: { enabled: !!id && isCompleted },
  });

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-8 sm:pb-12 page-transition" dir="rtl">
      <div className="flex items-start justify-between border-b border-border/50 pb-4 sm:pb-5 gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-primary uppercase tracking-wider font-mono text-glow break-all">
              ملف: <span dir="auto">{statusData?.query || "..."}</span>
            </h1>
            {statusData?.type && (
              <Badge variant="outline" className="font-mono uppercase text-[10px] border-primary/50 text-primary shrink-0">
                {TYPE_LABELS[statusData.type] ?? statusData.type}
              </Badge>
            )}
          </div>
          <div className="text-xs font-mono text-muted-foreground mt-1.5 uppercase tracking-wider break-all">
            <span className="hidden sm:inline">معرّف المهمة: </span>
            <span className="text-foreground/60">{id}</span>
          </div>
        </div>
        <div className="shrink-0">
          {isRunning && (
            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/40 uppercase font-mono animate-pulse gap-1.5 text-[10px] sm:text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">جاري التنفيذ</span>
              <span className="sm:hidden">جاري</span>
            </Badge>
          )}
          {isCompleted && (
            <Badge className="bg-green-500/15 text-green-400 border border-green-500/40 uppercase font-mono text-[10px] sm:text-xs">
              مكتمل
            </Badge>
          )}
          {isFailed && (
            <Badge variant="destructive" className="uppercase font-mono text-[10px] sm:text-xs">
              فاشل
            </Badge>
          )}
        </div>
      </div>

      {isRunning && (
        <Card className="bg-secondary/20 border-primary/25 border-glow">
          <CardContent className="pt-5 sm:pt-6 space-y-4 sm:space-y-5">
            <div className="flex justify-between items-center text-sm uppercase">
              <span className="text-muted-foreground flex items-center gap-2 font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="hidden sm:inline">فحص الشبكات...</span>
                <span className="sm:hidden">فحص...</span>
              </span>
              <span className="text-primary font-bold font-mono text-lg text-glow">
                {statusData?.progress || 0}%
              </span>
            </div>
            <Progress
              value={statusData?.progress || 0}
              className="h-1.5 bg-secondary"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase">
              <span>مفحوص: {statusData?.platformsSearched || 0}</span>
              <span>الإجمالي: {statusData?.platformsTotal || 0}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isFailed && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-5 sm:pt-6 flex items-center gap-3 sm:gap-4 text-destructive">
            <XCircle className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <div>
              <div className="font-bold uppercase tracking-wider text-base sm:text-lg font-mono">فشلت العملية</div>
              <div className="text-sm opacity-80 mt-1">تعذّر إتمام جمع المعلومات الاستخباراتية لهذا الهدف.</div>
            </div>
          </CardContent>
        </Card>
      )}

      {isCompleted && resultLoading && (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full bg-secondary/30" />
          <Skeleton className="h-52 w-full bg-secondary/30" />
        </div>
      )}

      {isCompleted && resultData && (
        <div className="space-y-4 sm:space-y-6 page-transition">
          {resultData.confidenceScore !== undefined && resultData.confidenceScore !== null && (
            <ConfidenceBar score={resultData.confidenceScore} />
          )}

          {resultData.nameResult && (
            <Card className="border-primary/20 bg-card border-glow">
              <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3 sm:pb-4">
                <CardTitle className="text-sm uppercase text-foreground flex items-center gap-2 font-mono">
                  <User className="w-4 h-4 text-primary" /> معلومات شخصية
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">الاسم الكامل</div>
                    <div className="text-base sm:text-lg font-bold text-foreground" dir="auto">{resultData.nameResult.fullName || "غير محدد"}</div>
                  </div>
                  {resultData.nameResult.possibleVariations && resultData.nameResult.possibleVariations.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">الأسماء المشابهة</div>
                      <div className="flex flex-wrap gap-2">
                        {resultData.nameResult.possibleVariations.map((alias) => (
                          <Badge key={alias} variant="secondary" className="font-mono text-xs" dir="ltr">{alias}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {resultData.nameResult.associatedNames && resultData.nameResult.associatedNames.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">أسماء مرتبطة</div>
                      <div className="flex flex-wrap gap-2">
                        {resultData.nameResult.associatedNames.map((n) => (
                          <Badge key={n} variant="outline" className="text-xs" dir="auto">{n}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {resultData.nameResult.phoneNumbers && resultData.nameResult.phoneNumbers.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> أرقام الهاتف
                      </div>
                      <ul className="space-y-1.5">
                        {resultData.nameResult.phoneNumbers.map((phone) => (
                          <li key={phone} className="text-primary font-mono text-sm" dir="ltr">{phone}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {resultData.nameResult.addresses && resultData.nameResult.addresses.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> المواقع الجغرافية
                      </div>
                      <ul className="space-y-2">
                        {resultData.nameResult.addresses.map((addr) => (
                          <li key={addr} className="bg-secondary/40 px-3 py-2 rounded border border-border/40 text-sm" dir="auto">{addr}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {resultData.nameResult.regionHint && (
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">المنطقة المحتملة</div>
                      <div className="text-sm text-foreground/80 font-mono">{resultData.nameResult.regionHint}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {resultData.phoneResult && (
            <Card className="border-primary/20 bg-card border-glow">
              <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3 sm:pb-4">
                <CardTitle className="text-sm uppercase text-foreground flex items-center gap-2 font-mono">
                  <Phone className="w-4 h-4 text-primary" /> بيانات الاتصالات
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-xl sm:text-2xl font-bold text-foreground font-mono break-all" dir="ltr">
                      {resultData.phoneResult.nationalFormat || resultData.phoneResult.phone}
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs uppercase ${resultData.phoneResult.valid ? "text-green-500 border-green-500/50" : "text-destructive border-destructive"}`}
                    >
                      {resultData.phoneResult.valid ? "صالح" : "غير صالح"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/30 p-3 rounded border border-border/50">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">المشغّل</div>
                      <div className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                        <Network className="w-3 h-3 text-primary shrink-0" />
                        <span className={`break-all ${
                          resultData.phoneResult.carrier?.includes("Madar") ? "text-blue-400" :
                          resultData.phoneResult.carrier?.includes("Libyana") ? "text-purple-400" : "text-foreground"
                        }`}>
                          {resultData.phoneResult.carrier || "غير محدد"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-secondary/30 p-3 rounded border border-border/50">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">نوع الخط</div>
                      <div className="text-sm font-bold font-mono">{resultData.phoneResult.lineType || "غير محدد"}</div>
                    </div>
                  </div>
                  {(resultData.phoneResult.possibleOwner || resultData.phoneResult.possibleOwnerEn) && (
                    <div className="bg-primary/5 p-3 sm:p-4 rounded border border-primary/20 border-glow">
                      <div className="text-[10px] font-mono text-primary uppercase mb-2 flex items-center gap-1">
                        <User className="w-3 h-3" /> المالك المحتمل
                      </div>
                      <div className="text-base sm:text-lg font-medium" dir="rtl">{resultData.phoneResult.possibleOwner}</div>
                      {resultData.phoneResult.possibleOwnerEn && (
                        <div className="text-sm text-muted-foreground mt-1 font-mono" dir="ltr">{resultData.phoneResult.possibleOwnerEn}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-4 sm:space-y-5">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-2">المنصات المرتبطة</div>
                    <div className="flex gap-2 sm:gap-3 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs px-2.5 sm:px-3 py-1.5 ${resultData.phoneResult.whatsapp ? "bg-green-500/10 text-green-400 border-green-500/40" : "opacity-35"}`}
                      >
                        WhatsApp {resultData.phoneResult.whatsapp ? "✓" : "✗"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs px-2.5 sm:px-3 py-1.5 ${resultData.phoneResult.telegramRegistered ? "bg-blue-500/10 text-blue-400 border-blue-500/40" : "opacity-35"}`}
                      >
                        Telegram {resultData.phoneResult.telegramRegistered ? "✓" : "✗"}
                      </Badge>
                    </div>
                  </div>
                  {resultData.phoneResult.region && (
                    <div className="bg-secondary/30 p-3 rounded border border-border/40">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">المنطقة الجغرافية</div>
                      <div className="text-sm font-mono">{resultData.phoneResult.region}</div>
                    </div>
                  )}
                  {resultData.phoneResult.breachInfo && resultData.phoneResult.breachInfo.length > 0 && (
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded p-3">
                      <div className="text-[10px] font-mono text-amber-500 uppercase mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> تسريبات البيانات
                      </div>
                      <ul className="text-xs font-mono text-amber-400/80 space-y-1">
                        {resultData.phoneResult.breachInfo.map((b) => <li key={b}>{b}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {resultData.usernameResult && (
            <Card className="border-primary/20 bg-card border-glow">
              <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3 sm:pb-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm uppercase text-foreground flex items-center gap-2 font-mono">
                    <AtSign className="w-4 h-4 text-primary" /> البصمة الرقمية
                  </CardTitle>
                  <div className="text-xs font-mono text-muted-foreground">
                    <span className="text-primary font-bold">{resultData.usernameResult.totalFound}</span>
                    <span> / {resultData.usernameResult.totalPlatformsSearched} منصة</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6">
                {resultData.usernameResult.possibleEmail && (
                  <div className="mb-4 sm:mb-5 bg-secondary/30 px-3 sm:px-4 py-2.5 rounded border border-border/40 inline-block max-w-full">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase ml-2">البريد المحتمل:</span>
                    <span className="text-primary font-mono text-sm break-all" dir="ltr">{resultData.usernameResult.possibleEmail}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                  {resultData.usernameResult.profilesFound && Object.entries(resultData.usernameResult.profilesFound).map(([platform, profile]) => (
                    <div
                      key={platform}
                      className={`p-3 rounded border font-mono transition-all duration-200 ${
                        profile.exists
                          ? "bg-primary/5 border-primary/25 hover:border-primary/50 hover:bg-primary/10 group"
                          : "bg-secondary/10 border-border/20 opacity-40 grayscale"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{platform}</span>
                      </div>
                      {profile.exists ? (
                        <div className="space-y-1 text-xs">
                          {profile.displayName && (
                            <div className="text-foreground/80 truncate">{profile.displayName}</div>
                          )}
                          {profile.followers !== undefined && profile.followers !== null && (
                            <div className="text-muted-foreground">
                              <span className="text-primary font-bold">{profile.followers.toLocaleString("ar")}</span> متابع
                            </div>
                          )}
                          {profile.url && (
                            <a
                              href={profile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
                              dir="ltr"
                            >
                              رابط <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase">غير موجود</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
