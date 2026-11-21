import type { Idea } from "@/lib/brainstorm/types";

const PAD_X = 16;
const PAD_Y = 12;

function textHeight(text: string, width: number): number {
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

/** Container size that shows the whole note. Circles grow evenly; boxes grow taller. */
export function fitSize(
  idea: Pick<Idea, "text" | "shape">,
  base: { w: number; h: number },
): { w: number; h: number } {
  if (idea.shape === "circle") {
    for (let d = Math.max(base.w, 96); d <= 720; d += 12) {
      const width = d * 0.72;
      const height = textHeight(idea.text, width * 0.97);
      if (Math.hypot(width, height) <= d - 14) return { w: d, h: d };
    }
    return { w: 720, h: 720 };
  }
  const needed = textHeight(idea.text, base.w - PAD_X * 2 - 2) + PAD_Y * 2 + 4;
  return { w: base.w, h: Math.max(base.h, Math.ceil(needed / 4) * 4) };
}

/** The idea at the size the user set (undo the "full note" growth). */
export function restoreBase(idea: Idea): Idea {
  if (idea.baseW == null) return idea;
  const { baseW, baseH, ...rest } = idea;
  return { ...rest, w: baseW, h: baseH ?? idea.h };
}

/** Apply (or remove) the "full note" growth according to idea.full. Safe to call repeatedly. */
export function withFit(idea: Idea): Idea {
  const flat = restoreBase(idea);
  if (!flat.full) return flat;
  const size = fitSize(flat, { w: flat.w, h: flat.h });
  return { ...flat, baseW: flat.w, baseH: flat.h, w: size.w, h: size.h };
}
