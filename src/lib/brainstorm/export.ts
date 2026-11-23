import { halfExtents } from "@/lib/brainstorm/geometry";
import { backgroundOf, headShapes, layoutArrows, markerId, markerSize, tubeLayers } from "@/lib/brainstorm/arrows";
import { isLight } from "@/lib/brainstorm/color";
import { COPPER, toneOf } from "@/lib/brainstorm/types";
import type { Board } from "@/lib/brainstorm/types";

export type Measure = (text: string, fontSize: number) => number;

export const EXPORT_FONT = 'Georgia, "Times New Roman", serif';
const SANS = "Helvetica, Arial, sans-serif";
const FONT_SIZE = 17;
const LEADING = 1.35;
const MIN_FONT = 9;
const PAD = 72;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function wrapLines(text: string, maxWidth: number, measure: (t: string) => number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (let word of words) {
      while (word.length > 1 && measure(word) > maxWidth) {
        let k = word.length - 1;
        while (k > 1 && measure(word.slice(0, k)) > maxWidth) k--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, k));
        word = word.slice(k);
      }
      const trial = line ? `${line} ${word}` : word;
      if (line && measure(trial) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    out.push(line);
  }
  return out;
}

export function boardBounds(board: Board) {
  if (!board.ideas.length) return { minX: -400, minY: -300, maxX: 400, maxY: 300 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idea of board.ideas) {
    const { hx, hy } = halfExtents(idea);
    minX = Math.min(minX, idea.x - hx);
    maxX = Math.max(maxX, idea.x + hx);
    minY = Math.min(minY, idea.y - hy);
    maxY = Math.max(maxY, idea.y + hy);
  }
  return { minX, minY, maxX, maxY };
}

/** The whole board as a self-contained SVG (vector, so it stays sharp at any size). */
export function buildSvg(
  board: Board,
  measure: Measure,
): { svg: string; width: number; height: number; background: string } {
  const background = backgroundOf(board);
  const light = isLight(background);
  const b = boardBounds(board);
  const width = Math.ceil(b.maxX - b.minX + PAD * 2);
  const height = Math.ceil(b.maxY - b.minY + PAD * 2);
  const ox = PAD - b.minX;
  const oy = PAD - b.minY;
  const style = board.arrowStyle;
  const { items, merges } = layoutArrows(board);

  const colors = new Set<string>([COPPER]);
  for (const item of items) if (!item.merged) colors.add(item.color);
  for (const merge of merges) colors.add(merge.color);

  const defs: string[] = [
    `<filter id="fa-blur" filterUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><feGaussianBlur stdDeviation="2.2"/></filter>`,
    `<filter id="fa-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="10" stdDeviation="11" flood-color="#000" flood-opacity="${light ? 0.22 : 0.4}"/></filter>`,
  ];
  const size = markerSize(style);
  for (const color of colors) {
    const shapes = headShapes(color, style)
      .map((s) => `<path d="${s.d}" fill="${s.fill}"/>`)
      .join("");
    defs.push(
      `<marker id="${markerId(color, style)}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="${size}" markerHeight="${size}" orient="auto">${shapes}</marker>`,
    );
  }

  function stroke(d: string, color: string, base: number, head?: string): string {
    if (style === "2d") {
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(base)}" stroke-linecap="round"${head ? ` marker-end="url(#${head})"` : ""}/>`;
    }
    const layers = tubeLayers(color, base)
      .map(
        (l) =>
          `<path d="${d}" fill="none" stroke="${l.stroke}" stroke-width="${num(l.width)}" stroke-linecap="round" stroke-opacity="${l.opacity}"${l.dx || l.dy ? ` transform="translate(${num(l.dx)} ${num(l.dy)})"` : ""}${l.blur ? ' filter="url(#fa-blur)"' : ""}/>`,
      )
      .join("");
    return `<g>${layers}${head ? `<path d="${d}" fill="none" stroke="none" marker-end="url(#${head})"/>` : ""}</g>`;
  }

  const arrowParts: string[] = [];
  for (const item of items) {
    arrowParts.push(stroke(item.curve.d, item.color, 1.75, item.merged ? undefined : markerId(item.color, style)));
  }
  for (const merge of merges) {
    const d = `M ${num(merge.from.x)} ${num(merge.from.y)} L ${num(merge.to.x)} ${num(merge.to.y)}`;
    arrowParts.push(stroke(d, merge.color, 2.3, markerId(merge.color, style)));
    arrowParts.push(`<circle cx="${num(merge.from.x)}" cy="${num(merge.from.y)}" r="3.6" fill="${merge.color}"/>`);
  }

  const labelParts: string[] = [];
  for (const item of items) {
    const label = item.arrow.label.trim();
    if (!label) continue;
    const w = Math.min(180, measure(label, 12) + 22);
    const { x, y } = item.curve.mid;
    labelParts.push(
      `<rect x="${num(x - w / 2)}" y="${num(y - 11)}" width="${num(w)}" height="22" rx="11" fill="${light ? "#ffffff" : "#1c1a17"}" stroke="${light ? "#d9d2c5" : "#3a342c"}"/>` +
        `<text x="${num(x)}" y="${num(y + 4)}" text-anchor="middle" font-family='${SANS}' font-size="12" fill="${light ? "#2a2622" : "#f4efe6"}">${esc(label)}</text>`,
    );
  }

  const ideaParts: string[] = [];
  for (const idea of board.ideas) {
    const tone = toneOf(idea.tone);
    const circle = idea.shape === "circle";
    const outline = tone.id === "ink" ? ` stroke="#3a342c" stroke-width="1"` : "";
    const shape = circle
      ? `<circle cx="${num(idea.x)}" cy="${num(idea.y)}" r="${num(idea.w / 2)}" fill="${tone.fill}"${outline} filter="url(#fa-shadow)"/>`
      : `<rect x="${num(idea.x - idea.w / 2)}" y="${num(idea.y - idea.h / 2)}" width="${num(idea.w)}" height="${num(idea.h)}" rx="14" fill="${tone.fill}"${outline} filter="url(#fa-shadow)"/>`;
    if (idea.image) {
      const inset = 6;
      const side = idea.w - inset * 2;
      const clip = `fa-clip-${ideaParts.length}`;
      defs.push(
        `<clipPath id="${clip}"><rect x="${num(idea.x - side / 2)}" y="${num(idea.y - side / 2)}" width="${num(side)}" height="${num(side)}" rx="8"/></clipPath>`,
      );
      // "meet" = the whole picture, never cropped or stretched.
      const picture = `<image href="${idea.image}" x="${num(idea.x - side / 2)}" y="${num(idea.y - side / 2)}" width="${num(side)}" height="${num(side)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clip})"/>`;
      ideaParts.push(`${shape}${picture}`);
      continue;
    }
    const textWidth = circle ? idea.w * 0.72 : idea.w - 32;
    const fits = (lineCount: number, fs: number) => {
      const height = lineCount * fs * LEADING;
      return circle ? Math.hypot(textWidth, height) <= idea.w - 14 : height <= idea.h - 24;
    };
    // Largest font (17 down to 9) at which the whole note fits; boxes fitted in the app land on 17.
    let fontSize = FONT_SIZE;
    let lines = idea.text.trim() ? wrapLines(idea.text, textWidth, (t) => measure(t, fontSize)) : [];
    while (lines.length && !fits(lines.length, fontSize) && fontSize > MIN_FONT) {
      fontSize -= 1;
      lines = wrapLines(idea.text, textWidth, (t) => measure(t, fontSize));
    }
    const lineHeight = fontSize * LEADING;
    const top = idea.y - (lines.length * lineHeight) / 2;
    const text = lines
      .map(
        (line, i) =>
          `<text x="${num(idea.x)}" y="${num(top + i * lineHeight + fontSize * 0.97)}" text-anchor="middle" font-family='${EXPORT_FONT}' font-size="${fontSize}" fill="${tone.ink}" xml:space="preserve">${esc(line)}</text>`,
      )
      .join("");
    ideaParts.push(`${shape}${text}`);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<title>${esc(board.name)}</title><defs>${defs.join("")}</defs>` +
    `<rect width="${width}" height="${height}" fill="${background}"/>` +
    `<g transform="translate(${num(ox)} ${num(oy)})">${arrowParts.join("")}${labelParts.join("")}${ideaParts.join("")}</g></svg>`;
  return { svg, width, height, background };
}

/** Browser text measurement matching the export font. */
export function makeMeasure(): Measure {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  return (text, fontSize) => {
    if (!ctx) return text.length * fontSize * 0.55;
    ctx.font = `${fontSize}px ${EXPORT_FONT}`;
    return ctx.measureText(text).width;
  };
}

/** Render the SVG to a high-resolution JPEG (up to ~4096 px on the long side). */
export async function svgToJpeg(svg: string, width: number, height: number, background: string): Promise<Blob> {
  const scale = Math.min(4, Math.max(1, 4096 / Math.max(width, height)));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const image = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not render board"));
    image.src = url;
  });
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode JPG"))), "image/jpeg", 0.95);
  });
}

export function fileSafe(name: string): string {
  const cleaned = name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  return cleaned || "filament-board";
}
