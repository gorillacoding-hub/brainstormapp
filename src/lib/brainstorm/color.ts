export type RGB = { r: number; g: number; b: number };

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function hexToRgb(hex: string): RGB {
  if (!isHex(hex)) return { r: 128, g: 128, b: 128 };
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Average of several colors (used where arrows merge). */
export function mixColors(colors: string[]): string {
  if (!colors.length) return "#808080";
  let r = 0;
  let g = 0;
  let b = 0;
  for (const color of colors) {
    const c = hexToRgb(color);
    r += c.r;
    g += c.g;
    b += c.b;
  }
  const n = colors.length;
  return rgbToHex({ r: r / n, g: g / n, b: b / n });
}

export function mixTwo(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export function shade(hex: string, amount: number): string {
  return mixTwo(hex, "#000000", amount);
}

export function tint(hex: string, amount: number): string {
  return mixTwo(hex, "#ffffff", amount);
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.42;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
