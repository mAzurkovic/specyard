import type { ProjectModel } from "../../../src/model.js";

export const NODE = { width: 200, height: 66 };
const LANE = { width: 260, gap: 40, inset: 24, left: 16 };
/** Leaves room above the first row for the lane header and an edge channel under it. */
const TOP = 60;
const ROW = 110;
const BOTTOM = 20;
const CURVE = 60;
/** Same-lane edges that skip rows bend this far into the free margin right of the nodes. */
const SIDE_BEND = 30;

export type Lane = { id: string; name: string; x: number; width: number };
export type PlacedNode = { id: string; x: number; y: number; lane: number };
export type PlacedEdge = { from: string; to: string; path: string; critical: boolean };
export type GraphLayout = { lanes: Lane[]; nodes: PlacedNode[]; edges: PlacedEdge[]; width: number; height: number };

/** One lane per milestone in build order; inside a lane, a feature sits below the features it needs. */
export function layoutGraph(model: ProjectModel): GraphLayout {
  const byId = new Map(model.features.map((f) => [f.id, f]));
  const lanes: Lane[] = [];
  const positions = new Map<string, PlacedNode>();
  let rows = 0;

  model.milestones.forEach((milestone, laneIndex) => {
    const x = laneX(laneIndex);
    lanes.push({ id: milestone.id, name: milestone.name, x, width: LANE.width });

    const depth = new Map<string, number>();
    const depthOf = (id: string, seen = new Set<string>()): number => {
      const known = depth.get(id);
      if (known !== undefined) return known;
      if (seen.has(id)) return 0;
      seen.add(id);
      const inLane = (byId.get(id)?.needs ?? []).filter((n) => byId.get(n)?.milestone === milestone.id);
      const d = inLane.length === 0 ? 0 : 1 + Math.max(...inLane.map((n) => depthOf(n, seen)));
      depth.set(id, d);
      return d;
    };
    const ordered = milestone.features
      .map((id, order) => ({ id, order, depth: depthOf(id) }))
      .sort((a, b) => a.depth - b.depth || a.order - b.order);
    ordered.forEach(({ id }, row) => positions.set(id, { id, x: x + LANE.inset, y: TOP + row * ROW, lane: laneIndex }));
    rows = Math.max(rows, ordered.length);
  });

  const critical = new Set(model.criticalPath.slice(1).map((id, i) => `${model.criticalPath[i]}>${id}`));
  const edges = model.edges.flatMap((e) => {
    const from = positions.get(e.from);
    const to = positions.get(e.to);
    return from && to ? [{ ...e, path: edgePath(from, to), critical: critical.has(`${e.from}>${e.to}`) }] : [];
  });

  return {
    lanes,
    nodes: [...positions.values()],
    edges,
    width: LANE.left * 2 + Math.max(1, lanes.length) * (LANE.width + LANE.gap) - LANE.gap,
    height: TOP + Math.max(1, rows) * ROW - (ROW - NODE.height) + BOTTOM,
  };
}

/**
 * Routes an edge so it never passes behind a node it does not join. Rows line up across lanes,
 * so the gaps between lanes (columns) and between rows (channels) are always free.
 */
function edgePath(from: PlacedNode, to: PlacedNode): string {
  const midFrom = from.y + NODE.height / 2;
  const midTo = to.y + NODE.height / 2;
  if (from.lane === to.lane) {
    if (to.y - from.y === ROW) {
      const cx = from.x + NODE.width / 2;
      return `M${cx} ${from.y + NODE.height} L${cx} ${to.y}`;
    }
    const right = from.x + NODE.width;
    return `M${right} ${midFrom} C${right + SIDE_BEND} ${midFrom}, ${right + SIDE_BEND} ${midTo}, ${right} ${midTo}`;
  }
  const [x1, x2] = [from.x + NODE.width, to.x];
  if (to.lane === from.lane + 1) return `M${x1} ${midFrom} C${x1 + CURVE} ${midFrom}, ${x2 - CURVE} ${midTo}, ${x2} ${midTo}`;
  const leaveColumn = laneX(from.lane) + LANE.width + LANE.gap / 2;
  const enterColumn = laneX(to.lane) - LANE.gap / 2;
  const channel = to.y - (ROW - NODE.height) / 2;
  return `M${x1} ${midFrom} L${leaveColumn} ${midFrom} L${leaveColumn} ${channel} L${enterColumn} ${channel} L${enterColumn} ${midTo} L${x2} ${midTo}`;
}

function laneX(lane: number): number {
  return LANE.left + lane * (LANE.width + LANE.gap);
}
