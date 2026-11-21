import { curve, offsetPoint, portPoint, type Curve, type Point } from "@/lib/brainstorm/geometry";
import { contrastRatio, isHex, isLight, mixColors, shade, tint } from "@/lib/brainstorm/color";
import { COPPER, DEFAULT_BACKGROUND, toneOf } from "@/lib/brainstorm/types";
import type { Arrow, ArrowStyle, Board, Idea, Port } from "@/lib/brainstorm/types";

/** Length of the shared stub where arrows into the same point merge. */
const STUB = 44;

export type ArrowLayout = { arrow: Arrow; curve: Curve; color: string; merged: boolean };
export type MergeLayout = {
  key: string;
  from: Point;
  to: Point;
  port: Port;
  color: string;
  count: number;
};

export function backgroundOf(board: Pick<Board, "background">): string {
  return isHex(board.background) ? board.background : DEFAULT_BACKGROUND;
}

/** The user's color if set, otherwise the source idea's color (kept readable on the background). */
export function arrowColor(arrow: Arrow, from: Idea, background: string): string {
  if (arrow.color && isHex(arrow.color)) return arrow.color;
  const line = toneOf(from.tone).line;
  if (contrastRatio(line, background) >= 2.2) return line;
  return isLight(background) ? "#3a342c" : "#f3eee4";
}

export function layoutArrows(board: Pick<Board, "ideas" | "arrows" | "background">): {
  items: ArrowLayout[];
  merges: MergeLayout[];
} {
  const background = backgroundOf(board);
  const byId = new Map(board.ideas.map((idea) => [idea.id, idea]));
  const valid = board.arrows.filter((a) => byId.has(a.fromId) && byId.has(a.toId));

  const groups = new Map<string, Arrow[]>();
  for (const arrow of valid) {
    const k = `${arrow.toId}:${arrow.toPort}`;
    const list = groups.get(k);
    if (list) list.push(arrow);
    else groups.set(k, [arrow]);
  }

  const items: ArrowLayout[] = [];
  for (const arrow of valid) {
    const from = byId.get(arrow.fromId)!;
    const to = byId.get(arrow.toId)!;
    const fromPt = portPoint(from, arrow.fromPort);
    const toPt = portPoint(to, arrow.toPort);
    const merged = (groups.get(`${arrow.toId}:${arrow.toPort}`)?.length ?? 0) >= 2;
    const end = merged ? offsetPoint(toPt, arrow.toPort, STUB) : toPt;
    items.push({
      arrow,
      curve: curve(fromPt, arrow.fromPort, end, arrow.toPort),
      color: arrowColor(arrow, from, background),
      merged,
    });
  }

  const colorOf = new Map(items.map((item) => [item.arrow.id, item.color]));
  const merges: MergeLayout[] = [];
  for (const [k, list] of groups) {
    if (list.length < 2) continue;
    const to = byId.get(list[0].toId)!;
    const port = list[0].toPort;
    const toPt = portPoint(to, port);
    merges.push({
      key: k,
      from: offsetPoint(toPt, port, STUB),
      to: toPt,
      port,
      color: mixColors(list.map((a) => colorOf.get(a.id) ?? COPPER)),
      count: list.length,
    });
  }
  return { items, merges };
}

export type Layer = {
  stroke: string;
  width: number;
  dx: number;
  dy: number;
  opacity: number;
  blur: boolean;
};

/** 3D arrows are drawn as a lit tube: soft shadow, dark edge, body, highlight. */
export function tubeLayers(color: string, base: number): Layer[] {
  return [
    { stroke: "#000000", width: base * 3.4, dx: 0, dy: base * 1.9, opacity: 0.35, blur: true },
    { stroke: shade(color, 0.45), width: base * 3.3, dx: 0, dy: 0, opacity: 1, blur: false },
    { stroke: color, width: base * 2.4, dx: 0, dy: 0, opacity: 1, blur: false },
    { stroke: tint(color, 0.6), width: base * 0.85, dx: -base * 0.3, dy: -base * 0.5, opacity: 0.9, blur: false },
  ];
}

export function markerId(color: string, style: ArrowStyle): string {
  return `fa-${style}-${color.slice(1).toLowerCase()}`;
}

export function markerSize(style: ArrowStyle): number {
  return style === "3d" ? 16 : 13;
}

export function headShapes(color: string, style: ArrowStyle): { d: string; fill: string }[] {
  if (style === "2d") return [{ d: "M 0 1 L 10 5 L 0 9 Z", fill: color }];
  return [
    { d: "M 0 0.5 L 10 5 L 0 5 Z", fill: tint(color, 0.35) },
    { d: "M 0 5 L 10 5 L 0 9.5 Z", fill: shade(color, 0.4) },
  ];
}
