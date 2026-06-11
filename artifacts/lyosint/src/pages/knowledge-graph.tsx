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
  Move, LayoutGrid, Target, GitFork,
} from "lucide-react";

interface GraphEdge { source: string; target: string; type: string; label: string; }

const MOCK_NODES: GraphNode[] = [
  { id: "n1", label: "أحمد علي محمد", type: "person", confidence: 95 },
  { id: "n2", label: "+218 91 234 5678", type: "phone", confidence: 92 },
  { id: "n3", label: "@ahmed_ali", type: "username", confidence: 95 },
  { id: "n4", label: "ahmed@example.com", type: "email", confidence: 78 },
  { id: "n5", label: "LibyaTech", type: "organization", confidence: 65 },
  { id: "n6", label: "علي محمد أحمد", type: "person", confidence: 82 },
  { id: "n7", label: "+218 92 876 5432", type: "phone", confidence: 72 },
  { id: "n8", label: "@ali_tech", type: "username", confidence: 70 },
  { id: "n9", label: "سارة أحمد", type: "person", confidence: 60 },
  { id: "n10", label: "sara@example.com", type: "email", confidence: 55 },
  { id: "n11", label: "بنغازي تك", type: "organization", confidence: 50 },
  { id: "n12", label: "+218 91 345 6789", type: "phone", confidence: 45 },
  { id: "n13", label: "محمود علي", type: "person", confidence: 88 },
  { id: "n14", label: "@mahmoud_a", type: "username", confidence: 75 },
  { id: "n15", label: "mahmoud@company.ly", type: "email", confidence: 68 },
];

const MOCK_EDGES: GraphEdge[] = [
  { source: "n1", target: "n2", type: "owns", label: "يملك" },
  { source: "n1", target: "n3", type: "uses", label: "يستخدم" },
  { source: "n1", target: "n4", type: "associated", label: "مرتبط" },
  { source: "n1", target: "n5", type: "works_at", label: "موظف في" },
  { source: "n1", target: "n6", type: "relative", label: "قريب" },
  { source: "n6", target: "n7", type: "owns", label: "يملك" },
  { source: "n6", target: "n8", type: "uses", label: "يستخدم" },
  { source: "n6", target: "n9", type: "associated", label: "مرتبط" },
  { source: "n9", target: "n10", type: "associated", label: "مرتبط" },
  { source: "n5", target: "n11", type: "partner", label: "شريك" },
  { source: "n6", target: "n13", type: "relative", label: "قريب" },
  { source: "n13", target: "n14", type: "uses", label: "يستخدم" },
  { source: "n13", target: "n15", type: "associated", label: "مرتبط" },
  { source: "n2", target: "n7", type: "linked", label: "متصل" },
  { source: "n3", target: "n14", type: "linked", label: "مرتبط" },
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "شخص", phone: "هاتف", username: "معرّف", email: "بريد", organization: "مؤسسة",
};

export default function KnowledgeGraphPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [minConfidence, setMinConfidence] = useState("0");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [layout, setLayout] = useState<"force" | "radial" | "hierarchical">("force");
  const [fullscreen, setFullscreen] = useState(false);

  const filteredNodes = MOCK_NODES.filter((n) => {
    if (search && !n.label.includes(search)) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    if (Number(minConfidence) > 0 && n.confidence < Number(minConfidence)) return false;
    return true;
  });
  const filteredIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = MOCK_EDGES.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target));

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
      <div className={`space-y-4 ${fullscreen ? "fixed inset-0 z-50 bg-background p-4" : ""}`} dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <GitFork className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">خريطة المعرفة</h1>
              <p className="text-sm text-muted-foreground">تصور بياني لعلاقات الكيانات والأدلة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              <SelectItem value="0">منخفضة</SelectItem>
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
        <div className={`rounded-xl border border-border/40 bg-card overflow-hidden ${fullscreen ? "flex-1" : "h-[600px]"}`}>
          <GraphVisualization
            nodes={filteredNodes}
            edges={filteredEdges}
            height={fullscreen ? undefined : 580}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            layout={layout}
          />
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
                    <Badge className={`text-[10px] font-mono border ${selectedNode.type === "person" ? "bg-blue-500/10 text-blue-400 border-blue-500/25" : selectedNode.type === "phone" ? "bg-green-500/10 text-green-400 border-green-500/25" : "bg-purple-500/10 text-purple-400 border-purple-500/25"}`}>
                      {ENTITY_TYPE_LABELS[selectedNode.type] || selectedNode.type}
                    </Badge>
                    {selectedNode.label}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">نسبة الثقة</span>
                    <span className={`text-lg font-bold font-mono tabular-nums ${selectedNode.confidence > 80 ? "text-green-400" : selectedNode.confidence > 50 ? "text-amber-400" : "text-destructive"}`}>
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
              const src = MOCK_NODES.find(n => n.id === selectedEdge.source);
              const tgt = MOCK_NODES.find(n => n.id === selectedEdge.target);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>تفاصيل العلاقة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/30">
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
