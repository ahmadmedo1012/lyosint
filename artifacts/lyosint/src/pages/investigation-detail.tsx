import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GraphVisualization } from "@/components/graph-visualization";
import { TimelineVisualization } from "@/components/timeline-visualization";
import { EvidencePanel } from "@/components/evidence-panel";
import {
  ArrowRight, Edit, XCircle, Download, Trash2, Target, Shield,
  FileText, GitFork, Clock, MessageSquare, User, Plus,
  ChevronLeft, AlertTriangle, CheckCircle2, RefreshCw,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Entity {
  id: string; label: string; type: string; confidence: number; riskScore: number;
}
interface Evidence {
  id: string; title: string; source: string; sourceType: string; confidence: number; date: string; summary: string;
}
interface TimelineEvent {
  date: string; title: string; description: string; confidence: number;
}

interface InvestigationDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  entityCount: number;
  evidenceCount: number;
  progress: number;
  summary: string;
  updatedAt: string;
  entities: Entity[];
  evidence: Evidence[];
  events: TimelineEvent[];
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "bg-blue-500/10 text-blue-600 border-blue-500/25",
  phone: "bg-green-500/10 text-green-600 border-green-500/25",
  username: "bg-purple-500/10 text-purple-600 border-purple-500/25",
  email: "bg-amber-500/10 text-amber-600 border-amber-500/25",
  organization: "bg-rose-500/10 text-rose-600 border-rose-500/25",
};
const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "شخص", phone: "هاتف", username: "معرّف", email: "بريد", organization: "مؤسسة",
};

function SectionHeader({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-3 h-3 text-primary" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {count !== undefined && <Badge variant="secondary" className="text-[10px] font-mono">{count}</Badge>}
    </div>
  );
}

export default function InvestigationDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState<InvestigationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/api/investigations/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: InvestigationDetail) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => { setError("تعذّر تحميل تفاصيل التحقيق"); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[40vh]">
          <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (error || !data) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center gap-4 min-h-[40vh]">
          <XCircle className="w-8 h-8 text-muted-foreground" />
          <p className="text-muted-foreground">{error ?? "تحقيق غير موجود"}</p>
          <Button variant="outline" onClick={() => setLocation("/investigations")}>العودة للتحقيقات</Button>
        </div>
      </PageTransition>
    );
  }

  const STATUS_LABELS: Record<string, string> = { active: "نشط", pending: "قيد الانتظار", closed: "مغلق", archived: "مؤرشف" };
  const STATUS_COLORS: Record<string, string> = { active: "text-green-600 bg-green-500/10 border-green-500/25", pending: "text-amber-600 bg-amber-500/10 border-amber-500/25", closed: "text-blue-600 bg-blue-500/10 border-blue-500/25", archived: "text-muted-foreground bg-secondary/30 border-border/40" };
  const PRIORITY_LABELS: Record<string, string> = { critical: "حرج", high: "عالية", medium: "متوسطة", low: "منخفضة" };
  const PRIORITY_COLORS: Record<string, string> = { critical: "text-red-600 bg-red-500/10 border-red-500/30", high: "text-amber-600 bg-amber-500/10 border-amber-500/25", medium: "text-blue-600 bg-blue-500/10 border-blue-500/25", low: "text-muted-foreground bg-secondary/30 border-border/30" };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-5" dir="rtl">
        {/* Back */}
        <button onClick={() => setLocation("/investigations")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> العودة للتحقيقات
        </button>

        {/* Header */}
        <div className="rounded-xl border border-border/30 bg-card px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-[10px] font-mono border ${STATUS_COLORS[data.status] || "text-green-600 bg-green-500/10 border-green-500/25"}`}>
                  {STATUS_LABELS[data.status] || data.status}
                </Badge>
                <Badge className={`text-[10px] font-mono border ${PRIORITY_COLORS[data.priority] || "text-red-600 bg-red-500/10 border-red-500/30"}`}>
                  {PRIORITY_LABELS[data.priority] || data.priority}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{id}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">{data.title}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> آخر تحديث: {data.updatedAt}</span>
                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {data.entityCount} كيان</span>
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {data.evidenceCount} دليل</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5"><Edit className="w-3.5 h-3.5" /> تعديل</Button>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> تصدير</Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v)}>
          <TabsList className="w-full justify-start h-auto p-1 gap-1 bg-secondary/30 border border-border/30 rounded-xl overflow-x-auto">
            {["overview", "entities", "evidence", "timeline", "graph"].map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs data-[state=active]:bg-card">
                {tab === "overview" && "نظرة عامة"}
                {tab === "entities" && "الكيانات"}
                {tab === "evidence" && "الأدلة"}
                {tab === "timeline" && "الخط الزمني"}
                {tab === "graph" && "الرسم البياني"}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border/20">
                  <CardHeader><CardTitle className="text-sm font-bold">ملخص التحقيق</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {data.summary || "لا يوجد ملخص متاح."}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/20">
                  <CardHeader><CardTitle className="text-sm font-bold">الكيانات الرئيسية</CardTitle></CardHeader>
                  <CardContent>
                    {data.entities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">لا توجد كيانات مضافة بعد</p>
                    ) : (
                      <div className="space-y-2">
                        {data.entities.slice(0, 4).map((e) => (
                          <button key={e.id} onClick={() => setLocation(`/entity/${e.id}`)}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20 hover:border-border/40 hover:bg-secondary/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{e.label}</div>
                                <Badge className={`text-[9px] font-mono border mt-0.5 ${ENTITY_TYPE_COLORS[e.type] || ""}`}>
                                  {ENTITY_TYPE_LABELS[e.type] || e.type}
                                </Badge>
                              </div>
                            </div>
                            <span className={`text-sm font-bold font-mono tabular-nums ${e.confidence > 80 ? "text-green-600" : e.confidence > 50 ? "text-amber-600" : "text-red-600"}`}>
                              {e.confidence}%
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <Card className="border-border/20">
                  <CardHeader><CardTitle className="text-sm font-bold">التقدم</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold font-mono text-primary tabular-nums">{data.progress}%</div>
                      <div className="text-xs text-muted-foreground mt-1">مكتمل</div>
                      <div className="w-full h-2 rounded-full bg-secondary mt-3 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.progress}%` }} />
                      </div>
                    </div>
                    <div className="border-t border-border/10 my-3" />
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div><span className="text-green-600 font-bold font-mono tabular-nums">{data.entityCount}</span><p className="text-muted-foreground">كيان</p></div>
                      <div><span className="text-amber-600 font-bold font-mono tabular-nums">{data.evidenceCount}</span><p className="text-muted-foreground">دليل</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/20">
                  <CardHeader><CardTitle className="text-sm font-bold">ملاحظات</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea placeholder="أضف ملاحظات التحقيق هنا..." value={notes} onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[120px] text-sm" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Entities */}
          <TabsContent value="entities" className="mt-4">
            <Card className="border-border/20">
              <CardContent className="p-5">
                <SectionHeader icon={Target} title="الكيانات المستهدفة" count={data.entities.length} />
                {data.entities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد كيانات مضافة بعد</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.entities.map((e) => (
                      <button key={e.id} onClick={() => setLocation(`/entity/${e.id}`)}
                        className="flex items-start justify-between p-4 rounded-lg bg-secondary/20 border border-border/20 hover:border-border/40 hover:bg-secondary/30 transition-all text-right">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[9px] font-mono border ${ENTITY_TYPE_COLORS[e.type] || ""}`}>
                              {ENTITY_TYPE_LABELS[e.type] || e.type}
                            </Badge>
                          </div>
                          <div className="font-medium text-sm">{e.label}</div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> خطورة: {e.riskScore}%</span>
                          </div>
                        </div>
                        <div className="text-center shrink-0">
                          <div className={`text-lg font-bold font-mono tabular-nums ${e.confidence > 80 ? "text-green-600" : e.confidence > 50 ? "text-amber-600" : "text-red-600"}`}>
                            {e.confidence}%
                          </div>
                          <div className="text-[9px] text-muted-foreground">ثقة</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evidence */}
          <TabsContent value="evidence" className="mt-4">
            <Card className="border-border/20">
              <CardContent className="p-5">
                <SectionHeader icon={Shield} title="الأدلة المجمعة" count={data.evidence.length} />
                {data.evidence.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد أدلة بعد</p>
                ) : (
                  <EvidencePanel evidence={data.evidence} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="mt-4">
            <Card className="border-border/20">
              <CardContent className="p-5">
                <SectionHeader icon={Clock} title="الخط الزمني للأحداث" />
                {data.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد أحداث بعد</p>
                ) : (
                  <TimelineVisualization events={data.events} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Graph */}
          <TabsContent value="graph" className="mt-4">
            <Card className="border-border/20">
              <CardContent className="p-5">
                <SectionHeader icon={GitFork} title="خريطة علاقات الكيانات" />
                {data.entities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد كيانات للعرض</p>
                ) : (
                  <div className="h-[400px] rounded-lg border border-border/20 bg-card overflow-hidden">
                    <GraphVisualization
                      nodes={data.entities.map(e => ({ id: e.id, label: e.label, type: e.type, confidence: e.confidence }))}
                      edges={data.entities.slice(1).map(e => ({
                        source: data.entities[0].id,
                        target: e.id,
                        type: "associated",
                        label: "مرتبط",
                      }))}
                      height={380}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
