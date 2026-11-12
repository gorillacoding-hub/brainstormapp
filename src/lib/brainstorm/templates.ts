import { facingPorts, fitCamera, uid } from "@/lib/brainstorm/geometry";
import type { Arrow, Board, Idea, Shape, Template, Tone } from "@/lib/brainstorm/types";

function idea(
  shape: Shape,
  x: number,
  y: number,
  text: string,
  tone: Tone,
  w: number,
  h = w,
): Idea {
  return { id: uid(), shape, x, y, text, tone, w, h: shape === "circle" ? w : h };
}

function link(from: Idea, to: Idea, label = ""): Arrow {
  const ports = facingPorts(from, to);
  return {
    id: uid(),
    fromId: from.id,
    toId: to.id,
    fromPort: ports.from,
    toPort: ports.to,
    label,
  };
}

export function emptyBoard(name = "Untitled"): Board {
  return {
    id: uid(),
    name,
    template: "free",
    ideas: [],
    arrows: [],
    camera: { x: 0, y: 0, zoom: 1 },
  };
}

export function boardFromTemplate(
  template: Template,
  name: string,
  view: { w: number; h: number },
): Board {
  if (template === "boxes") {
    const core = idea("box", 0, -188, "What are we trying to understand?", "paper", 268, 112);
    const who = idea("box", -308, 8, "Who feels this?", "sand", 196, 104);
    const snag = idea("box", 0, 8, "Where does it snag?", "paper", 206, 104);
    const better = idea("box", 308, 8, "What would better look like?", "copper", 228, 104);
    const clues = idea("box", -164, 204, "Clues we already have", "ink", 214, 104);
    const test = idea("box", 176, 204, "A tiny test this week", "sand", 214, 104);
    const ideas = [core, who, snag, better, clues, test];
    const arrows = [
      link(core, who),
      link(core, snag),
      link(core, better),
      link(snag, clues, "because"),
      link(better, test, "try"),
    ];
    return {
      id: uid(),
      name,
      template,
      ideas,
      arrows,
      camera: fitCamera(ideas, view),
    };
  }

  if (template === "circles") {
    const center = idea("circle", 0, 0, "The idea", "copper", 156);
    const labels: { text: string; tone: Tone }[] = [
      { text: "Why it matters", tone: "paper" },
      { text: "Who it's for", tone: "sand" },
      { text: "How it works", tone: "paper" },
      { text: "When it happens", tone: "sand" },
      { text: "What could fail", tone: "ink" },
      { text: "The surprise", tone: "paper" },
    ];
    const orbit = 268;
    const satellites = labels.map((item, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / labels.length;
      return idea(
        "circle",
        Math.cos(angle) * orbit,
        Math.sin(angle) * orbit,
        item.text,
        item.tone,
        132,
      );
    });
    const ideas = [center, ...satellites];
    return {
      id: uid(),
      name,
      template,
      ideas,
      arrows: satellites.map((node) => link(center, node)),
      camera: fitCamera(ideas, view),
    };
  }

  return {
    id: uid(),
    name,
    template: "free",
    ideas: [],
    arrows: [],
    camera: { x: 0, y: 0, zoom: 1 },
  };
}

const WELCOME: Board = {
  id: "board-welcome",
  name: "Untitled",
  template: "free",
  ideas: [],
  arrows: [],
  camera: { x: 0, y: 0, zoom: 1 },
};

export const INITIAL_BOARDS: Board[] = [WELCOME];
export const INITIAL_ACTIVE = WELCOME.id;
