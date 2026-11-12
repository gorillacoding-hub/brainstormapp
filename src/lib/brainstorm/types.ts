export type Template = "free" | "boxes" | "circles";
export type Shape = "box" | "circle";
export type Tone = "paper" | "sand" | "ink" | "copper";
export type Port = "n" | "e" | "s" | "w";
export type Tool = "select" | "idea" | "link" | "pan";

export type Idea = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  shape: Shape;
  tone: Tone;
};

export type Arrow = {
  id: string;
  fromId: string;
  toId: string;
  fromPort: Port;
  toPort: Port;
  label: string;
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
};

export type Selection =
  | { kind: "idea"; id: string }
  | { kind: "arrow"; id: string }
  | null;

export const TONES: { id: Tone; label: string }[] = [
  { id: "paper", label: "Paper" },
  { id: "sand", label: "Sand" },
  { id: "ink", label: "Ink" },
  { id: "copper", label: "Copper" },
];

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
];
