export interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface AdjacencyList {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphStatistics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageClustering: number;
  centrality: Record<string, number>;
}

export class IntelligenceGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private adjacency = new Map<string, Map<string, GraphEdge[]>>();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Map());
    }
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    this.adjacency.delete(id);
    const toRemove: string[] = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        toRemove.push(edgeId);
      }
    }
    for (const edgeId of toRemove) this.removeEdge(edgeId);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, new Map());
    if (!this.adjacency.has(edge.target)) this.adjacency.set(edge.target, new Map());

    const sourceEdges = this.adjacency.get(edge.source)!;
    const targetEdges = this.adjacency.get(edge.target)!;

    if (!sourceEdges.has(edge.target)) sourceEdges.set(edge.target, []);
    if (!targetEdges.has(edge.source)) targetEdges.set(edge.source, []);

    sourceEdges.get(edge.target)!.push(edge);
    targetEdges.get(edge.source)!.push(edge);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  removeEdge(id: string): void {
    const edge = this.edges.get(id);
    if (!edge) return;
    this.edges.delete(id);
    const sourceEdges = this.adjacency.get(edge.source);
    if (sourceEdges) {
      const list = sourceEdges.get(edge.target);
      if (list) {
        const idx = list.findIndex((e) => e.id === id);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) sourceEdges.delete(edge.target);
      }
    }
    const targetEdges = this.adjacency.get(edge.target);
    if (targetEdges) {
      const list = targetEdges.get(edge.source);
      if (list) {
        const idx = list.findIndex((e) => e.id === id);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) targetEdges.delete(edge.source);
      }
    }
  }

  findShortestPath(source: string, target: string, maxDepth: number = 5): GraphNode[] | null {
    if (source === target) return [this.nodes.get(source)!].filter(Boolean);
    const visited = new Set<string>([source]);
    const queue: Array<{ node: string; path: string[] }> = [{ node: source, path: [source] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (path.length > maxDepth) continue;
      const neighbors = this.adjacency.get(node);
      if (!neighbors) continue;
      for (const neighborId of neighbors.keys()) {
        if (visited.has(neighborId)) continue;
        const newPath = [...path, neighborId];
        if (neighborId === target) {
          return newPath.map((id) => this.nodes.get(id)!).filter(Boolean);
        }
        visited.add(neighborId);
        queue.push({ node: neighborId, path: newPath });
      }
    }
    return null;
  }

  findWeightedPath(source: string, target: string): { nodes: GraphNode[]; totalWeight: number } | null {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    for (const id of this.nodes.keys()) {
      distances.set(id, id === source ? 0 : Infinity);
      previous.set(id, null);
      unvisited.add(id);
    }

    while (unvisited.size > 0) {
      let current: string | null = null;
      let minDist = Infinity;
      for (const id of unvisited) {
        const dist = distances.get(id)!;
        if (dist < minDist) {
          minDist = dist;
          current = id;
        }
      }
      if (current === null || current === target) break;
      unvisited.delete(current);

      const neighbors = this.adjacency.get(current);
      if (!neighbors) continue;
      for (const [neighborId, edgeList] of neighbors) {
        if (!unvisited.has(neighborId)) continue;
        const maxWeight = edgeList.reduce((max, e) => Math.max(max, e.weight), 0);
        const alt = distances.get(current)! + (1 / maxWeight);
        if (alt < distances.get(neighborId)!) {
          distances.set(neighborId, alt);
          previous.set(neighborId, current);
        }
      }
    }

    if (distances.get(target) === Infinity) return null;

    const path: string[] = [];
    let step: string | null = target;
    while (step !== null) {
      path.unshift(step);
      step = previous.get(step) ?? null;
    }

    return {
      nodes: path.map((id) => this.nodes.get(id)!).filter(Boolean),
      totalWeight: Math.round((1 / distances.get(target)!) * 100) / 100,
    };
  }

  findConnectedComponents(): GraphNode[][] {
    const visited = new Set<string>();
    const components: GraphNode[][] = [];

    for (const nodeId of this.nodes.keys()) {
      if (visited.has(nodeId)) continue;
      const component: GraphNode[] = [];
      const queue = [nodeId];
      visited.add(nodeId);
      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(this.nodes.get(current)!);
        const neighbors = this.adjacency.get(current);
        if (neighbors) {
          for (const neighborId of neighbors.keys()) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          }
        }
      }
      components.push(component);
    }
    return components;
  }

  getNeighborhood(nodeId: string, depth: number = 1): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const visited = new Set<string>([nodeId]);
    const queue: Array<{ id: string; dist: number }> = [{ id: nodeId, dist: 0 }];
    const resultNodes = new Map<string, GraphNode>();
    const resultEdges = new Set<string>();

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      if (dist > depth) break;
      const node = this.nodes.get(id);
      if (node) resultNodes.set(id, node);
      if (dist === depth) continue;
      const neighbors = this.adjacency.get(id);
      if (!neighbors) continue;
      for (const [neighborId, edgeList] of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, dist: dist + 1 });
        }
        for (const edge of edgeList) resultEdges.add(edge.id);
      }
    }

    return {
      nodes: [...resultNodes.values()],
      edges: [...resultEdges].map((eid) => this.edges.get(eid)!).filter(Boolean),
    };
  }

  getStatistics(): GraphStatistics {
    const nodeCount = this.nodes.size;
    const edgeCount = this.edges.size;
    const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;

    const centrality: Record<string, number> = {};
    for (const [id, neighbors] of this.adjacency) {
      centrality[id] = neighbors.size / Math.max(1, nodeCount - 1);
    }

    let totalClustering = 0;
    let clusteringCount = 0;
    for (const [id, neighbors] of this.adjacency) {
      const neighborIds = [...neighbors.keys()];
      if (neighborIds.length < 2) continue;
      let triangles = 0;
      for (let i = 0; i < neighborIds.length; i++) {
        for (let j = i + 1; j < neighborIds.length; j++) {
          const n1Edges = this.adjacency.get(neighborIds[i]);
          if (n1Edges?.has(neighborIds[j])) triangles++;
        }
      }
      const possible = (neighborIds.length * (neighborIds.length - 1)) / 2;
      totalClustering += possible > 0 ? triangles / possible : 0;
      clusteringCount++;
    }

    return {
      nodeCount,
      edgeCount,
      density: Math.round(density * 10000) / 10000,
      averageClustering: clusteringCount > 0 ? Math.round((totalClustering / clusteringCount) * 10000) / 10000 : 0,
      centrality,
    };
  }

  toAdjacencyList(): AdjacencyList {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
    };
  }

  static fromAdjacencyList(data: AdjacencyList): IntelligenceGraph {
    const graph = new IntelligenceGraph();
    for (const node of data.nodes) graph.addNode(node);
    for (const edge of data.edges) graph.addEdge(edge);
    return graph;
  }
}
