import type { Arrow, Camera, Idea, Port, Shape } from "@/lib/brainstorm/types";

export type Point = { x: number; y: number };

export const PORTS: Port[] = ["n", "e", "s", "w"];
export const MIN_ZOOM = 0.28;
export const MAX_ZOOM = 2.1;

const DIR: Record<Port, Point> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
};

export function uid(): string {
  return crypto.randomUUID();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function snap(n: number, step = 8): number {
  return Math.round(n / step) * step;
}

export function halfExtents(idea: Pick<Idea, "w" | "h" | "shape">): { hx: number; hy: number } {
  if (idea.shape === "circle") {
    const r = idea.w / 2;
    return { hx: r, hy: r };
  }
  return { hx: idea.w / 2, hy: idea.h / 2 };
}

export function portPoint(idea: Idea, port: Port): Point {
  const { hx, hy } = halfExtents(idea);
  const d = DIR[port];
  return { x: idea.x + d.x * hx, y: idea.y + d.y * hy };
}

export function nearestPort(idea: Idea, p: Point): Port {
  let best: Port = "e";
  let bestD = Infinity;
  for (const port of PORTS) {
    const q = portPoint(idea, port);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = port;
    }
  }
  return best;
}

export function facingPorts(a: Pick<Idea, "x" | "y">, b: Pick<Idea, "x" | "y">): { from: Port; to: Port } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: "e", to: "w" } : { from: "w", to: "e" };
  }
  return dy >= 0 ? { from: "s", to: "n" } : { from: "n", to: "s" };
}

export type Curve = {
  d: string;
  mid: Point;
  from: Point;
  to: Point;
  c1: Point;
  c2: Point;
};

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

export function curve(from: Point, fromPort: Port, to: Point, toPort: Port): Curve {
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const pull = Math.min(168, Math.max(40, dist * 0.42));
  const c1 = { x: from.x + DIR[fromPort].x * pull, y: from.y + DIR[fromPort].y * pull };
  const c2 = { x: to.x + DIR[toPort].x * pull, y: to.y + DIR[toPort].y * pull };
  const mid = cubic(from, c1, c2, to, 0.5);
  const d = `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
  return { d, mid, from, to, c1, c2 };
}

export function projectCurve(c: Curve, project: (p: Point) => Point): { d: string; mid: Point } {
  const from = project(c.from);
  const to = project(c.to);
  const c1 = project(c.c1);
  const c2 = project(c.c2);
  const mid = project(c.mid);
  return {
    mid,
    d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`,
  };
}

export function worldToScreen(p: Point, cam: Camera, view: { w: number; h: number }): Point {
  return {
    x: view.w / 2 + (p.x - cam.x) * cam.zoom,
    y: view.h / 2 + (p.y - cam.y) * cam.zoom,
  };
}

export function clientToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cam: Camera,
): Point {
  const sx = clientX - rect.left - rect.width / 2;
  const sy = clientY - rect.top - rect.height / 2;
  return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
}

export function defaultSize(shape: Shape): { w: number; h: number } {
  if (shape === "circle") return { w: 136, h: 136 };
  return { w: 204, h: 108 };
}

function chromeInsets(view: { w: number; h: number }) {
  if (view.w < 768) return { top: 72, right: 16, bottom: 92, left: 16 };
  return { top: 72, right: 24, bottom: 28, left: 84 };
}

export function fitCamera(ideas: Idea[], view: { w: number; h: number }): Camera {
  if (!ideas.length || view.w < 8 || view.h < 8) return { x: 0, y: 0, zoom: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idea of ideas) {
    const { hx, hy } = halfExtents(idea);
    minX = Math.min(minX, idea.x - hx);
    maxX = Math.max(maxX, idea.x + hx);
    minY = Math.min(minY, idea.y - hy);
    maxY = Math.max(maxY, idea.y + hy);
  }
  const pad = 56;
  const bw = Math.max(120, maxX - minX + pad * 2);
  const bh = Math.max(120, maxY - minY + pad * 2);
  const inset = chromeInsets(view);
  const safeW = Math.max(120, view.w - inset.left - inset.right);
  const safeH = Math.max(120, view.h - inset.top - inset.bottom);
  const zoom = clamp(Math.min(safeW / bw, safeH / bh, 1.05), MIN_ZOOM, 1.05);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    zoom,
    x: cx - (inset.left - inset.right) / (2 * zoom),
    y: cy - (inset.top - inset.bottom) / (2 * zoom),
  };
}

export function sameLink(a: Arrow, fromId: string, toId: string, fromPort: Port, toPort: Port): boolean {
  return a.fromId === fromId && a.toId === toId && a.fromPort === fromPort && a.toPort === toPort;
}

export function spawnAround(cam: Camera, count: number): Point {
  const angle = count * 2.15;
  const radius = 48 + (count % 6) * 28;
  return {
    x: snap(cam.x + Math.cos(angle) * radius),
    y: snap(cam.y + Math.sin(angle) * radius),
  };
}
