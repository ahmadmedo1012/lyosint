import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GraphVisualization } from "@/components/graph-visualization";
import { TimelineVisualization } from "@/components/timeline-visualization";
import {
  ArrowRight, ChevronLeft, Download, User, Phone, AtSign,
  Mail, Building2, Globe, Github, Twitter, Facebook, Instagram,
  Shield, Clock, Target, AlertTriangle, ExternalLink, Copy,
  CheckCircle2, Linkedin, RefreshCw, XCircle, FileText, Tag,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type ConfidenceLevel = "confirmed" | "probable" | "possible" | "weak";

interface Entity {
  id: string;
  label: string;
  status: string;
  confidenceScore: number;
  riskScore: number;
  summary: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Identifier {
  id: string;
  type: string;
  value: string;
  normalizedValue: string;
  confidenceScore: number;
  verified: boolean;
  source: string | null;
}

interface Profile {
  id: string;
  platform: string;
  url: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  confidenceScore: number;
}

interface EvidenceItem {
  id: string;
  type: string;
  source: string;
  platform: string | null;
  rawValue: string | null;
  normalizedValue: string | null;
  confidenceScore: number;
  polarity: "supporting" | "conflicting" | "caution";
  description: string;
  timestamp: string;
}

interface TimelineEvent {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  source: string | null;
  platform: string | null;
  occurredAt: string;
}

interface Dossier {
  id: string;
  title: string;
  summary: string | null;
  confidenceScore: number;
  sections: Array<{ type: string; title: string; content: string }>;
  updatedAt: string;
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  twitter: Twitter, x: Twitter, github: Github, facebook: Facebook, instagram: Instagram, linkedin: Linkedin,
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "bg-blue-500/10 text-blue-600 border-blue-500/25",
  phone: "bg-green-500/10 text-green-600 border-green-500/25",
  username: "bg-purple-500/10 text-purple-600 border-purple-500/25",
  email: "bg-amber-500/10 text-amber-600 border-amber-500/25",
  organization: "bg-rose-500/10 text-rose-600 border-rose-500/25",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0">
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function identifierTypeIcon(type: string) {
  switch (type) {
    case "phone": return <Phone className="w-3 h-3 text-green-500" />;
    case "email": return <Mail className="w-3 h-3 text-blue-600" />;
    case "username": return <AtSign className="w-3 h-3 text-purple-600" />;
    case "name": return <User className="w-3 h-3 text-amber-600" />;
    default: return <Tag className="w-3 h-3 text-muted-foreground" />;
  }
}

function confidenceLabel(score: number): { label: string; level: ConfidenceLevel; color: string } {
  if (score >= 90) return { label: "مؤكد", level: "confirmed", color: "text-green-600" };
  if (score >= 70) return { label: "مرجح", level: "probable", color: "text-blue-600" };
  if (score >= 50) return { label: "محتمل", level: "possible", color: "text-amber-600" };
  return { label: "ضعيف", level: "weak", color: "text-red-600" };
}

function deriveEntityType(identifiers: Identifier[]): string {
  if (identifiers.some(i => i.type === "phone")) return "phone";
  if (identifiers.some(i => i.type === "email")) return "email";
  if (identifiers.some(i => i.type === "username")) return "username";
  if (identifiers.some(i => i.type === "name")) return "person";
  return "person";
}

const TYPE_LABEL: Record<string, string> = {
  person: "شخص", phone: "هاتف", username: "معرّف", email: "بريد", organization: "مؤسسة",
};

export default function EntityDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/api/entities/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { entity: Entity; identifiers: Identifier[]; profiles: Profile[]; evidence: EvidenceItem[]; timeline: TimelineEvent[] }) => {
        setEntity(data.entity);
        setIdentifiers(data.identifiers);
        setProfiles(data.profiles);
        setEvidence(data.evidence);
        setTimeline(data.timeline.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));
        setLoading(false);
      })
      .catch(() => { setError("تعذّر تحميل الكيان"); setLoading(false); });
  }, [id]);

  const loadDossier = () => {
    if (!id) return;
    setDossierLoading(true);
    fetch(`${API}/api/entities/${id}/dossier`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Dossier) => { setDossier(data); setDossierLoading(false); })
      .catch(() => setDossierLoading(false));
  };

  const regenerateDossier = () => {
    if (!id) return;
    setDossierLoading(true);
    fetch(`${API}/api/entities/${id}/dossier/regenerate`, { method: "POST" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Dossier) => { setDossier(data); setDossierLoading(false); })
      .catch(() => setDossierLoading(false));
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[40vh]">
          <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (error || !entity) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center gap-4 min-h-[40vh]">
          <XCircle className="w-8 h-8 text-muted-foreground" />
          <p className="text-muted-foreground">{error ?? "كيان غير موجود"}</p>
          <Button variant="outline" onClick={() => setLocation("/")}>العودة للرئيسية</Button>
        </div>
      </PageTransition>
    );
  }

  const entityType = deriveEntityType(identifiers);
  const conf = confidenceLabel(entity.confidenceScore ?? 0);
  const supporting = evidence.filter(e => e.polarity === "supporting").length;
  const conflicting = evidence.filter(e => e.polarity === "conflicting").length;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-5" dir="rtl">
        {/* Back */}
        <button onClick={() => setLocation("/")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> العودة للرئيسية
        </button>

        {/* Entity Header */}
        <div className="rounded-xl border border-border/30 bg-card px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                {entity.avatarUrl
                  ? <img src={entity.avatarUrl} className="w-full h-full rounded-xl object-cover" alt={entity.label} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <User className="w-7 h-7 text-primary" />
                }
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] font-mono border ${ENTITY_TYPE_COLORS[entityType] || ""}`}>{TYPE_LABEL[entityType]}</Badge>
                  {entity.riskScore > 0 && (
                    <Badge className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30 font-mono">درجة خطورة: {entity.riskScore}%</Badge>
                  )}
                  <Badge variant="outline" className={`text-xs font-mono ${conf.color} border-current`}>
                    <Shield className="w-3 h-3 ml-1" />
                    {entity.confidenceScore ?? 0}% — {conf.label}
                  </Badge>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold" dir="auto">{entity.label}</h1>
                <div className="text-xs text-muted-foreground font-mono">{id}</div>
                {entity.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2" dir="auto">{entity.summary}</p>}
              </div>
            </div>
            <Button className="gap-2" onClick={() => { if (!dossier) loadDossier(); }}>
              <Download className="w-4 h-4" /> تصدير ملف
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "الأدلة الداعمة", value: supporting, icon: CheckCircle2, color: "text-green-600" },
            { label: "الأدلة المتضاربة", value: conflicting, icon: XCircle, color: "text-red-600" },
            { label: "أحداث الجدول", value: timeline.length, icon: Clock, color: "text-blue-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border/20 bg-card px-4 py-3 text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <div className="text-lg font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Identifiers */}
            <Card className="border-border/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Target className="w-3 h-3 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">المعرفات</h3>
                </div>
                <div className="space-y-0 divide-y divide-border/10">
                  {(["phone", "email", "username", "name"] as const).map((group) => {
                    const items = identifiers.filter(i => i.type === group);
                    if (items.length === 0) return null;
                    return (
                      <div key={group} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 font-medium">
                          {identifierTypeIcon(group)}
                          {group === "phone" ? "هواتف" : group === "email" ? "بريد إلكتروني" : group === "username" ? "معرفات" : "أسماء"}
                        </div>
                        {items.map((item) => (
                          <div key={item.value} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-sm font-mono" dir="ltr">{item.value}</span>
                              <CopyButton text={item.value} />
                              {item.verified && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-mono font-bold tabular-nums ${item.confidenceScore > 80 ? "text-green-600" : "text-amber-600"}`}>
                                {Math.round(item.confidenceScore)}%
                              </span>
                              {item.source && <Badge variant="outline" className="text-[9px] font-mono">{item.source}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {identifiers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد معرّفات</p>}
                </div>
              </CardContent>
            </Card>

            {/* Profiles */}
            {profiles.length > 0 && (
              <Card className="border-border/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Globe className="w-3 h-3 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">حسابات التواصل</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {profiles.map((p) => {
                      const Icon = PLATFORM_ICONS[p.platform.toLowerCase()];
                      return (
                        <div key={p.id || p.platform}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20 hover:border-border/40 hover:bg-secondary/30 transition-all">
                          <div className="flex items-center gap-3">
                            {Icon ? <Icon className="w-4 h-4 text-primary" /> : <Globe className="w-4 h-4 text-muted-foreground" />}
                            <div>
                              <div className="text-sm font-medium">{p.platform}</div>
                              {p.username && <div className="text-[11px] text-muted-foreground font-mono">@{p.username}</div>}
                              {p.displayName && <div className="text-xs text-muted-foreground" dir="auto">{p.displayName}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {p.verified && <Badge className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/25">موثق</Badge>}
                            {p.url && (
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Evidence */}
            {evidence.length > 0 && (
              <Card className="border-border/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Shield className="w-3 h-3 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">الأدلة</h3>
                  </div>
                  <div className="space-y-2">
                    {evidence.map((ev) => {
                      const polarityColor = ev.polarity === "supporting" ? "text-green-600" : ev.polarity === "conflicting" ? "text-red-600" : "text-amber-600";
                      const polarityLabel = ev.polarity === "supporting" ? "داعم" : ev.polarity === "conflicting" ? "متضارب" : "تنبيه";
                      return (
                        <div key={ev.id} className="flex items-start justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm" dir="auto">{ev.description}</span>
                              <Badge className={`text-[9px] font-mono border ${polarityColor} border-current/30`}>{polarityLabel}</Badge>
                              {ev.source && <Badge variant="outline" className="text-[9px] font-mono">{ev.source}</Badge>}
                            </div>
                            <div className="text-[10px] text-muted-foreground/60 font-mono">
                              {new Date(ev.timestamp).toLocaleDateString("ar-LY")}
                            </div>
                          </div>
                          <span className={`text-sm font-bold font-mono tabular-nums shrink-0 mr-3 ${ev.confidenceScore > 80 ? "text-green-600" : "text-amber-600"}`}>
                            {Math.round(ev.confidenceScore)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
              <Card className="border-border/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Clock className="w-3 h-3 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">النشاط الزمني</h3>
                  </div>
                  <TimelineVisualization
                    events={timeline.map(ev => ({
                      date: ev.occurredAt,
                      title: ev.title,
                      description: ev.description || "",
                      confidence: ev.source ? 80 : 50,
                    }))}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Confidence */}
            <Card className="border-border/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">ملخص الثقة</h3>
                </div>
                <div className="text-center mb-3">
                  <div className={`text-3xl font-bold font-mono tabular-nums ${conf.color}`}>{entity.confidenceScore}%</div>
                  <div className="text-[11px] text-muted-foreground">متوسط الثقة الإجمالي</div>
                </div>
                <div className="border-t border-border/10 my-3" />
                <div className="space-y-2 text-xs">
                  {[
                    { label: "ثقة الكيان", value: entity.confidenceScore },
                    ...identifiers.slice(0, 4).map(i => ({
                      label: `تطابق ${i.type}`,
                      value: Math.round(i.confidenceScore),
                    })),
                  ].slice(0, 5).map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{f.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full rounded-full ${f.value > 80 ? "bg-green-500" : f.value > 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${f.value}%` }} />
                        </div>
                        <span className="font-mono font-bold tabular-nums w-8 text-left">{f.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Dossier */}
            <Card className="border-border/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">الملف الاستخباراتي</h3>
                </div>
                {dossierLoading && (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                  </div>
                )}
                {!dossierLoading && !dossier && (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-muted-foreground">لم يتم توليد الملف بعد</p>
                    <Button size="sm" onClick={loadDossier}>توليد الملف</Button>
                  </div>
                )}
                {dossier && !dossierLoading && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">آخر تحديث: {new Date(dossier.updatedAt).toLocaleDateString("ar-LY")}</div>
                    <h4 className="font-bold text-sm" dir="auto">{dossier.title}</h4>
                    {dossier.summary && <p className="text-xs text-muted-foreground line-clamp-2" dir="auto">{dossier.summary}</p>}
                    <Button size="sm" variant="outline" className="w-full gap-1" onClick={regenerateDossier} disabled={dossierLoading}>
                      <RefreshCw className={`w-3 h-3 ${dossierLoading ? "animate-spin" : ""}`} /> إعادة التوليد
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
