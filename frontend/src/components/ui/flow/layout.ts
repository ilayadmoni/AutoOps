import type { WorkflowNode } from '../../../types/api';

export type Pos = { x: number; y: number };
export type Positions = Record<string, Pos>;

/** Vertical distance between consecutive steps. */
export const ROW = 150;
/** Horizontal distance between parallel lanes (a failure branch opens a new lane). */
export const LANE = 300;

/**
 * Derives canvas coordinates from the graph itself, since the API stores no positions. The flow runs top to
 * bottom: success keeps a node in its lane one row lower; a failure branch moves to a free lane on the right.
 * Nodes unreachable from the entry are parked in rows below so they stay visible instead of stacking at the origin.
 */
export function autoLayout(nodes: WorkflowNode[]): Positions {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const placed: Positions = {};
  const laneTaken: number[] = [];

  const nextFreeLane = (from: number) => {
    let lane = from;
    while (laneTaken.includes(lane)) lane++;
    return lane;
  };

  const walk = (key: string | null | undefined, row: number, lane: number) => {
    if (!key || placed[key] || !byKey.has(key)) return;
    placed[key] = { x: lane * LANE, y: row * ROW };
    if (!laneTaken.includes(lane)) laneTaken.push(lane);
    const node = byKey.get(key)!;
    walk(node.successNext, row + 1, lane);
    if (node.failureNext) walk(node.failureNext, row + 1, nextFreeLane(lane + 1));
  };

  if (nodes.length) walk(nodes[0].key, 0, 0);

  // Anything the entry chain never reaches still needs a home.
  let orphanRow = Math.max(-1, ...Object.values(placed).map((p) => p.y / ROW)) + 1;
  for (const n of nodes) {
    if (placed[n.key]) continue;
    placed[n.key] = { x: 0, y: orphanRow * ROW };
    orphanRow++;
  }
  return placed;
}

const storageKey = (id: number | string | null) => `autoops.flow.v2.${id ?? 'new'}`;

/** Manual drags are a local viewing preference, so they live in localStorage, not the workflow. */
export function loadPositions(id: number | string | null): Positions {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Positions) : {};
  } catch {
    return {};
  }
}

export function savePositions(id: number | string | null, positions: Positions) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(positions));
  } catch {
    // storage unavailable; auto-layout still applies on next load
  }
}
