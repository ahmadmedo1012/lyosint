import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { GraphVisualization } from "@/components/graph-visualization";
import { TimelineVisualization } from "@/components/timeline-visualization";
import { EvidencePanel } from "@/components/evidence-panel";
import {
  ArrowRight, Edit, XCircle, Download, Trash2, Target, Shield,
  FileText, GitFork, Clock, MessageSquare, User, Plus,
  ChevronLeft, AlertTriangle, CheckCircle2,
} from "lucide-react";

interface Entity {
  id: string; label: string; type: string; confidence: number; riskScore: number;
}
interface Evidence {
  id: string; title: string; source: string; sourceType: string; confidence: number; date: string; summary: string;
}
interface TimelineEvent {
  date: string; title: string; description: string; confidence: number;
}

const MOCK_ENTITIES: Entity[] = [
  { id: "ent-1", label: "أحمد علي محمد", type: "person", confidence: 92, riskScore: 85 },
  { id: "ent-2", label: "+218 91 234 5678", type: "phone", confidence: 88, riskScore: 75 },
  { id: "ent-3", label: "@ahmed_ali", type: "username", confidence: 95, riskScore: 70 },
  { id: "ent-4", label: "ahmed@example.com", type: "email", confidence: 78, riskScore: 60 },
  { id: "ent-5", label: " LibyaTech Co", type: "organization", confidence: 65, riskScore: 45 },
];
const MOCK_EVIDENCE: Evidence[] = [
  { id: "ev-1", title: "حساب تيليغرام نشط", source: "Telegram", sourceType: "messaging", confidence: 95, date: "2026-06-10", summary: "حساب مرتبط بالهدف ينشر محتوى تقني" },
  { id: "ev-2", title: "رقم هاتف في قاعدة بيانات", source: "Phone DB", sourceType: "database", confidence: 88, date: "2026-06-09", summary: "الرقم مسجل باسم الهدف في سجلات شركة اتصالات" },
  { id: "ev-3", title: "منشور فيسبوك", source: "Facebook", sourceType: "social", confidence: 82, date: "2026-06-08", summary: "منشور عام يذكر الهدف وموقعه" },
  { id: "ev-4", title: "تسريب بيانات", source: "BreachDB", sourceType: "breach", confidence: 76, date: "2026-06-07", summary: "بريد إلكتروني مسرب في اختراق 2024" },
  { id: "ev-5", title: "تغريدة على X", source: "X (Twitter)", sourceType: "social", confidence: 70, date: "2026-06-05", summary: "تغريدة من حساب يشبه الهدف" },
];
const MOCK_EVENTS: TimelineEvent[] = [
  { date: "2026-06-10", title: "رصد حساب تيليغرام", description: "تم اكتشاف حساب تيليغرام مرتبط بالهدف", confidence: 95 },
  { date: "2026-06-09", title: "تحقق من رقم الهاتف", description: "تأكيد ملكية رقم الهاتف عبر قاعدة بيانات", confidence: 88 },
  { date: "2026-06-08", title: "تحديد موقع جغرافي", description: "تحليل الميتاداتا يحدد موقع في طرابلس", confidence: 75 },
  { date: "2026-06-07", title: "اكتشاف تسريب بيانات", description: "العثور على البريد الإلكتروني في تسريب 2024", confidence: 76 },
  { date: "2026-06-05", title: "ربط حسابات التواصل", description: "ربط 3 حسابات على منصات مختلفة بنفس الهوية", confidence: 82 },
  { date: "2026-06-03", title: "بدء التحقيق", description: "فتح تحقيق بناء على بلاغ", confidence: 100 },
];

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  phone: "bg-green-500/10 text-green-400 border-green-500/25",
  username: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  email: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  organization: "bg-rose-500/10 text-rose-400 border-rose-500/25",
};
const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "شخص", phone: "هاتف", username: "معرّف", email: "بريد", organization: "مؤسسة",
};

function SectionHeader({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <h3 className="text-sm font-bold">{title}</h3>
      {count !== undefined && <Badge variant="secondary" className="text-[10px] font-mono">{count}</Badge>}
    </div>
  );
}

export default function InvestigationDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <PageTransition>
      <div className="space-y-5" dir="rtl">
        {/* Back */}
        <button onClick={() => setLocation("/investigations")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" /> العودة للتحقيقات
        </button>

        {/* Header */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card px-5 py-4">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/25">نشط</Badge>
                <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">حرج</Badge>
                <span className="text-xs text-muted-foreground font-mono">{id}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">تحليل شبكة الاتصالات - طرابلس</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> آخر تحديث: 2026-06-10</span>
                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> 12 كيان</span>
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 48 دليل</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5"><Edit className="w-3.5 h-3.5" /> تعديل</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-amber-400 border-amber-500/30"><AlertTriangle className="w-3.5 h-3.5" /> إغلاق</Button>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> تصدير</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30"><Trash2 className="w-3.5 h-3.5" /> حذف</Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start h-auto p-1 gap-1 bg-secondary/30 border border-border/40 rounded-xl overflow-x-auto">
            {["overview", "entities", "evidence", "timeline", "graph", "dossier"].map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs data-[state=active]:bg-card">
                {tab === "overview" && "نظرة عامة"}
                {tab === "entities" && "الكيانات"}
                {tab === "evidence" && "الأدلة"}
                {tab === "timeline" && "الخط الزمني"}
                {tab === "graph" && "الرسم البياني"}
                {tab === "dossier" && "الملف"}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border/40">
                  <CardHeader><CardTitle className="text-sm font-bold">ملخص التحقيق</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      تحقيق معمق في شبكة اتصالات مرتبطة بأهداف استخباراتية في منطقة طرابلس الكبرى.
                      يشمل التحليل 12 كياناً و 48 دليلاً تم جمعها من مصادر مفتوحة متعددة.
                      نسبة الإنجاز الحالية 75% مع توقع اكتمال التحقيق خلال 3 أيام.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardHeader><CardTitle className="text-sm font-bold">الكيانات الرئيسية</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {MOCK_ENTITIES.slice(0, 4).map((e) => (
                        <button key={e.id} onClick={() => setLocation(`/entity/${e.id}`)}
                          className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/30 hover:border-primary/30 hover:bg-primary/4 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{e.label}</div>
                              <Badge className={`text-[9px] font-mono border mt-0.5 ${ENTITY_TYPE_COLORS[e.type]}`}>
                                {ENTITY_TYPE_LABELS[e.type]}
                              </Badge>
                            </div>
                          </div>
                          <span className={`text-sm font-bold font-mono tabular-nums ${e.confidence > 80 ? "text-green-400" : e.confidence > 50 ? "text-amber-400" : "text-destructive"}`}>
                            {e.confidence}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <Card className="border-border/40">
                  <CardHeader><CardTitle className="text-sm font-bold">التقدم</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-black font-mono text-primary tabular-nums">75%</div>
                      <div className="text-xs text-muted-foreground mt-1">مكتمل</div>
                      <div className="w-full h-2 rounded-full bg-secondary mt-3 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: "75%" }} />
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div><span className="text-green-400 font-bold font-mono tabular-nums">12</span><p className="text-muted-foreground">كيان</p></div>
                      <div><span className="text-amber-400 font-bold font-mono tabular-nums">48</span><p className="text-muted-foreground">دليل</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardHeader><CardTitle className="text-sm font-bold">ملاحظات</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea placeholder="أضف ملاحظات التحقيق هنا..." value={notes} onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[120px] text-sm" />
                  </CardContent>
                </Card>
                <Button variant="outline" className="w-full gap-2" onClick={() => setLocation("/dossier/inv-001")}>
                  <FileText className="w-4 h-4" /> عرض الملف المجمع
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Entities */}
          <TabsContent value="entities" className="mt-4">
            <Card className="border-border/40">
              <CardContent className="p-5">
                <SectionHeader icon={Target} title="الكيانات المستهدفة" count={MOCK_ENTITIES.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MOCK_ENTITIES.map((e) => (
                    <button key={e.id} onClick={() => setLocation(`/entity/${e.id}`)}
                      className="flex items-start justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:border-primary/30 hover:bg-primary/4 transition-all text-right">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[9px] font-mono border ${ENTITY_TYPE_COLORS[e.type]}`}>
                            {ENTITY_TYPE_LABELS[e.type]}
                          </Badge>
                        </div>
                        <div className="font-medium text-sm">{e.label}</div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> خطورة: {e.riskScore}%</span>
                        </div>
                      </div>
                      <div className="text-center shrink-0">
                        <div className={`text-lg font-bold font-mono tabular-nums ${e.confidence > 80 ? "text-green-400" : e.confidence > 50 ? "text-amber-400" : "text-destructive"}`}>
                          {e.confidence}%
                        </div>
                        <div className="text-[9px] text-muted-foreground">ثقة</div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evidence */}
          <TabsContent value="evidence" className="mt-4">
            <Card className="border-border/40">
              <CardContent className="p-5">
                <SectionHeader icon={Shield} title="الأدلة المجمعة" count={MOCK_EVIDENCE.length} />
                <EvidencePanel evidence={MOCK_EVIDENCE} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="mt-4">
            <Card className="border-border/40">
              <CardContent className="p-5">
                <SectionHeader icon={Clock} title="الخط الزمني للأحداث" />
                <TimelineVisualization events={MOCK_EVENTS} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Graph */}
          <TabsContent value="graph" className="mt-4">
            <Card className="border-border/40">
              <CardContent className="p-5">
                <SectionHeader icon={GitFork} title="خريطة علاقات الكيانات" />
                <div className="h-[400px] rounded-lg border border-border/30 bg-card overflow-hidden">
                  <GraphVisualization
                    nodes={MOCK_ENTITIES.map(e => ({ id: e.id, label: e.label, type: e.type, confidence: e.confidence }))}
                    edges={[
                      { source: "ent-1", target: "ent-2", type: "owns", label: "يملك" },
                      { source: "ent-1", target: "ent-3", type: "uses", label: "يستخدم" },
                      { source: "ent-1", target: "ent-4", type: "associated", label: "مرتبط" },
                      { source: "ent-1", target: "ent-5", type: "works_at", label: "يعمل في" },
                      { source: "ent-3", target: "ent-4", type: "linked", label: "مرتبط" },
                    ]}
                    height={380}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dossier */}
          <TabsContent value="dossier" className="mt-4">
            <Card className="border-border/40">
              <CardContent className="p-5 text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-1">الملف التحقيقي</h3>
                <p className="text-sm text-muted-foreground mb-4">يتم إنشاء ملف شامل يتضمن كل الأدلة والتحليلات</p>
                <Button onClick={() => setLocation("/dossier/inv-001")} className="gap-2">
                  <FileText className="w-4 h-4" /> عرض الملف
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
