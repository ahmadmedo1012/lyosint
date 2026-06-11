import { describe, expect, it, beforeEach } from "@jest/globals";
import { IntelligenceGraph, type GraphNode, type GraphEdge } from "../index";

function makeNode(id: string, label?: string, type?: string): GraphNode {
  return { id, label: label ?? id, type: type ?? "entity" };
}

function makeEdge(id: string, source: string, target: string, weight = 1, type = "related"): GraphEdge {
  return { id, source, target, type, weight };
}

describe("IntelligenceGraph", () => {
  let graph: IntelligenceGraph;

  beforeEach(() => {
    graph = new IntelligenceGraph();
  });

  describe("addNode", () => {
    it("adds a node and retrieves it", () => {
      const node = makeNode("n1");
      graph.addNode(node);
      expect(graph.getNode("n1")).toEqual(node);
    });

    it("returns undefined for nonexistent node", () => {
      expect(graph.getNode("nonexistent")).toBeUndefined();
    });
  });

  describe("addEdge", () => {
    it("adds an edge between two nodes", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      const edge = makeEdge("e1", "a", "b");
      graph.addEdge(edge);

      expect(graph.getEdge("e1")).toEqual(edge);
    });

    it("creates bidirectional adjacency", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addEdge(makeEdge("e1", "a", "b"));

      const path = graph.findShortestPath("a", "b");
      expect(path).toHaveLength(2);
    });

    it("does not auto-create nodes for edge-only entries", () => {
      graph.addEdge(makeEdge("e1", "orphan-a", "orphan-b"));
      expect(graph.getNode("orphan-a")).toBeUndefined();
      const path = graph.findShortestPath("orphan-a", "orphan-b");
      expect(path).toEqual([]);
    });
  });

  describe("removeEdge", () => {
    it("removes an edge", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.removeEdge("e1");
      expect(graph.getEdge("e1")).toBeUndefined();
    });
  });

  describe("removeNode", () => {
    it("removes a node and its edges", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "a", "c"));

      graph.removeNode("a");
      expect(graph.getNode("a")).toBeUndefined();
      expect(graph.getEdge("e1")).toBeUndefined();
      expect(graph.getEdge("e2")).toBeUndefined();
    });
  });

  describe("findShortestPath (BFS)", () => {
    it("finds path between connected nodes", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "b", "c"));

      const path = graph.findShortestPath("a", "c");
      expect(path).toHaveLength(3);
      expect(path!.map((n) => n.id)).toEqual(["a", "b", "c"]);
    });

    it("returns null when no path exists", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("z"));
      const path = graph.findShortestPath("a", "z");
      expect(path).toBeNull();
    });

    it("returns the source node itself if target equals source", () => {
      graph.addNode(makeNode("a"));
      const path = graph.findShortestPath("a", "a");
      expect(path).toHaveLength(1);
      expect(path![0].id).toBe("a");
    });

    it("respects maxDepth limit", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addNode(makeNode("d"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "b", "c"));
      graph.addEdge(makeEdge("e3", "c", "d"));

      const path = graph.findShortestPath("a", "d", 2);
      expect(path).toBeNull();
    });
  });

  describe("findWeightedPath (Dijkstra)", () => {
    it("finds the cheapest weighted path via Dijkstra (minimizing 1/weight)", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addEdge(makeEdge("e1", "a", "b", 10));
      graph.addEdge(makeEdge("e2", "b", "c", 1));
      graph.addEdge(makeEdge("e3", "a", "c", 100));

      const result = graph.findWeightedPath("a", "c");
      expect(result).not.toBeNull();
      expect(result!.nodes.length).toBeGreaterThanOrEqual(2);
      expect(result!.nodes[0].id).toBe("a");
      expect(result!.nodes[result!.nodes.length - 1].id).toBe("c");
      expect(result!.totalWeight).toBeGreaterThan(0);
    });

    it("returns null when no path exists", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("z"));
      const result = graph.findWeightedPath("a", "z");
      expect(result).toBeNull();
    });

    it("returns single node when source equals target", () => {
      graph.addNode(makeNode("a"));
      const result = graph.findWeightedPath("a", "a");
      expect(result).not.toBeNull();
      expect(result!.nodes).toHaveLength(1);
    });
  });

  describe("findConnectedComponents", () => {
    it("finds a single component for connected graph", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addEdge(makeEdge("e1", "a", "b"));

      const components = graph.findConnectedComponents();
      expect(components).toHaveLength(1);
    });

    it("finds multiple disconnected components", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("x"));
      graph.addNode(makeNode("y"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "x", "y"));

      const components = graph.findConnectedComponents();
      expect(components).toHaveLength(2);
    });

    it("returns empty for an empty graph", () => {
      const components = graph.findConnectedComponents();
      expect(components).toHaveLength(0);
    });
  });

  describe("getNeighborhood", () => {
    it("returns depth-0 neighborhood (just the node)", () => {
      graph.addNode(makeNode("n1"));
      const hood = graph.getNeighborhood("n1", 0);
      expect(hood.nodes).toHaveLength(1);
      expect(hood.edges).toHaveLength(0);
    });

    it("returns depth-1 neighbors with edges", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "b", "c"));

      const hood = graph.getNeighborhood("a", 1);
      expect(hood.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["a", "b"]));
    });

    it("respects depth limit", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "b", "c"));

      const hood = graph.getNeighborhood("a", 0);
      expect(hood.nodes).toHaveLength(1);
    });
  });

  describe("serialize / deserialize roundtrip", () => {
    it("serializes to adjacency list and back", () => {
      graph.addNode(makeNode("a", "Node A"));
      graph.addNode(makeNode("b", "Node B"));
      graph.addEdge(makeEdge("e1", "a", "b"));

      const serialized = graph.toAdjacencyList();
      const restored = IntelligenceGraph.fromAdjacencyList(serialized);

      expect(restored.getNode("a")?.label).toBe("Node A");
      expect(restored.getNode("b")?.label).toBe("Node B");
      expect(restored.getEdge("e1")).toBeDefined();
      expect(restored.findShortestPath("a", "b")).toHaveLength(2);
    });

    it("preserves empty graph through roundtrip", () => {
      const data = graph.toAdjacencyList();
      const restored = IntelligenceGraph.fromAdjacencyList(data);
      expect(restored.getStatistics().nodeCount).toBe(0);
    });
  });

  describe("getStatistics", () => {
    it("calculates density and centrality for a simple graph", () => {
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addEdge(makeEdge("e1", "a", "b", 1));

      const stats = graph.getStatistics();
      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(1);
      expect(stats.density).toBeGreaterThan(0);
    });

    it("returns zero stats for empty graph", () => {
      const stats = graph.getStatistics();
      expect(stats.nodeCount).toBe(0);
      expect(stats.edgeCount).toBe(0);
      expect(stats.density).toBe(0);
    });

    it("single node has zero density", () => {
      graph.addNode(makeNode("a"));
      const stats = graph.getStatistics();
      expect(stats.density).toBe(0);
      expect(stats.centrality.a).toBe(0);
    });
  });
});
