import { useState, useRef, useEffect, useCallback } from "react";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraphVisualization, type GraphNode } from "@/components/graph-visualization";
import {
  Search, Filter, ZoomIn, ZoomOut, Maximize2, Download,
  Move, LayoutGrid, Target, GitFork, RefreshCw, Info, X,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GraphEdge { source: string; target: string; type: string; label: string; }

const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "شخص", phone: "هاتف", username: "معرّف", email: "بريد", organization: "مؤسسة",
};

function mapNodeType(status: string): string {
  if (["person", "phone", "username", "email", "organization"].includes(status)) return status;
  if (status === "confirmed" || status === "probable") return "person";
  return "username";
}

export default function KnowledgeGraphPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [minConfidence, setMinConfidence] = useState("0");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [layout, setLayout] = useState<"force" | "radial" | "hierarchical">("force");
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiNodes, setApiNodes] = useState<GraphNode[]>([]);
  const [apiEdges, setApiEdges] = useState<GraphEdge[]>([]);

  const loadGraph = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/entities/graph/data`)
      .then(r => r.ok ? r.json() : Promise.reject("فشل تحميل البيانات"))
      .then((data: { nodes: Array<{ id: string; label: string; status: string; confidenceScore: number }>; edges: Array<{ source: string; target: string; type: string; label: string | null }> }) => {
        setApiNodes(data.nodes.map(n => ({
          id: n.id,
          label: n.label,
          type: mapNodeType(n.status),
          confidence: n.confidenceScore,
        })));
        setApiEdges(data.edges.filter(e => e.source && e.target).map(e => ({
          source: e.source,
          target: e.target,
          type: e.type || "related",
          label: e.label || e.type || "مرتبط",
        })));
        setLoading(false);
      })
      .catch(e => { setError(typeof e === "string" ? e : "خطأ في تحميل البيانات"); setLoading(false); });
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const allNodes = apiNodes;
  const allEdges = apiEdges;

  const filteredNodes = allNodes.filter((n) => {
    if (search && !n.label.includes(search)) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    if (Number(minConfidence) > 0 && n.confidence < Number(minConfidence)) return false;
    return true;
  });
  const filteredIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = allEdges.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target));

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  return (
    <PageTransition>
      <div className={`${fullscreen ? "fixed inset-0 z-50 bg-background p-4" : "space-y-4"}`} dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">خريطة المعرفة</h1>
            <p className="text-sm text-muted-foreground">تصور بياني لعلاقات الكيانات والأدلة</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadGraph} disabled={loading} title="تحديث">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant={fullscreen ? "default" : "outline"} size="sm" onClick={() => setFullscreen(!fullscreen)} className="gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" /> {fullscreen ? "تصغير" : "تكبير"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> تصدير
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="بحث في الكيانات..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-10" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-10"><SelectValue placeholder="النوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="person">شخص</SelectItem>
              <SelectItem value="phone">هاتف</SelectItem>
              <SelectItem value="username">معرّف</SelectItem>
              <SelectItem value="email">بريد</SelectItem>
              <SelectItem value="organization">مؤسسة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={minConfidence} onValueChange={setMinConfidence}>
            <SelectTrigger className="w-full sm:w-[130px] h-10"><SelectValue placeholder="الثقة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">كل المستويات</SelectItem>
              <SelectItem value="80">عالية (80%+)</SelectItem>
              <SelectItem value="50">متوسطة (50%+)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={layout} onValueChange={(v) => setLayout(v as typeof layout)}>
            <SelectTrigger className="w-full sm:w-[130px] h-10"><SelectValue placeholder="التخطيط" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="force">قوى جاذبة</SelectItem>
              <SelectItem value="radial">شعاعي</SelectItem>
              <SelectItem value="hierarchical">هرمي</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Graph Area */}
        <div className={`rounded-xl border border-border/30 bg-card overflow-hidden relative ${fullscreen ? "flex-1" : "h-[600px]"}`}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-card/80">
              <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground">جاري تحميل شبكة الكيانات…</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-card/80">
              <Info className="w-8 h-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" onClick={loadGraph}>إعادة المحاولة</Button>
            </div>
          )}
          {!loading && !error && allNodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
              <GitFork className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">لا توجد كيانات بعد.</p>
              <p className="text-xs text-muted-foreground/60">تُضاف الكيانات تلقائياً عند إجراء عمليات البحث.</p>
            </div>
          )}
          {!loading && !error && (
            <GraphVisualization
              nodes={filteredNodes}
              edges={filteredEdges}
              height={fullscreen ? undefined : 580}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              layout={layout}
            />
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {filteredNodes.length} كيان</span>
          <span className="flex items-center gap-1"><GitFork className="w-3 h-3" /> {filteredEdges.length} علاقة</span>
          <Badge variant="secondary" className="text-[9px] font-mono">
            {layout === "force" ? "قوى جاذبة" : layout === "radial" ? "شعاعي" : "هرمي"}
          </Badge>
        </div>

        {/* Node Detail Dialog */}
        <Dialog open={!!selectedNode} onOpenChange={(o) => !o && setSelectedNode(null)}>
          <DialogContent className="sm:max-w-sm">
            {selectedNode && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Badge className={`text-[10px] font-mono border ${selectedNode.type === "person" ? "bg-blue-500/10 text-blue-600 border-blue-500/25" : selectedNode.type === "phone" ? "bg-green-500/10 text-green-600 border-green-500/25" : "bg-purple-500/10 text-purple-600 border-purple-500/25"}`}>
                      {ENTITY_TYPE_LABELS[selectedNode.type] || selectedNode.type}
                    </Badge>
                    {selectedNode.label}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">نسبة الثقة</span>
                    <span className={`text-lg font-bold font-mono tabular-nums ${selectedNode.confidence > 80 ? "text-green-600" : selectedNode.confidence > 50 ? "text-amber-600" : "text-red-600"}`}>
                      {selectedNode.confidence}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${selectedNode.confidence}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>المعرف: {selectedNode.id}</p>
                    <p>عدد العلاقات: {filteredEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}</p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Edge Detail Dialog */}
        <Dialog open={!!selectedEdge} onOpenChange={(o) => !o && setSelectedEdge(null)}>
          <DialogContent className="sm:max-w-sm">
            {selectedEdge && (() => {
              const src = allNodes.find(n => n.id === selectedEdge.source);
              const tgt = allNodes.find(n => n.id === selectedEdge.target);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>تفاصيل العلاقة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <span className="text-sm font-medium truncate">{src?.label}</span>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0 mx-2">{selectedEdge.label}</Badge>
                      <span className="text-sm font-medium truncate">{tgt?.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      العلاقة من نوع "{selectedEdge.type}" تربط بين {src?.label} و {tgt?.label}
                    </p>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
