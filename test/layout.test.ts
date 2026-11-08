import { describe, expect, it } from "vitest";
import { buildModel } from "../src/model.js";
import { layoutGraph, NODE } from "../ui/src/graph/layout.js";

const text = `# P — Milestones

## M1. Core
- Needs: none.
- Features:
  - F1. Base: x. Docs: tasks. Needs: none. Status: done.
  - F2. Writes: x. Docs: tasks. Needs: F1. Status: not started.
  - F3. Reads: x. Docs: tasks. Needs: none. Status: not started.

## M2. API
- Needs: M1.
- Features:
  - F1. Accounts: x. Docs: tasks. Needs: M1 F2. Status: not started.
  - F2. Transfers: x. Docs: tasks. Needs: F1. Status: not started.
`;
const model = buildModel("p", new Map([["requirements.md", ""], ["design.md", ""], ["milestones.md", text]]));
const layout = layoutGraph(model);
const node = (id: string) => layout.nodes.find((n) => n.id === id)!;

describe("layoutGraph", () => {
  it("puts one lane per milestone, left to right in build order", () => {
    expect(layout.lanes.map((l) => l.id)).toEqual(["M1", "M2"]);
    expect(layout.lanes[1]!.x).toBeGreaterThan(layout.lanes[0]!.x + layout.lanes[0]!.width);
  });

  it("places each feature in its milestone's lane, dependencies above what needs them", () => {
    for (const id of ["M1·F1", "M1·F2", "M1·F3"]) {
      expect(node(id).x).toBeGreaterThanOrEqual(layout.lanes[0]!.x);
      expect(node(id).x + NODE.width).toBeLessThanOrEqual(layout.lanes[0]!.x + layout.lanes[0]!.width);
    }
    expect(node("M1·F2").y).toBeGreaterThan(node("M1·F1").y);
    expect(node("M2·F2").y).toBeGreaterThan(node("M2·F1").y);
  });

  it("puts features with no dependency in the lane on the first rows", () => {
    expect(node("M1·F3").y).toBeLessThan(node("M1·F2").y);
  });

  it("never overlaps two nodes", () => {
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a === b) continue;
        const apart = a.x + NODE.width <= b.x || b.x + NODE.width <= a.x || a.y + NODE.height <= b.y || b.y + NODE.height <= a.y;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });

  it("fits every node inside the canvas size", () => {
    for (const n of layout.nodes) {
      expect(n.x + NODE.width).toBeLessThanOrEqual(layout.width);
      expect(n.y + NODE.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it("draws a cross-lane edge from the right middle of one node to the left middle of the next", () => {
    const edge = layout.edges.find((e) => e.from === "M1·F2" && e.to === "M2·F1")!;
    const [from, to] = [node("M1·F2"), node("M2·F1")];
    expect(edge.path.startsWith(`M${from.x + NODE.width} ${from.y + NODE.height / 2} C`)).toBe(true);
    expect(edge.path.endsWith(`${to.x} ${to.y + NODE.height / 2}`)).toBe(true);
  });

  it("draws a same-lane edge to the next row straight down from the bottom middle to the top middle", () => {
    const edge = layout.edges.find((e) => e.from === "M2·F1" && e.to === "M2·F2")!;
    const [from, to] = [node("M2·F1"), node("M2·F2")];
    const cx = from.x + NODE.width / 2;
    expect(edge.path).toBe(`M${cx} ${from.y + NODE.height} L${cx} ${to.y}`);
  });

  it("bends a same-lane edge that skips a row out to the right of the nodes", () => {
    const edge = layout.edges.find((e) => e.from === "M1·F1" && e.to === "M1·F2")!;
    const [from, to] = [node("M1·F1"), node("M1·F2")];
    expect(edge.path.startsWith(`M${from.x + NODE.width} ${from.y + NODE.height / 2} C`)).toBe(true);
    expect(edge.path.endsWith(`${to.x + NODE.width} ${to.y + NODE.height / 2}`)).toBe(true);
  });

  it("flags the edges along the critical path", () => {
    expect(model.criticalPath).toEqual(["M1·F2", "M2·F1", "M2·F2"]);
    expect(layout.edges.filter((e) => e.critical).map((e) => `${e.from}>${e.to}`)).toEqual(["M1·F2>M2·F1", "M2·F1>M2·F2"]);
  });
});

/** Points along an SVG path made of M, L and C commands. */
function samplePath(d: string): { x: number; y: number }[] {
  const tokens = d.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? [];
  const points: { x: number; y: number }[] = [];
  let at = { x: 0, y: 0 };
  for (let i = 0; i < tokens.length; ) {
    const cmd = tokens[i++];
    const num = () => Number(tokens[i++]);
    if (cmd === "M") at = { x: num(), y: num() };
    else if (cmd === "L") {
      const to = { x: num(), y: num() };
      for (let t = 0; t <= 1; t += 0.02) points.push({ x: at.x + (to.x - at.x) * t, y: at.y + (to.y - at.y) * t });
      at = to;
    } else if (cmd === "C") {
      const [c1, c2, to] = [{ x: num(), y: num() }, { x: num(), y: num() }, { x: num(), y: num() }];
      for (let t = 0; t <= 1; t += 0.02) {
        const u = 1 - t;
        points.push({
          x: u ** 3 * at.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * to.x,
          y: u ** 3 * at.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * to.y,
        });
      }
      at = to;
    }
  }
  return points;
}

const skipping = buildModel("p", new Map([["requirements.md", ""], ["design.md", ""], ["milestones.md", `# P

## M1. A
- Features:
  - F1. Root: x. Docs: tasks. Needs: none. Status: not started.
  - F2. Other root: x. Docs: tasks. Needs: none. Status: not started.
  - F3. Child: x. Docs: tasks. Needs: F1. Status: not started.

## M2. B
- Features:
  - F1. Middle one: x. Docs: tasks. Needs: none. Status: not started.
  - F2. Middle two: x. Docs: tasks. Needs: none. Status: not started.
  - F3. Middle three: x. Docs: tasks. Needs: none. Status: not started.

## M3. C
- Features:
  - F1. Far: x. Docs: tasks. Needs: M1 F3, M1 F2. Status: not started.
`]]));

describe("edge routing", () => {
  it.each([["the basic fixture", model], ["a fixture with skipped rows and lanes", skipping]])("no edge in %s passes through a node it does not join", (_label, m) => {
    const placed = layoutGraph(m);
    for (const edge of placed.edges) {
      const others = placed.nodes.filter((n) => n.id !== edge.from && n.id !== edge.to);
      for (const point of samplePath(edge.path)) {
        for (const n of others) {
          const inside = point.x > n.x + 1 && point.x < n.x + NODE.width - 1 && point.y > n.y + 1 && point.y < n.y + NODE.height - 1;
          expect(inside, `${edge.from}>${edge.to} crosses ${n.id} at ${point.x.toFixed(0)},${point.y.toFixed(0)}`).toBe(false);
        }
      }
    }
  });
});

/** Straight segments of an SVG path (M and L only; curves are never collinear with them here). */
function segments(d: string): { x1: number; y1: number; x2: number; y2: number }[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (!/^M[^C]*$/.test(d)) return [];
  const out = [];
  for (let i = 0; i + 3 < nums.length; i += 2) out.push({ x1: nums[i]!, y1: nums[i + 1]!, x2: nums[i + 2]!, y2: nums[i + 3]! });
  return out;
}

const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));

const sharing = buildModel("p", new Map([["requirements.md", ""], ["design.md", ""], ["milestones.md", `# P

## M1. A
- Features:
  - F1. Root one: x. Docs: tasks. Needs: none. Status: not started.
  - F2. Root two: x. Docs: tasks. Needs: none. Status: not started.

## M2. B
- Features:
  - F1. Filler: x. Docs: tasks. Needs: none. Status: not started.
  - F2. Other filler: x. Docs: tasks. Needs: none. Status: not started.

## M3. C
- Features:
  - F1. Far one: x. Docs: tasks. Needs: M1 F2. Status: not started.
  - F2. Far two: x. Docs: tasks. Needs: M1 F1. Status: not started.

## M4. D
- Features:
  - F1. Top: x. Docs: tasks. Needs: none. Status: not started.
  - F2. Into row two from M1: x. Docs: tasks. Needs: M1 F1. Status: not started.

## M5. E
- Features:
  - F1. Top: x. Docs: tasks. Needs: none. Status: not started.
  - F2. Into row two from M2: x. Docs: tasks. Needs: M2 F2. Status: not started.
`]]));

it("never lets two edges with different ends share a line segment", () => {
  const placed = layoutGraph(sharing);
  const edges = placed.edges.map((e) => ({ ...e, segs: segments(e.path) }));
  for (const a of edges) {
    for (const b of edges) {
      if (a === b || a.from === b.from || a.to === b.to) continue;
      for (const s of a.segs) {
        for (const t of b.segs) {
          const bothVertical = s.x1 === s.x2 && t.x1 === t.x2 && s.x1 === t.x1;
          const bothHorizontal = s.y1 === s.y2 && t.y1 === t.y2 && s.y1 === t.y1;
          const shared = bothVertical ? overlap(s.y1, s.y2, t.y1, t.y2) : bothHorizontal ? overlap(s.x1, s.x2, t.x1, t.x2) : 0;
          expect(shared, `${a.from}>${a.to} and ${b.from}>${b.to} share a segment`).toBeLessThanOrEqual(1);
        }
      }
    }
  }
});
