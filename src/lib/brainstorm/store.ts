import { create } from "zustand";
import {
  defaultSize,
  fitCamera,
  MIN_ZOOM,
  MAX_ZOOM,
  snap,
  uid,
} from "@/lib/brainstorm/geometry";
import { boardFromTemplate, INITIAL_ACTIVE, INITIAL_BOARDS } from "@/lib/brainstorm/templates";
import type {
  Arrow,
  Board,
  Camera,
  Idea,
  Port,
  Selection,
  Shape,
  Template,
  Tone,
  Tool,
} from "@/lib/brainstorm/types";

const STORAGE_KEY = "filament.boards.v1";
const MAX_HIST = 50;

type Snap = { ideas: Idea[]; arrows: Arrow[] };
type Hist = { past: Snap[]; future: Snap[] };

type Persisted = { activeId: string; boards: Board[] };

export type StudioState = {
  boards: Board[];
  activeId: string;
  tool: Tool;
  toolBeforeSpace: Tool | null;
  selection: Selection;
  linkDraft: { fromId: string; fromPort: Port } | null;
  freeShape: Shape;
  gesture: boolean;
  history: Record<string, Hist>;
  hydrate: () => void;
  active: () => Board;
  setTool: (tool: Tool) => void;
  holdPan: (down: boolean) => void;
  select: (selection: Selection) => void;
  setLinkDraft: (draft: { fromId: string; fromPort: Port } | null) => void;
  setFreeShape: (shape: Shape) => void;
  setCamera: (camera: Camera) => void;
  nudgeCamera: (dx: number, dy: number) => void;
  zoomAt: (clientX: number, clientY: number, nextZoom: number, rect: DOMRect) => void;
  fit: (view: { w: number; h: number }) => void;
  beginGesture: () => void;
  endGesture: () => void;
  addIdea: (x: number, y: number, shape?: Shape, text?: string) => string;
  moveIdea: (id: string, x: number, y: number) => void;
  updateIdea: (id: string, patch: Partial<Pick<Idea, "text" | "tone" | "shape">>) => void;
  addArrow: (fromId: string, fromPort: Port, toId: string, toPort: Port) => void;
  updateArrow: (id: string, patch: Partial<Pick<Arrow, "label">>) => void;
  deleteSelection: () => void;
  setTemplate: (template: Template, view: { w: number; h: number }) => void;
  newBoard: (template: Template, view: { w: number; h: number }) => void;
  renameBoard: (name: string) => void;
  duplicateBoard: () => void;
  deleteBoard: () => void;
  undo: () => void;
  redo: () => void;
};

function snapshot(board: Board): Snap {
  return {
    ideas: board.ideas.map((idea) => ({ ...idea })),
    arrows: board.arrows.map((arrow) => ({ ...arrow })),
  };
}

function pushHist(past: Snap[], snap: Snap): Snap[] {
  const next = [...past, snap];
  if (next.length > MAX_HIST) next.shift();
  return next;
}

function currentBoard(state: Pick<StudioState, "boards" | "activeId">): Board {
  return state.boards.find((board) => board.id === state.activeId) ?? state.boards[0];
}

function isPort(value: unknown): value is Port {
  return value === "n" || value === "e" || value === "s" || value === "w";
}

function isShape(value: unknown): value is Shape {
  return value === "box" || value === "circle";
}

function isTone(value: unknown): value is Tone {
  return value === "paper" || value === "sand" || value === "ink" || value === "copper";
}

function isTemplate(value: unknown): value is Template {
  return value === "free" || value === "boxes" || value === "circles";
}

function sanitize(data: unknown): Persisted | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as { activeId?: unknown; boards?: unknown };
  if (!Array.isArray(raw.boards)) return null;
  const boards: Board[] = [];
  for (const item of raw.boards) {
    if (!item || typeof item !== "object") continue;
    const b = item as Partial<Board>;
    if (typeof b.id !== "string" || typeof b.name !== "string") continue;
    const ideas: Idea[] = [];
    if (Array.isArray(b.ideas)) {
      for (const node of b.ideas) {
        if (!node || typeof node !== "object") continue;
        const n = node as Partial<Idea>;
        if (typeof n.id !== "string" || !isShape(n.shape) || !isTone(n.tone)) continue;
        if (typeof n.x !== "number" || typeof n.y !== "number") continue;
        ideas.push({
          id: n.id,
          x: n.x,
          y: n.y,
          w: typeof n.w === "number" ? n.w : defaultSize(n.shape).w,
          h: typeof n.h === "number" ? n.h : defaultSize(n.shape).h,
          text: typeof n.text === "string" ? n.text.slice(0, 400) : "",
          shape: n.shape,
          tone: n.tone,
        });
      }
    }
    const ids = new Set(ideas.map((idea) => idea.id));
    const arrows: Arrow[] = [];
    if (Array.isArray(b.arrows)) {
      for (const link of b.arrows) {
        if (!link || typeof link !== "object") continue;
        const a = link as Partial<Arrow>;
        if (typeof a.id !== "string" || typeof a.fromId !== "string" || typeof a.toId !== "string") continue;
        if (!ids.has(a.fromId) || !ids.has(a.toId) || !isPort(a.fromPort) || !isPort(a.toPort)) continue;
        arrows.push({
          id: a.id,
          fromId: a.fromId,
          toId: a.toId,
          fromPort: a.fromPort,
          toPort: a.toPort,
          label: typeof a.label === "string" ? a.label.slice(0, 48) : "",
        });
      }
    }
    const cam = b.camera;
    boards.push({
      id: b.id,
      name: b.name.slice(0, 60) || "Untitled",
      template: isTemplate(b.template) ? b.template : "free",
      ideas,
      arrows,
      camera: {
        x: cam && typeof cam.x === "number" ? cam.x : 0,
        y: cam && typeof cam.y === "number" ? cam.y : 0,
        zoom: cam && typeof cam.zoom === "number" ? cam.zoom : 1,
      },
    });
  }
  if (!boards.length) return null;
  const activeId = typeof raw.activeId === "string" && boards.some((b) => b.id === raw.activeId)
    ? raw.activeId
    : boards[0].id;
  return { activeId, boards };
}

function viewSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 1280, h: 800 };
  return { w: window.innerWidth, h: window.innerHeight };
}

function nextName(template: Template, boards: Board[]): string {
  const base = template === "free" ? "Free board" : template === "boxes" ? "Box map" : "Circle map";
  const names = new Set(boards.map((board) => board.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function shapeFor(template: Template, freeShape: Shape): Shape {
  if (template === "circles") return "circle";
  if (template === "boxes") return "box";
  return freeShape;
}

function convertIdea(idea: Idea, template: Template): Idea {
  if (template === "circles") {
    const d = Math.max(idea.w, idea.h, 120);
    return { ...idea, shape: "circle", w: d, h: d };
  }
  if (template === "boxes") {
    return {
      ...idea,
      shape: "box",
      w: Math.max(idea.shape === "circle" ? idea.w + 48 : idea.w, 180),
      h: idea.shape === "circle" ? 108 : Math.max(idea.h, 96),
    };
  }
  return idea;
}

export const useStudio = create<StudioState>((set, get) => {
  function mutate(record: boolean, fn: (board: Board) => Board) {
    const state = get();
    const board = currentBoard(state);
    let history = state.history;
    if (record && !state.gesture) {
      const prev = history[board.id] ?? { past: [], future: [] };
      history = {
        ...history,
        [board.id]: { past: pushHist(prev.past, snapshot(board)), future: [] },
      };
    }
    set({
      history,
      boards: state.boards.map((item) => (item.id === board.id ? fn(item) : item)),
    });
  }

  return {
    boards: INITIAL_BOARDS,
    activeId: INITIAL_ACTIVE,
    tool: "select",
    toolBeforeSpace: null,
    selection: null,
    linkDraft: null,
    freeShape: "box",
    gesture: false,
    history: {},

    hydrate: () => {
      try {
        const parsed = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? ""));
        if (!parsed) return;
        set({
          boards: parsed.boards,
          activeId: parsed.activeId,
          selection: null,
          linkDraft: null,
          history: {},
          gesture: false,
        });
      } catch {
        /* keep the welcome board */
      }
    },

    active: () => currentBoard(get()),

    setTool: (tool) => set({ tool, linkDraft: tool === "link" ? get().linkDraft : null }),

    holdPan: (down) => {
      if (down) {
        if (get().toolBeforeSpace) return;
        set({ toolBeforeSpace: get().tool, tool: "pan" });
        return;
      }
      const prev = get().toolBeforeSpace;
      if (!prev) return;
      set({ tool: prev, toolBeforeSpace: null });
    },

    select: (selection) => set({ selection }),

    setLinkDraft: (linkDraft) => set({ linkDraft }),

    setFreeShape: (freeShape) => set({ freeShape }),

    setCamera: (camera) => {
      const state = get();
      set({
        boards: state.boards.map((board) =>
          board.id === state.activeId ? { ...board, camera } : board,
        ),
      });
    },

    nudgeCamera: (dx, dy) => {
      const board = currentBoard(get());
      get().setCamera({ ...board.camera, x: board.camera.x + dx, y: board.camera.y + dy });
    },

    zoomAt: (clientX, clientY, nextZoom, rect) => {
      const board = currentBoard(get());
      const cam = board.camera;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const sx = clientX - rect.left - rect.width / 2;
      const sy = clientY - rect.top - rect.height / 2;
      const worldX = cam.x + sx / cam.zoom;
      const worldY = cam.y + sy / cam.zoom;
      get().setCamera({
        zoom,
        x: worldX - sx / zoom,
        y: worldY - sy / zoom,
      });
    },

    fit: (view) => {
      const board = currentBoard(get());
      get().setCamera(fitCamera(board.ideas, view));
    },

    beginGesture: () => {
      const state = get();
      if (state.gesture) return;
      const board = currentBoard(state);
      const prev = state.history[board.id] ?? { past: [], future: [] };
      set({
        gesture: true,
        history: {
          ...state.history,
          [board.id]: { past: pushHist(prev.past, snapshot(board)), future: [] },
        },
      });
    },

    endGesture: () => set({ gesture: false }),

    addIdea: (x, y, shape, text = "") => {
      const state = get();
      const board = currentBoard(state);
      const nextShape = shape ?? shapeFor(board.template, state.freeShape);
      const size = defaultSize(nextShape);
      const id = uid();
      const tone: Tone = board.ideas.length % 5 === 4 ? "copper" : board.ideas.length % 2 ? "sand" : "paper";
      mutate(true, (current) => ({
        ...current,
        ideas: [
          ...current.ideas,
          {
            id,
            x: snap(x),
            y: snap(y),
            w: size.w,
            h: size.h,
            text: text.slice(0, 400),
            shape: nextShape,
            tone,
          },
        ],
      }));
      set({ selection: { kind: "idea", id }, tool: "select" });
      return id;
    },

    moveIdea: (id, x, y) => {
      mutate(false, (board) => ({
        ...board,
        ideas: board.ideas.map((idea) =>
          idea.id === id ? { ...idea, x: snap(x), y: snap(y) } : idea,
        ),
      }));
    },

    updateIdea: (id, patch) => {
      mutate(!get().gesture, (board) => ({
        ...board,
        ideas: board.ideas.map((idea) => {
          if (idea.id !== id) return idea;
          const next = { ...idea, ...patch };
          if (patch.text != null) next.text = patch.text.slice(0, 400);
          if (patch.shape === "circle") {
            const d = Math.max(idea.w, idea.h);
            next.w = d;
            next.h = d;
          }
          if (patch.shape === "box" && idea.shape === "circle") {
            next.w = Math.max(idea.w + 48, 180);
            next.h = 108;
          }
          return next;
        }),
      }));
    },

    addArrow: (fromId, fromPort, toId, toPort) => {
      if (fromId === toId) {
        set({ linkDraft: null });
        return;
      }
      const board = currentBoard(get());
      const existing = board.arrows.find(
        (arrow) =>
          arrow.fromId === fromId &&
          arrow.toId === toId &&
          arrow.fromPort === fromPort &&
          arrow.toPort === toPort,
      );
      if (existing) {
        set({ selection: { kind: "arrow", id: existing.id }, linkDraft: null, tool: "select" });
        return;
      }
      const id = uid();
      mutate(true, (current) => ({
        ...current,
        arrows: [...current.arrows, { id, fromId, toId, fromPort, toPort, label: "" }],
      }));
      set({ selection: { kind: "arrow", id }, linkDraft: null, tool: "select" });
    },

    updateArrow: (id, patch) => {
      mutate(!get().gesture, (board) => ({
        ...board,
        arrows: board.arrows.map((arrow) =>
          arrow.id === id
            ? { ...arrow, ...patch, label: (patch.label ?? arrow.label).slice(0, 48) }
            : arrow,
        ),
      }));
    },

    deleteSelection: () => {
      const state = get();
      const selection = state.selection;
      if (!selection) return;
      if (selection.kind === "idea") {
        mutate(true, (board) => ({
          ...board,
          ideas: board.ideas.filter((idea) => idea.id !== selection.id),
          arrows: board.arrows.filter(
            (arrow) => arrow.fromId !== selection.id && arrow.toId !== selection.id,
          ),
        }));
      } else {
        mutate(true, (board) => ({
          ...board,
          arrows: board.arrows.filter((arrow) => arrow.id !== selection.id),
        }));
      }
      set({ selection: null, linkDraft: null });
    },

    setTemplate: (template, view) => {
      const state = get();
      const board = currentBoard(state);
      if (board.ideas.length === 0 && template !== "free") {
        const seeded = boardFromTemplate(template, board.name === "Untitled" ? nextName(template, state.boards.filter((item) => item.id !== board.id)) : board.name, view);
        mutate(true, (current) => ({
          ...current,
          template,
          name: seeded.name,
          ideas: seeded.ideas,
          arrows: seeded.arrows,
          camera: seeded.camera,
        }));
        set({ selection: null, linkDraft: null, freeShape: template === "circles" ? "circle" : "box" });
        return;
      }
      mutate(true, (current) => ({
        ...current,
        template,
        ideas: current.ideas.map((idea) => convertIdea(idea, template)),
      }));
      set({
        freeShape: template === "circles" ? "circle" : template === "boxes" ? "box" : state.freeShape,
        linkDraft: null,
      });
    },

    newBoard: (template, view) => {
      const state = get();
      const name = nextName(template, state.boards);
      const board = template === "free" ? { ...boardFromTemplate("free", name, view), id: uid() } : boardFromTemplate(template, name, view);
      set({
        boards: [...state.boards, board],
        activeId: board.id,
        selection: null,
        linkDraft: null,
        tool: "select",
        freeShape: template === "circles" ? "circle" : "box",
      });
    },

    renameBoard: (name) => {
      const trimmed = name.slice(0, 60);
      const state = get();
      set({
        boards: state.boards.map((board) =>
          board.id === state.activeId ? { ...board, name: trimmed || board.name } : board,
        ),
      });
    },

    duplicateBoard: () => {
      const state = get();
      const board = currentBoard(state);
      const names = new Set(state.boards.map((item) => item.name));
      let name = `${board.name} copy`;
      let n = 2;
      while (names.has(name)) {
        name = `${board.name} copy ${n}`;
        n += 1;
      }
      const copy: Board = {
        ...structuredClone(board),
        id: uid(),
        name: name.slice(0, 60),
      };
      set({
        boards: [...state.boards, copy],
        activeId: copy.id,
        selection: null,
        linkDraft: null,
      });
    },

    deleteBoard: () => {
      const state = get();
      if (state.boards.length <= 1) {
        mutate(true, (board) => ({
          ...board,
          ideas: [],
          arrows: [],
          template: "free",
          camera: { x: 0, y: 0, zoom: 1 },
        }));
        set({ selection: null, linkDraft: null });
        return;
      }
      const boards = state.boards.filter((board) => board.id !== state.activeId);
      set({
        boards,
        activeId: boards[0].id,
        selection: null,
        linkDraft: null,
      });
    },

    undo: () => {
      const state = get();
      const board = currentBoard(state);
      const hist = state.history[board.id];
      if (!hist || hist.past.length === 0) return;
      const snap = hist.past[hist.past.length - 1];
      set({
        gesture: false,
        selection: null,
        linkDraft: null,
        history: {
          ...state.history,
          [board.id]: {
            past: hist.past.slice(0, -1),
            future: [...hist.future, snapshot(board)],
          },
        },
        boards: state.boards.map((item) =>
          item.id === board.id ? { ...item, ideas: snap.ideas, arrows: snap.arrows } : item,
        ),
      });
    },

    redo: () => {
      const state = get();
      const board = currentBoard(state);
      const hist = state.history[board.id];
      if (!hist || hist.future.length === 0) return;
      const snap = hist.future[hist.future.length - 1];
      set({
        gesture: false,
        selection: null,
        linkDraft: null,
        history: {
          ...state.history,
          [board.id]: {
            past: [...hist.past, snapshot(board)],
            future: hist.future.slice(0, -1),
          },
        },
        boards: state.boards.map((item) =>
          item.id === board.id ? { ...item, ideas: snap.ideas, arrows: snap.arrows } : item,
        ),
      });
    },
  };
});

export function persistStudio(state: Pick<StudioState, "boards" | "activeId">) {
  try {
    const payload: Persisted = { activeId: state.activeId, boards: state.boards };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage full or blocked — the session still works */
  }
}

export function readView(): { w: number; h: number } {
  return viewSize();
}
