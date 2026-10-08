import type { WorkflowNode } from '../../../types/api';

export type Pos = { x: number; y: number };
export type Positions = Record<string, Pos>;

export const COL = 196;
export const LANE = 170;

/**
 * Derives canvas coordinates from the graph itself, since the API stores no positions.
 * Success keeps a node on its lane and moves it one column right; a failure branch drops to a
 * free lane below. Nodes unreachable from the entry are parked in a trailing column so they
 * stay visible instead of stacking at the origin.
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

  const walk = (key: string | null | undefined, col: number, lane: number) => {
    if (!key || placed[key] || !byKey.has(key)) return;
    placed[key] = { x: col * COL, y: lane * LANE };
    if (!laneTaken.includes(lane)) laneTaken.push(lane);
    const node = byKey.get(key)!;
    walk(node.successNext, col + 1, lane);
    if (node.failureNext) walk(node.failureNext, col + 1, nextFreeLane(lane + 1));
  };

  if (nodes.length) walk(nodes[0].key, 0, 0);

  // Anything the entry chain never reaches still needs a home.
  let orphanCol = Math.max(0, ...Object.values(placed).map((p) => p.x / COL)) + 1;
  for (const n of nodes) {
    if (placed[n.key]) continue;
    placed[n.key] = { x: orphanCol * COL, y: 0 };
    orphanCol++;
  }
  return placed;
}

const storageKey = (id: number | null) => `autoops.flow.${id ?? 'new'}`;

/** Manual drags are a local viewing preference, so they live in localStorage, not the workflow. */
export function loadPositions(id: number | null): Positions {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Positions) : {};
  } catch {
    return {};
  }
}

export function savePositions(id: number | null, positions: Positions) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(positions));
  } catch {
    // storage unavailable; auto-layout still applies on next load
  }
}
