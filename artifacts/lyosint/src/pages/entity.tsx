import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Shield, Clock, Network, FileText, Database,
  ExternalLink, CheckCircle2, AlertTriangle, XCircle,
  Copy, RefreshCw, Merge, ChevronRight, Phone, AtSign,
  Mail, Globe, Activity, Tag, Eye
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

function confidenceLabel(score: number): { label: string; level: ConfidenceLevel; color: string } {
  if (score >= 90) return { label: "مؤكد", level: "confirmed", color: "text-green-400" };
  if (score >= 70) return { label: "مرجح", level: "probable", color: "text-blue-400" };
  if (score >= 50) return { label: "محتمل", level: "possible", color: "text-amber-400" };
  return { label: "ضعيف", level: "weak", color: "text-red-400" };
}

function polarityIcon(polarity: string) {
  if (polarity === "supporting") return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
  if (polarity === "conflicting") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
}

function identifierIcon(type: string) {
  switch (type) {
    case "phone": return <Phone className="w-3.5 h-3.5 text-green-400" />;
    case "email": return <Mail className="w-3.5 h-3.5 text-blue-400" />;
    case "username": return <AtSign className="w-3.5 h-3.5 text-purple-400" />;
    case "name": return <User className="w-3.5 h-3.5 text-amber-400" />;
    default: return <Tag className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 text-muted-foreground/40 hover:text-primary transition-colors shrink-0">
      {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function EntityPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("summary");
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
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">جارٍ تحميل الكيان الاستخباراتي…</span>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error || !entity) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center gap-4 min-h-[40vh]">
          <XCircle className="w-10 h-10 text-destructive" />
          <p className="text-muted-foreground">{error ?? "كيان غير موجود"}</p>
          <Button variant="outline" onClick={() => navigate("/entities")}>العودة للكيانات</Button>
        </div>
      </PageTransition>
    );
  }

  const conf = confidenceLabel(entity.confidenceScore ?? 0);
  const supporting = evidence.filter(e => e.polarity === "supporting").length;
  const conflicting = evidence.filter(e => e.polarity === "conflicting").length;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6" dir="rtl">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            {entity.avatarUrl
              ? <img src={entity.avatarUrl} className="w-full h-full rounded-2xl object-cover" alt={entity.label} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <User className="w-7 h-7 text-primary" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate" dir="auto">{entity.label}</h1>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Badge variant="outline" className={`text-xs font-mono ${conf.color} border-current`}>
                <Shield className="w-3 h-3 ml-1" />
                {entity.confidenceScore ?? 0}% — {conf.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Activity className="w-3 h-3 ml-1" />
                {identifiers.length} معرّف
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Eye className="w-3 h-3 ml-1" />
                {profiles.length} منصة
              </Badge>
            </div>
            {entity.summary && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{entity.summary}</p>}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "الأدلة الداعمة", value: supporting, icon: CheckCircle2, color: "text-green-400" },
            { label: "الأدلة المتضاربة", value: conflicting, icon: XCircle, color: "text-red-400" },
            { label: "أحداث الجدول", value: timeline.length, icon: Clock, color: "text-blue-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-card px-4 py-3 text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <div className="text-lg font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-5 h-auto">
            <TabsTrigger value="summary" className="text-xs py-2">ملخص</TabsTrigger>
            <TabsTrigger value="profiles" className="text-xs py-2">الملفات</TabsTrigger>
            <TabsTrigger value="evidence" className="text-xs py-2">الأدلة</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs py-2">الجدول</TabsTrigger>
            <TabsTrigger value="dossier" className="text-xs py-2" onClick={() => { if (!dossier) loadDossier(); }}>الملف</TabsTrigger>
          </TabsList>

          {/* Summary */}
          <TabsContent value="summary" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" /> المعرّفات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {identifiers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد معرّفات</p>}
                {identifiers.map((id) => (
                  <div key={id.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-2">
                      {identifierIcon(id.type)}
                      <span className="text-xs font-mono text-muted-foreground uppercase">{id.type}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
                      <span className="text-sm font-medium truncate" dir="auto">{id.value}</span>
                      <CopyBtn text={id.value} />
                      {id.verified && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{Math.round(id.confidenceScore * 100)}%</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profiles */}
          <TabsContent value="profiles" className="space-y-3 mt-4">
            {profiles.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد ملفات شخصية مكتشفة</div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {profiles.map((p) => (
                <div key={p.id} className="rounded-xl border border-border/50 bg-card p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{p.platform}</span>
                    <div className="flex items-center gap-1">
                      {p.verified && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  {p.username && <div className="text-xs text-muted-foreground font-mono">@{p.username}</div>}
                  {p.displayName && <div className="text-xs" dir="auto">{p.displayName}</div>}
                  {p.bio && <div className="text-xs text-muted-foreground line-clamp-2" dir="auto">{p.bio}</div>}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Evidence */}
          <TabsContent value="evidence" className="space-y-2 mt-4">
            {evidence.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد أدلة مسجّلة</div>
            )}
            {evidence.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5">
                {polarityIcon(e.polarity)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" dir="auto">{e.description}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">{e.type}</span>
                    {e.platform && <Badge variant="outline" className="text-xs py-0 px-1.5">{e.platform}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(e.timestamp).toLocaleDateString("ar-LY")}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{Math.round(e.confidenceScore * 100)}%</Badge>
              </div>
            ))}
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="mt-4">
            {timeline.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد أحداث في الجدول الزمني</div>
            )}
            <div className="relative space-y-0 border-r-2 border-border/30 mr-3">
              {timeline.map((event, i) => (
                <div key={event.id} className={`relative pr-5 pb-4 ${i === timeline.length - 1 ? "" : ""}`}>
                  <div className="absolute right-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-primary/60 border-2 border-background" />
                  <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium">{event.title}</span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {new Date(event.occurredAt).toLocaleDateString("ar-LY")}
                      </span>
                    </div>
                    {event.description && <p className="text-xs text-muted-foreground" dir="auto">{event.description}</p>}
                    {event.source && <Badge variant="outline" className="text-xs mt-1.5 py-0">{event.source}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Dossier */}
          <TabsContent value="dossier" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">الملف الاستخباراتي</span>
              <Button size="sm" variant="outline" onClick={regenerateDossier} disabled={dossierLoading}>
                <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${dossierLoading ? "animate-spin" : ""}`} />
                إعادة التوليد
              </Button>
            </div>
            {dossierLoading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
              </div>
            )}
            {!dossierLoading && !dossier && (
              <div className="text-center py-8 space-y-3">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">لم يتم توليد الملف بعد</p>
                <Button size="sm" onClick={loadDossier}>توليد الملف الاستخباراتي</Button>
              </div>
            )}
            {dossier && !dossierLoading && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
                  <div className="text-xs text-muted-foreground mb-1">آخر تحديث: {new Date(dossier.updatedAt).toLocaleDateString("ar-LY")}</div>
                  <h2 className="font-bold text-base" dir="auto">{dossier.title}</h2>
                  {dossier.summary && <p className="text-sm text-muted-foreground mt-1" dir="auto">{dossier.summary}</p>}
                </div>
                {(dossier.sections ?? []).map((section, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed" dir="auto">
                        {section.content}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
