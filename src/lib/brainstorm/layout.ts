import type { Idea, Shape } from "@/lib/brainstorm/types";
import { restoreBase } from "@/lib/brainstorm/fit";

/** Logic mode: one lattice of equal cells, one fixed size per shape. */
export const LOGIC_CELL = { w: 248, h: 168 };
export const LOGIC_SIZE: Record<Shape, { w: number; h: number }> = {
  box: { w: 200, h: 104 },
  circle: { w: 136, h: 136 },
};
/** Outline drawn for each slot when guide lines are on. */
export const GUIDE_SLOT = { w: LOGIC_CELL.w - 32, h: LOGIC_CELL.h - 32 };

/** Pictures are squares; this fits inside one guide slot. */
export const LOGIC_IMAGE = { w: 136, h: 136 };

export function logicSize(shape: Shape, image?: boolean): { w: number; h: number } {
  if (image) return LOGIC_IMAGE;
  return LOGIC_SIZE[shape];
}

function key(cx: number, cy: number) {
  return `${cx}:${cy}`;
}

/** Nearest free lattice slot (world center) to the given point. */
export function pickCell(
  ideas: Pick<Idea, "id" | "x" | "y">[],
  selfId: string | null,
  x: number,
  y: number,
): { x: number; y: number } {
  const taken = new Set<string>();
  for (const idea of ideas) {
    if (idea.id === selfId) continue;
    taken.add(key(Math.round(idea.x / LOGIC_CELL.w), Math.round(idea.y / LOGIC_CELL.h)));
  }
  const fx = x / LOGIC_CELL.w;
  const fy = y / LOGIC_CELL.h;
  const bx = Math.round(fx);
  const by = Math.round(fy);
  let best: { cx: number; cy: number } | null = null;
  let bestDist = Infinity;
  let bestRing = 0;
  for (let ring = 0; ring <= 40; ring++) {
    if (best && ring > bestRing + 1) break;
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const cx = bx + dx;
        const cy = by + dy;
        if (taken.has(key(cx, cy))) continue;
        const dist = (cx - fx) ** 2 + (cy - fy) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = { cx, cy };
          bestRing = ring;
        }
      }
    }
  }
  const cell = best ?? { cx: bx, cy: by };
  return { x: cell.cx * LOGIC_CELL.w, y: cell.cy * LOGIC_CELL.h };
}

/** Put every idea on the lattice at its uniform size, keeping the reading order (top to bottom, left to right). */
export function relayoutLogic(ideas: Idea[]): Idea[] {
  const order = [...ideas].sort((a, b) => Math.round(a.y / 40) - Math.round(b.y / 40) || a.x - b.x);
  const placed: Idea[] = [];
  const byId = new Map<string, Idea>();
  for (const original of order) {
    const idea = restoreBase(original);
    const size = logicSize(idea.shape, Boolean(idea.image));
    const spot = pickCell(placed, idea.id, idea.x, idea.y);
    const next: Idea = { ...idea, x: spot.x, y: spot.y, w: size.w, h: size.h };
    placed.push(next);
    byId.set(next.id, next);
  }
  return ideas.map((idea) => byId.get(idea.id) ?? idea);
}
