export type Template = "free" | "boxes" | "circles" | "tree";
export type Shape = "box" | "circle";
export type Tone =
  | "paper"
  | "sand"
  | "ink"
  | "copper"
  | "rose"
  | "amber"
  | "sage"
  | "mint"
  | "sky"
  | "lilac";
export type Port = "n" | "e" | "s" | "w";
export type Tool = "select" | "idea" | "link" | "pan";
/** free: place anything anywhere. logic: one tidy grid, same size for every box / circle. */
export type Mode = "free" | "logic";
export type ArrowStyle = "2d" | "3d";

export type Idea = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  shape: Shape;
  tone: Tone;
  /** Grow the container so the whole note shows. */
  full?: boolean;
  /** Size before "full note" growth, restored when it is switched off. */
  baseW?: number;
  baseH?: number;
};

export type Arrow = {
  id: string;
  fromId: string;
  toId: string;
  fromPort: Port;
  toPort: Port;
  label: string;
  /** Hex color chosen by the user; undefined = automatic. */
  color?: string;
};

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export type Board = {
  id: string;
  name: string;
  template: Template;
  ideas: Idea[];
  arrows: Arrow[];
  camera: Camera;
  mode: Mode;
  /** Show guide lines (the grid slots boxes and circles can sit in). */
  grid: boolean;
  arrowStyle: ArrowStyle;
  /** Hex background color; empty string = default. */
  background: string;
};

export type Selection =
  | { kind: "idea"; id: string }
  | { kind: "arrow"; id: string }
  | null;

export const DEFAULT_BACKGROUND = "#12110f";
export const COPPER = "#e07a3d";

export const TONES: { id: Tone; label: string; fill: string; ink: string; line: string }[] = [
  { id: "paper", label: "Paper", fill: "#f3eee4", ink: "#1c1915", line: "#f3eee4" },
  { id: "sand", label: "Sand", fill: "#e4d2ae", ink: "#1c1915", line: "#e4d2ae" },
  { id: "ink", label: "Ink", fill: "#2a2622", ink: "#f4efe6", line: "#a3988b" },
  { id: "copper", label: "Copper", fill: "#e07a3d", ink: "#2a160c", line: "#e07a3d" },
  { id: "rose", label: "Rose", fill: "#e8a0a8", ink: "#2b1216", line: "#e8a0a8" },
  { id: "amber", label: "Amber", fill: "#f2c14e", ink: "#2b2108", line: "#f2c14e" },
  { id: "sage", label: "Sage", fill: "#a9c8a0", ink: "#14210f", line: "#a9c8a0" },
  { id: "mint", label: "Mint", fill: "#8fd6c4", ink: "#0d2822", line: "#8fd6c4" },
  { id: "sky", label: "Sky", fill: "#8fb8e8", ink: "#0e1f33", line: "#8fb8e8" },
  { id: "lilac", label: "Lilac", fill: "#b9a6e6", ink: "#1f1636", line: "#b9a6e6" },
];

export function toneOf(id: Tone) {
  return TONES.find((tone) => tone.id === id) ?? TONES[0];
}

export const ARROW_COLORS: { color: string; label: string }[] = [
  { color: "#f3eee4", label: "White" },
  { color: "#a3988b", label: "Grey" },
  { color: "#1c1915", label: "Black" },
  { color: "#e07a3d", label: "Copper" },
  { color: "#f2c14e", label: "Amber" },
  { color: "#e8a0a8", label: "Rose" },
  { color: "#a9c8a0", label: "Sage" },
  { color: "#8fd6c4", label: "Mint" },
  { color: "#8fb8e8", label: "Sky" },
  { color: "#b9a6e6", label: "Lilac" },
];

export const BACKGROUNDS: { color: string; label: string }[] = [
  { color: "", label: "Default" },
  { color: "#000000", label: "Black" },
  { color: "#1b2433", label: "Navy" },
  { color: "#17261f", label: "Forest" },
  { color: "#2a1d2e", label: "Plum" },
  { color: "#f6f2ea", label: "Cream" },
  { color: "#ffffff", label: "White" },
  { color: "#e8eef5", label: "Mist" },
];

export const BOARD_DEFAULTS: Pick<Board, "mode" | "grid" | "arrowStyle" | "background"> = {
  mode: "free",
  grid: false,
  arrowStyle: "2d",
  background: "",
};

export const TEMPLATES: { id: Template; label: string; blurb: string }[] = [
  {
    id: "free",
    label: "Free",
    blurb: "An open canvas. Drop a thought anywhere and draw an arrow to the next.",
  },
  {
    id: "boxes",
    label: "Boxes",
    blurb: "Rectangular cards for a looser map — the problem, the people, and a next step.",
  },
  {
    id: "circles",
    label: "Circles",
    blurb: "Round nodes around a center, for one theme and the ideas orbiting it.",
  },
  {
    id: "tree",
    label: "Tree",
    blurb: "A classic top-down tree: one main idea, its branches, and the details under each.",
  },
];
