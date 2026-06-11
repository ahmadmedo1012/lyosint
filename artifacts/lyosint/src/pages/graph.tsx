import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, X, Network, Shield, User } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GraphNode {
  id: string;
  label: string;
  status: string;
  confidenceScore: number;
  avatarUrl: string | null;
  summary: string | null;
  identifiers: { type: string; value: string }[];
  // simulation
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  label: string | null;
}

function nodeColor(status: string, score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#3b82f6";
  if (score >= 50) return "#f59e0b";
  return "#6b7280";
}

function edgeColor(type: string): string {
  if (type === "same_person") return "#a855f7";
  if (type === "same_identifier") return "#0ea5e9";
  if (type === "related_to") return "#f97316";
  return "#6b7280";
}

function relTypeLabel(type: string): string {
  const map: Record<string, string> = {
    same_person: "نفس الشخص",
    same_identifier: "معرّف مشترك",
    related_to: "مرتبط بـ",
    owns: "يملك",
    uses: "يستخدم",
    alias: "اسم مستعار",
  };
  return map[type] ?? type;
}

export default function GraphPage() {
  const [, navigate] = useLocation();
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const dragNode = useRef<GraphNode | null>(null);
  const simRunning = useRef(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  const loadGraph = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/entities/graph/data`)
      .then(r => r.ok ? r.json() : Promise.reject("فشل تحميل البيانات"))
      .then((data: { nodes: Omit<GraphNode, "x"|"y"|"vx"|"vy"|"radius">[]; edges: GraphEdge[] }) => {
        const svg = svgRef.current;
        const W = svg?.clientWidth ?? 800;
        const H = svg?.clientHeight ?? 600;
        const cx = W / 2;
        const cy = H / 2;
        const count = data.nodes.length;

        nodesRef.current = data.nodes.map((n, i) => {
          const angle = (2 * Math.PI * i) / Math.max(count, 1);
          const r = Math.min(W, H) * 0.35;
          return {
            ...n,
            x: cx + (count > 1 ? r * Math.cos(angle) : 0),
            y: cy + (count > 1 ? r * Math.sin(angle) : 0),
            vx: 0,
            vy: 0,
            radius: 22 + Math.min(n.confidenceScore / 5, 12),
          };
        });
        edgesRef.current = data.edges;
        setNodeCount(data.nodes.length);
        setEdgeCount(data.edges.length);
        setLoading(false);
        simRunning.current = true;
      })
      .catch(e => { setError(typeof e === "string" ? e : "خطأ في الاتصال"); setLoading(false); });
  }, []);

  // Force simulation tick
  const tick = useCallback(() => {
    if (!svgRef.current) return;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (!nodes.length) return;

    const svg = svgRef.current;
    const W = svg.clientWidth;
    const H = svg.clientHeight;
    const cx = W / 2;
    const cy = H / 2;

    const alpha = simRunning.current ? 0.05 : 0;

    // Gravity toward center
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.003 * alpha * 20;
      n.vy += (cy - n.y) * 0.003 * alpha * 20;
    }

    // Repulsion between nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.radius + b.radius + 60;
        if (dist < minDist * 3) {
          const force = (minDist * minDist) / (dist * dist) * 0.8 * alpha * 20;
          const nx = (dx / dist) * force;
          const ny = (dy / dist) * force;
          a.vx -= nx;
          a.vy -= ny;
          b.vx += nx;
          b.vy += ny;
        }
      }
    }

    // Spring attraction along edges
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const e of edges) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = 140;
      const force = (dist - ideal) * 0.02 * alpha * 20;
      s.vx += (dx / dist) * force;
      s.vy += (dy / dist) * force;
      t.vx -= (dx / dist) * force;
      t.vy -= (dy / dist) * force;
    }

    // Integrate velocities + damping
    let totalKinetic = 0;
    for (const n of nodes) {
      if (dragNode.current === n) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
      totalKinetic += n.vx * n.vx + n.vy * n.vy;
    }
    if (totalKinetic < 0.01) simRunning.current = false;

    renderFrame();
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const renderFrame = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const t = transformRef.current;

    const g = svg.querySelector<SVGGElement>("#graph-group");
    if (!g) return;

    const edgesG = g.querySelector<SVGGElement>("#edges-group");
    const nodesG = g.querySelector<SVGGElement>("#nodes-group");
    if (!edgesG || !nodesG) return;

    g.setAttribute("transform", `translate(${t.x},${t.y}) scale(${t.scale})`);

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Render edges
    const edgeEls = edgesG.querySelectorAll<SVGLineElement>("line");
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const s = nodeMap.get(e.source);
      const tt = nodeMap.get(e.target);
      if (!s || !tt) continue;
      let el = edgeEls[i] as SVGLineElement | undefined;
      if (!el) {
        el = document.createElementNS("http://www.w3.org/2000/svg", "line") as SVGLineElement;
        edgesG.appendChild(el);
      }
      el.setAttribute("x1", String(s.x));
      el.setAttribute("y1", String(s.y));
      el.setAttribute("x2", String(tt.x));
      el.setAttribute("y2", String(tt.y));
      el.setAttribute("stroke", edgeColor(e.type));
      el.setAttribute("stroke-width", String(1 + (e.confidence / 100)));
      el.setAttribute("stroke-opacity", "0.4");
      el.setAttribute("stroke-dasharray", e.type === "same_identifier" ? "4,3" : "none");
    }

    // Remove extra edges
    for (let i = edges.length; i < edgeEls.length; i++) {
      edgeEls[i].remove();
    }

    // Render nodes
    const nodeEls = nodesG.querySelectorAll<SVGGElement>(".node-group");
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      let el = nodeEls[i] as SVGGElement | undefined;
      if (!el) {
        el = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
        el.setAttribute("class", "node-group");
        el.style.cursor = "pointer";

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "node-circle");
        el.appendChild(circle);

        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("class", "node-ring");
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke-width", "1.5");
        el.appendChild(ring);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", "node-label");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-weight", "600");
        text.setAttribute("fill", "white");
        text.setAttribute("pointer-events", "none");
        el.appendChild(text);

        const sublabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        sublabel.setAttribute("class", "node-sublabel");
        sublabel.setAttribute("text-anchor", "middle");
        sublabel.setAttribute("font-size", "9");
        sublabel.setAttribute("fill", "#9ca3af");
        sublabel.setAttribute("pointer-events", "none");
        el.appendChild(sublabel);

        nodesG.appendChild(el);
      }

      el.setAttribute("transform", `translate(${n.x},${n.y})`);
      el.setAttribute("data-id", n.id);

      const color = nodeColor(n.status, n.confidenceScore);
      const circle = el.querySelector<SVGCircleElement>(".node-circle")!;
      circle.setAttribute("r", String(n.radius));
      circle.setAttribute("fill", color + "22");
      circle.setAttribute("stroke", color);
      circle.setAttribute("stroke-width", selected?.id === n.id ? "2.5" : "1.5");

      const ring = el.querySelector<SVGCircleElement>(".node-ring")!;
      ring.setAttribute("r", String(n.radius + 5));
      ring.setAttribute("stroke", color + "40");
      ring.setAttribute("stroke-opacity", selected?.id === n.id ? "1" : "0");

      const initials = n.label.slice(0, 2);
      const labelEl = el.querySelector<SVGTextElement>(".node-label")!;
      labelEl.textContent = initials;

      const sublabel = el.querySelector<SVGTextElement>(".node-sublabel")!;
      const shortLabel = n.label.length > 12 ? n.label.slice(0, 10) + "…" : n.label;
      sublabel.textContent = shortLabel;
      sublabel.setAttribute("y", String(n.radius + 12));
    }

    // Remove extra nodes
    for (let i = nodes.length; i < nodeEls.length; i++) {
      nodeEls[i].remove();
    }
  }, [selected]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (loading || error) return;
    cancelAnimationFrame(animRef.current);
    simRunning.current = true;
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [loading, error, tick]);

  // Pointer events on SVG
  const onSvgPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const target = (e.target as Element).closest<SVGGElement>(".node-group");
    if (target) {
      const id = target.getAttribute("data-id");
      const node = nodesRef.current.find(n => n.id === id);
      if (node) {
        dragNode.current = node;
        simRunning.current = true;
      }
      return;
    }
    isDraggingCanvas.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
  }, []);

  const onSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragNode.current) {
      const t = transformRef.current;
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      dragNode.current.x = (e.clientX - rect.left - t.x) / t.scale;
      dragNode.current.y = (e.clientY - rect.top - t.y) / t.scale;
      return;
    }
    if (isDraggingCanvas.current) {
      transformRef.current.x = dragStart.current.tx + (e.clientX - dragStart.current.x);
      transformRef.current.y = dragStart.current.ty + (e.clientY - dragStart.current.y);
    }
  }, []);

  const onSvgPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragNode.current) {
      const dn = dragNode.current;
      dragNode.current = null;
      setSelected(dn);
      return;
    }
    isDraggingCanvas.current = false;
  }, []);

  const onSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = (e.target as Element).closest<SVGGElement>(".node-group");
    if (!target) { setSelected(null); }
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    transformRef.current.scale = Math.max(0.2, Math.min(4, transformRef.current.scale * delta));
  }, []);

  const zoom = (factor: number) => {
    transformRef.current.scale = Math.max(0.2, Math.min(4, transformRef.current.scale * factor));
    simRunning.current = true;
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  };

  const resetView = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    simRunning.current = true;
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  };

  return (
    <PageTransition>
      <div className="h-[calc(100vh-7rem)] flex flex-col gap-3" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">خريطة العلاقات</h1>
            {!loading && (
              <div className="flex gap-1.5">
                <Badge variant="outline" className="text-xs py-0 px-1.5 text-primary border-primary/30 bg-primary/5">
                  {nodeCount} كيان
                </Badge>
                <Badge variant="outline" className="text-xs py-0 px-1.5 text-muted-foreground">
                  {edgeCount} رابط
                </Badge>
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => zoom(1.2)} title="تكبير">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => zoom(0.8)} title="تصغير">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetView} title="إعادة تعيين العرض">
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={loadGraph} disabled={loading} title="تحديث">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 items-center shrink-0 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> مؤكد ≥90%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> مرجح ≥70%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> محتمل ≥50%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-500" /> ضعيف</span>
          <span className="mr-3 flex items-center gap-1"><svg width="22" height="4"><line x1="0" y1="2" x2="22" y2="2" stroke="#a855f7" strokeWidth="2"/></svg> نفس الشخص</span>
          <span className="flex items-center gap-1"><svg width="22" height="4"><line x1="0" y1="2" x2="22" y2="2" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="4,3"/></svg> معرّف مشترك</span>
          <span className="flex items-center gap-1"><svg width="22" height="4"><line x1="0" y1="2" x2="22" y2="2" stroke="#f97316" strokeWidth="1.5"/></svg> مرتبط بـ</span>
        </div>

        {/* Graph Canvas */}
        <div className="flex-1 relative rounded-xl border border-border/50 bg-card overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">جاري تحميل شبكة الكيانات…</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
              <Info className="w-8 h-8 text-destructive/60" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" onClick={loadGraph}>إعادة المحاولة</Button>
            </div>
          )}
          {!loading && !error && nodeCount === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
              <Network className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">لا توجد كيانات بعد.</p>
              <p className="text-xs text-muted-foreground/60">تُضاف الكيانات تلقائياً عند إجراء عمليات البحث.</p>
            </div>
          )}

          <svg
            ref={svgRef}
            className="w-full h-full select-none"
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onClick={onSvgClick}
            onWheel={onWheel}
            style={{ touchAction: "none" }}
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g id="graph-group">
              <g id="edges-group" />
              <g id="nodes-group" />
            </g>
          </svg>

          {/* Node Tooltip / Info Panel */}
          {selected && (
            <div className="absolute bottom-4 right-4 w-72 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm p-4 shadow-lg z-20 space-y-3" dir="rtl">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm border"
                    style={{
                      background: nodeColor(selected.status, selected.confidenceScore) + "22",
                      borderColor: nodeColor(selected.status, selected.confidenceScore) + "60",
                      color: nodeColor(selected.status, selected.confidenceScore),
                    }}
                  >
                    {selected.label.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate" dir="auto">{selected.label}</div>
                    <div className="text-[11px] text-muted-foreground">ثقة: {selected.confidenceScore}%</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selected.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed" dir="auto">
                  {selected.summary}
                </p>
              )}

              {selected.identifiers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">المعرّفات</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.identifiers.slice(0, 5).map((ident, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 font-mono" dir="ltr">
                        {ident.type}: {ident.value.length > 18 ? ident.value.slice(0, 16) + "…" : ident.value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1.5"
                  onClick={() => navigate(`/entities/${selected.id}`)}
                >
                  <User className="w-3.5 h-3.5" />
                  فتح الملف الاستخباراتي
                </Button>
              </div>
            </div>
          )}

          {/* Pan hint */}
          {!loading && nodeCount > 0 && (
            <div className="absolute top-3 left-3 text-[10px] text-muted-foreground/30 font-mono pointer-events-none">
              اسحب للتحريك • عجلة الماوس للتكبير • انقر لعرض التفاصيل
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
