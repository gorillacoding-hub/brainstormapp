import type { Idea } from "@/lib/brainstorm/types";

const PAD_X = 16;
const PAD_Y = 12;
/** Boxes get wider first, up to this width, and only then taller. */
const BOX_MAX_W = 380;
const CIRCLE_MAX_D = 960;
export const FONT_PX = 17;
export const MIN_FONT_PX = 9;

function textHeight(text: string, width: number, fontPx?: number): number {
  if (typeof document === "undefined") return 0;
  const host = document.createElement("div");
  host.className = "idea-node";
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    width: `${Math.max(40, Math.floor(width))}px`,
    height: "auto",
    transform: "none",
    boxShadow: "none",
  });
  if (fontPx) host.style.fontSize = `${fontPx}px`;
  const p = document.createElement("p");
  p.style.margin = "0";
  p.style.width = "100%";
  p.style.overflowWrap = "break-word";
  p.style.whiteSpace = "pre-wrap";
  p.textContent = text || "New idea";
  host.appendChild(p);
  document.body.appendChild(host);
  const height = p.getBoundingClientRect().height;
  host.remove();
  return height;
}

/** Does the text fit a circle of diameter d (text column = 72% of d)? */
function fitsCircle(text: string, d: number, fontPx?: number): boolean {
  const width = d * 0.72;
  const height = textHeight(text, width * 0.97, fontPx);
  return Math.hypot(width, height) <= d - 14;
}

/**
 * Container size that shows the whole note.
 * Circles grow evenly. Boxes grow wider first (up to a limit), then taller.
 */
export function fitSize(
  idea: Pick<Idea, "text" | "shape">,
  base: { w: number; h: number },
): { w: number; h: number } {
  if (idea.shape === "circle") {
    for (let d = Math.max(base.w, 96); d <= CIRCLE_MAX_D; d += 12) {
      if (fitsCircle(idea.text, d)) return { w: d, h: d };
    }
    return { w: CIRCLE_MAX_D, h: CIRCLE_MAX_D };
  }
  const need = (w: number) => textHeight(idea.text, w - PAD_X * 2 - 2) + PAD_Y * 2 + 4;
  let w = base.w;
  while (w < BOX_MAX_W && need(w) > base.h) w += 12;
  w = Math.min(w, Math.max(BOX_MAX_W, base.w));
  return { w, h: Math.max(base.h, Math.ceil(need(w) / 4) * 4) };
}

/**
 * Largest font size (px) at which the note fits a fixed-size container.
 * Used in Logic mode, where every box / circle keeps one size.
 */
export function fitFont(text: string, shape: Idea["shape"], w: number, h: number): number {
  if (!text.trim()) return FONT_PX;
  for (let px = FONT_PX; px > MIN_FONT_PX; px -= 1) {
    if (shape === "circle") {
      if (fitsCircle(text, w, px)) return px;
    } else if (textHeight(text, w - PAD_X * 2 - 2, px) <= h - PAD_Y * 2 - 2) {
      return px;
    }
  }
  return MIN_FONT_PX;
}

/** The idea at the size the user set (undo the text growth). */
export function restoreBase(idea: Idea): Idea {
  if (idea.baseW == null) return idea;
  const { baseW, baseH, ...rest } = idea;
  return { ...rest, w: baseW, h: baseH ?? idea.h };
}

/** Make the container fit its text. Pictures stay square. Safe to call repeatedly. */
export function withFit(idea: Idea): Idea {
  const flat = restoreBase(idea);
  if (flat.image) return flat;
  const size = fitSize(flat, { w: flat.w, h: flat.h });
  return { ...flat, baseW: flat.w, baseH: flat.h, w: size.w, h: size.h };
}
