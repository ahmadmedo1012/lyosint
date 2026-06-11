import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GraphVisualization } from "@/components/graph-visualization";
import { TimelineVisualization } from "@/components/timeline-visualization";
import {
  ArrowRight, ChevronLeft, Download, User, Phone, AtSign,
  Mail, Building2, Globe, Github, Twitter, Facebook, Instagram,
  Shield, Clock, Target, AlertTriangle, ExternalLink, Copy,
  CheckCircle2, Linkedin,
} from "lucide-react";

interface Identifier { type: string; value: string; confidence: number; source: string; }
interface Profile { platform: string; url: string; verified: boolean; followers?: number; }
interface EvidenceItem { id: string; title: string; confidence: number; source: string; date: string; summary: string; }
interface TimelineEvent { date: string; title: string; description: string; confidence: number; }
interface RelatedEntity { id: string; label: string; type: string; relationship: string; confidence: number; }

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  twitter: Twitter, x: Twitter, github: Github, facebook: Facebook, instagram: Instagram, linkedin: Linkedin,
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  phone: "bg-green-500/10 text-green-400 border-green-500/25",
  username: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  email: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  organization: "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

const MOCK_IDENTIFIERS: Identifier[] = [
  { type: "phone", value: "+218 91 234 5678", confidence: 95, source: "قاعدة بيانات اتصالات" },
  { type: "phone", value: "+218 92 876 5432", confidence: 72, source: "تسريب بيانات" },
  { type: "email", value: "ahmed.ali@example.com", confidence: 88, source: "تسريب 2024" },
  { type: "email", value: "ahmed_work@company.ly", confidence: 65, source: "موقع شركة" },
  { type: "username", value: "ahmed_ali", confidence: 95, source: "تيليغرام" },
  { type: "username", value: "ahmed_ali_tech", confidence: 78, source: "GitHub" },
];
const MOCK_PROFILES: Profile[] = [
  { platform: "Telegram", url: "https://t.me/ahmed_ali", verified: false },
  { platform: "X", url: "https://x.com/ahmed_ali", verified: true, followers: 1240 },
  { platform: "GitHub", url: "https://github.com/ahmed_ali", verified: false, followers: 89 },
  { platform: "Facebook", url: "https://facebook.com/ahmed.ali", verified: false },
  { platform: "LinkedIn", url: "https://linkedin.com/in/ahmed-ali", verified: true, followers: 512 },
];
const MOCK_EVIDENCE: EvidenceItem[] = [
  { id: "ev-1", title: "حساب تيليغرام نشط", confidence: 95, source: "Telegram", date: "2026-06-10", summary: "حساب مرتبط بالهدف ينشر محتوى تقني" },
  { id: "ev-2", title: "رقم هاتف في قاعدة بيانات مشغل", confidence: 92, source: "Phone DB", date: "2026-06-09", summary: "الرقم مسجل باسم الهدف" },
  { id: "ev-3", title: "بريد إلكتروني مسرب", confidence: 85, source: "BreachDB", date: "2026-06-07", summary: "بريد إلكتروني مسرب في اختراق 2024" },
];
const MOCK_EVENTS: TimelineEvent[] = [
  { date: "2026-06-10", title: "رصد حساب تيليغرام", description: "تم اكتشاف حساب تيليغرام مرتبط بالهدف", confidence: 95 },
  { date: "2026-06-09", title: "تحقق من رقم الهاتف", description: "تأكيد ملكية رقم الهاتف", confidence: 92 },
  { date: "2026-06-07", title: "اكتشاف تسريب بيانات", description: "العثور على البريد الإلكتروني", confidence: 85 },
];
const MOCK_RELATED: RelatedEntity[] = [
  { id: "ent-6", label: "علي محمد أحمد", type: "person", relationship: "شقيق", confidence: 82 },
  { id: "ent-7", label: "+218 91 234 5679", type: "phone", relationship: "رقم متصل", confidence: 75 },
  { id: "ent-8", label: "LibyaTech Solutions", type: "organization", relationship: "موظف", confidence: 88 },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0">
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function EntityDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  return (
    <PageTransition>
      <div className="space-y-5" dir="rtl">
        {/* Back */}
        <button onClick={() => setLocation("/investigations")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" /> العودة للتحقيقات
        </button>

        {/* Entity Header */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card px-5 py-4">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] font-mono border ${ENTITY_TYPE_COLORS.person}`}>شخص</Badge>
                  <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 font-mono">درجة خطورة: 85%</Badge>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold">أحمد علي محمد</h1>
                <div className="text-xs text-muted-foreground font-mono">{id}</div>
              </div>
            </div>
            <Button className="gap-2" onClick={() => setLocation("/dossier/entity-1")}>
              <Download className="w-4 h-4" /> تصدير ملف
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Identifiers */}
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Target className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">المعرفات</h3>
                </div>
                <div className="space-y-0 divide-y divide-border/20">
                  {(["phone", "email", "username"] as const).map((group) => {
                    const items = MOCK_IDENTIFIERS.filter(i => i.type === group);
                    if (items.length === 0) return null;
                    return (
                      <div key={group} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">
                          {group === "phone" && <Phone className="w-3 h-3" />}
                          {group === "email" && <Mail className="w-3 h-3" />}
                          {group === "username" && <AtSign className="w-3 h-3" />}
                          {group === "phone" ? "هواتف" : group === "email" ? "بريد إلكتروني" : "معرفات"}
                        </div>
                        {items.map((item) => (
                          <div key={item.value} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-sm font-mono" dir="ltr">{item.value}</span>
                              <CopyButton text={item.value} />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-mono font-bold tabular-nums ${item.confidence > 80 ? "text-green-400" : "text-amber-400"}`}>
                                {item.confidence}%
                              </span>
                              <Badge variant="outline" className="text-[9px] font-mono">{item.source}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Profiles */}
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">حسابات التواصل</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MOCK_PROFILES.map((p) => {
                    const Icon = PLATFORM_ICONS[p.platform.toLowerCase()];
                    return (
                      <a key={p.platform} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/30 hover:border-primary/30 hover:bg-primary/4 transition-all">
                        <div className="flex items-center gap-3">
                          {Icon ? <Icon className="w-4 h-4 text-primary" /> : <Globe className="w-4 h-4 text-muted-foreground" />}
                          <div>
                            <div className="text-sm font-medium">{p.platform}</div>
                            {p.followers && <div className="text-[10px] text-muted-foreground">{p.followers.toLocaleString()} متابع</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.verified && <Badge className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/25">موثق</Badge>}
                          <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Evidence */}
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">الأدلة</h3>
                </div>
                <div className="space-y-2">
                  {MOCK_EVIDENCE.map((ev) => (
                    <div key={ev.id} className="flex items-start justify-between p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{ev.title}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">{ev.source}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{ev.summary}</p>
                        <div className="text-[10px] text-muted-foreground/60 font-mono">{ev.date}</div>
                      </div>
                      <span className={`text-sm font-bold font-mono tabular-nums shrink-0 mr-3 ${ev.confidence > 80 ? "text-green-400" : "text-amber-400"}`}>
                        {ev.confidence}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">النشاط الزمني</h3>
                </div>
                <TimelineVisualization events={MOCK_EVENTS} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Confidence */}
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold">ملخص الثقة</h3>
                </div>
                <div className="text-center mb-3">
                  <div className="text-3xl font-black font-mono text-green-400 tabular-nums">92%</div>
                  <div className="text-[11px] text-muted-foreground">متوسط الثقة الإجمالي</div>
                </div>
                <Separator className="my-3" />
                <div className="space-y-2 text-xs">
                  {[
                    { label: "تطابق الاسم", value: 95 },
                    { label: "تطابق الهاتف", value: 92 },
                    { label: "تطابق البريد", value: 88 },
                    { label: "نشاط التواصل", value: 85 },
                    { label: "تسريبات", value: 76 },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{f.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full rounded-full ${f.value > 80 ? "bg-green-500" : f.value > 50 ? "bg-amber-500" : "bg-destructive"}`}
                            style={{ width: `${f.value}%` }} />
                        </div>
                        <span className="font-mono font-bold tabular-nums w-8 text-left">{f.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Relationships Graph */}
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold">العلاقات</h3>
                </div>
                <div className="h-[200px] rounded-lg border border-border/30 bg-card overflow-hidden mb-3">
                  <GraphVisualization
                    nodes={[
                      { id: "ent-1", label: "أحمد علي", type: "person", confidence: 95 },
                      ...MOCK_RELATED.map(r => ({ id: r.id, label: r.label, type: r.type, confidence: r.confidence })),
                    ]}
                    edges={MOCK_RELATED.map(r => ({ source: "ent-1", target: r.id, type: r.relationship, label: r.relationship }))}
                    height={180}
                  />
                </div>
                <div className="space-y-1.5">
                  {MOCK_RELATED.map((r) => (
                    <button key={r.id} onClick={() => setLocation(`/entity/${r.id}`)}
                      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-secondary/20 transition-colors text-xs">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[8px] font-mono border ${ENTITY_TYPE_COLORS[r.type] || ""}`}>
                          {r.type === "person" ? "شخص" : r.type === "phone" ? "هاتف" : "مؤسسة"}
                        </Badge>
                        <span className="font-medium">{r.label}</span>
                      </div>
                      <span className="text-muted-foreground">{r.relationship}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Similar Entities */}
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold">كيانات مشابهة</h3>
                </div>
                <div className="space-y-1.5 text-xs">
                  {[
                    { name: "أحمد علي محمد (2)", match: 87 },
                    { name: "Ahmed Ali", match: 72 },
                    { name: "أحمد علي المصراتي", match: 65 },
                  ].map((s) => (
                    <div key={s.name} className="flex items-center justify-between p-2 rounded-md bg-secondary/20 border border-border/20">
                      <span className="font-mono truncate">{s.name}</span>
                      <span className="font-bold font-mono tabular-nums text-amber-400">{s.match}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
