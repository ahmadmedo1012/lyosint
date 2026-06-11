import { useRef, useEffect, useState, useCallback } from "react";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label: string;
}

interface GraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  layout?: "force" | "radial" | "hierarchical";
}

const NODE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  phone: "#22c55e",
  username: "#a855f7",
  email: "#f59e0b",
  organization: "#f43f5e",
};

const NODE_RADIUS = 28;
const EDGE_COLORS: Record<string, string> = {
  owns: "#22c55e",
  uses: "#3b82f6",
  associated: "#a855f7",
  works_at: "#f59e0b",
  relative: "#f43f5e",
  partner: "#06b6d4",
  linked: "#8b5cf6",
};

interface SimNode extends GraphNode { x: number; y: number; vx: number; vy: number; }
interface SimEdge extends GraphEdge { sx: number; sy: number; tx: number; ty: number; }

function runForceSimulation(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): { nodes: SimNode[]; edges: SimEdge[] } {
  const simNodes: SimNode[] = nodes.map((n) => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * width * 0.5,
    y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    vx: 0, vy: 0,
  }));
  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const simEdges: SimEdge[] = edges.map((e) => ({
    ...e,
    sx: nodeMap.get(e.source)?.x ?? 0,
    sy: nodeMap.get(e.source)?.y ?? 0,
    tx: nodeMap.get(e.target)?.x ?? 0,
    ty: nodeMap.get(e.target)?.y ?? 0,
  }));

  const iterations = 120;
  const repulsion = 4000;
  const attraction = 0.005;
  const centerForce = 0.01;
  const damping = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i], b = simNodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force * cooling;
        const fy = (dy / dist) * force * cooling;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    for (const e of simEdges) {
      const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * attraction * cooling;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx; s.vy += fy;
      t.vx -= fx; t.vy -= fy;
    }
    for (const n of simNodes) {
      n.vx += (width / 2 - n.x) * centerForce * cooling;
      n.vy += (height / 2 - n.y) * centerForce * cooling;
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= damping;
      n.vy *= damping;
      n.x = Math.max(NODE_RADIUS, Math.min(width - NODE_RADIUS, n.x));
      n.y = Math.max(NODE_RADIUS, Math.min(height - NODE_RADIUS, n.y));
    }
  }

  for (const e of simEdges) {
    const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
    if (s) { e.sx = s.x; e.sy = s.y; }
    if (t) { e.tx = t.x; e.ty = t.y; }
  }
  return { nodes: simNodes, edges: simEdges };
}

function computeRadialLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): { nodes: SimNode[]; edges: SimEdge[] } {
  const cx = width / 2, cy = height / 2;
  const simNodes: SimNode[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const r = Math.min(width, height) * 0.35;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 };
  });
  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const simEdges: SimEdge[] = edges.map((e) => ({
    ...e, sx: nodeMap.get(e.source)?.x ?? 0, sy: nodeMap.get(e.source)?.y ?? 0,
    tx: nodeMap.get(e.target)?.x ?? 0, ty: nodeMap.get(e.target)?.y ?? 0,
  }));
  return { nodes: simNodes, edges: simEdges };
}

function computeHierarchicalLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): { nodes: SimNode[]; edges: SimEdge[] } {
  const levels: Map<string, number> = new Map();
  const edgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`));
  const computeLevel = (id: string, visited: Set<string>): number => {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    const parents = edges.filter((e) => e.target === id).map((e) => e.source);
    const level = parents.length > 0 ? 1 + Math.max(...parents.map((p) => computeLevel(p, visited))) : 0;
    levels.set(id, level);
    return level;
  };
  for (const n of nodes) computeLevel(n.id, new Set());
  const maxLevel = Math.max(...Array.from(levels.values()), 1);
  const nodesPerLevel: Map<number, string[]> = new Map();
  for (const n of nodes) {
    const l = levels.get(n.id) ?? 0;
    if (!nodesPerLevel.has(l)) nodesPerLevel.set(l, []);
    nodesPerLevel.get(l)!.push(n.id);
  }
  const simNodes: SimNode[] = nodes.map((n) => {
    const level = levels.get(n.id) ?? 0;
    const peers = nodesPerLevel.get(level) ?? [];
    const idx = peers.indexOf(n.id);
    const total = peers.length;
    const x = width * (total > 1 ? (idx + 0.5) / total : 0.5);
    const y = height * ((level + 0.5) / (maxLevel + 1));
    return { ...n, x, y, vx: 0, vy: 0 };
  });
  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const simEdges: SimEdge[] = edges.map((e) => ({
    ...e, sx: nodeMap.get(e.source)?.x ?? 0, sy: nodeMap.get(e.source)?.y ?? 0,
    tx: nodeMap.get(e.target)?.x ?? 0, ty: nodeMap.get(e.target)?.y ?? 0,
  }));
  return { nodes: simNodes, edges: simEdges };
}

export function GraphVisualization({ nodes, edges, height = 400, onNodeClick, onEdgeClick, layout = "force" }: GraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });
  const [simData, setSimData] = useState<{ nodes: SimNode[]; edges: SimEdge[] } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const animFrame = useRef<number>(0);
  const offset = useRef({ x: 0, y: 0 });
  const scale = useRef(1);
  const dragging = useRef(false);
  const dragNode = useRef<string | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  const resize = useCallback(() => {
    if (containerRef.current) {
      const w = containerRef.current.clientWidth;
      setDimensions({ width: w, height: height ?? 400 });
    }
  }, [height]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || nodes.length === 0) return;
    let result: { nodes: SimNode[]; edges: SimEdge[] };
    if (layout === "radial") {
      result = computeRadialLayout(nodes, edges, dimensions.width, dimensions.height);
    } else if (layout === "hierarchical") {
      result = computeHierarchicalLayout(nodes, edges, dimensions.width, dimensions.height);
    } else {
      result = runForceSimulation(nodes, edges, dimensions.width, dimensions.height);
    }
    setSimData(result);
  }, [nodes, edges, dimensions, layout]);

  useEffect(() => {
    if (!canvasRef.current || !simData) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = width * dpr;
    canvasRef.current.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offset.current.x, offset.current.y);
    ctx.scale(scale.current, scale.current);

    const nodeMap = new Map(simData.nodes.map((n) => [n.id, n]));

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5 / scale.current;
    for (const edge of simData.edges) {
      ctx.beginPath();
      ctx.moveTo(edge.sx, edge.sy);
      ctx.lineTo(edge.tx, edge.ty);
      ctx.stroke();

      const mx = (edge.sx + edge.tx) / 2;
      const my = (edge.sy + edge.ty) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = `${10 / scale.current}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(edge.label, mx, my - 4 / scale.current);
    }

    for (const node of simData.nodes) {
      const color = NODE_COLORS[node.type] || "#6b7280";
      const isHovered = hoveredNode === node.id;
      const r = isHovered ? NODE_RADIUS * 1.15 / scale.current : NODE_RADIUS / scale.current;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + "20";
      ctx.fill();
      ctx.strokeStyle = isHovered ? color : color + "60";
      ctx.lineWidth = isHovered ? 2.5 / scale.current : 1.5 / scale.current;
      ctx.stroke();

      const confidenceColor = node.confidence > 80 ? "#22c55e" : node.confidence > 50 ? "#f59e0b" : "#ef4444";
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * node.confidence) / 100);
      ctx.strokeStyle = confidenceColor;
      ctx.lineWidth = 2.5 / scale.current;
      ctx.stroke();

      ctx.fillStyle = "#f8fafc";
      ctx.font = `bold ${12 / scale.current}px "Noto Kufi Arabic", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(node.label, node.x, node.y + r + 16 / scale.current);
      ctx.fillText(node.confidence + "%", node.x, node.y + 4 / scale.current);
    }

    ctx.restore();
  }, [simData, dimensions, hoveredNode]);

  const getNodeAt = (clientX: number, clientY: number): SimNode | null => {
    if (!canvasRef.current || !simData) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - offset.current.x) / scale.current;
    const y = (clientY - rect.top - offset.current.y) / scale.current;
    const r = NODE_RADIUS / scale.current;
    for (const node of simData.nodes) {
      const dx = x - node.x, dy = y - node.y;
      if (dx * dx + dy * dy <= r * r) return node;
    }
    return null;
  };

  const getEdgeAt = (clientX: number, clientY: number): SimEdge | null => {
    if (!canvasRef.current || !simData) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = (clientX - rect.left - offset.current.x) / scale.current;
    const py = (clientY - rect.top - offset.current.y) / scale.current;
    for (const edge of simData.edges) {
      const dx = edge.tx - edge.sx, dy = edge.ty - edge.sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;
      const t = Math.max(0, Math.min(1, ((px - edge.sx) * dx + (py - edge.sy) * dy) / (len * len)));
      const closestX = edge.sx + t * dx;
      const closestY = edge.sy + t * dy;
      const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
      if (dist < 6 / scale.current) return edge;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node) {
      dragging.current = true;
      dragNode.current = node.id;
    } else {
      dragging.current = true;
      dragNode.current = null;
    }
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      if (dragNode.current && simData) {
        const n = simData.nodes.find((nd) => nd.id === dragNode.current);
        if (n) { n.x += dx / scale.current; n.y += dy / scale.current; }
      } else {
        offset.current.x += dx;
        offset.current.y += dy;
      }
      lastPos.current = { x: e.clientX, y: e.clientY };
    } else {
      const node = getNodeAt(e.clientX, e.clientY);
      const edge = node ? null : getEdgeAt(e.clientX, e.clientY);
      setHoveredNode(node?.id ?? null);
      if (node) {
        setTooltip({ x: e.clientX, y: e.clientY, content: `${node.label} (${node.confidence}%)` });
      } else if (edge) {
        setTooltip({ x: e.clientX, y: e.clientY, content: `${edge.label}` });
      } else {
        setTooltip(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragging.current && !dragNode.current) {
      dragging.current = false;
      return;
    }
    if (dragging.current && dragNode.current) {
      dragging.current = false;
      dragNode.current = null;
      return;
    }
    const node = getNodeAt(e.clientX, e.clientY);
    if (node && onNodeClick) {
      onNodeClick(node);
      return;
    }
    const edge = node ? null : getEdgeAt(e.clientX, e.clientY);
    if (edge && onEdgeClick) {
      onEdgeClick(edge);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.2, Math.min(5, scale.current * delta));
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      offset.current.x = mx - (mx - offset.current.x) * (newScale / scale.current);
      offset.current.y = my - (my - offset.current.y) * (newScale / scale.current);
    }
    scale.current = newScale;
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm" style={{ height }}>
        <p>لا توجد كيانات لعرضها</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden cursor-grab active:cursor-grabbing" style={{ height: height ?? 400 }} onWheel={handleWheel}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragging.current = false; dragNode.current = null; setTooltip(null); }}
      />
      {tooltip && (
        <div className="fixed z-50 px-2.5 py-1.5 rounded-md bg-popover border border-border text-xs text-popover-foreground font-medium shadow-md pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
