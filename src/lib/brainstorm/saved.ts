import { create } from "zustand";
import { notify } from "@/lib/notice";
import { uid } from "@/lib/brainstorm/geometry";
import { sanitize } from "@/lib/brainstorm/store";
import type { Board } from "@/lib/brainstorm/types";

const KEY = "filament.saved.v1";
const MAX_WORKS = 30;

export type SavedWork = { id: string; name: string; savedAt: number; board: Board };

type SavedState = {
  works: SavedWork[];
  hydrate: () => void;
  save: (board: Board) => void;
  remove: (id: string) => void;
  clear: () => void;
};

function persist(works: SavedWork[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(works));
  } catch {
    notify("Storage is full - this work is only kept until the app closes.");
  }
}

function load(): SavedWork[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const works: SavedWork[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const w = item as Partial<SavedWork>;
      const clean = sanitize({ boards: [w.board], activeId: "" });
      const board = clean?.boards[0];
      if (!board || typeof w.id !== "string") continue;
      works.push({
        id: w.id,
        name: typeof w.name === "string" ? w.name.slice(0, 60) : board.name,
        savedAt: typeof w.savedAt === "number" ? w.savedAt : Date.now(),
        board,
      });
    }
    return works;
  } catch {
    return [];
  }
}

export const useSaved = create<SavedState>((set, get) => ({
  works: [],
  hydrate: () => set({ works: load() }),
  save: (board) => {
    const work: SavedWork = {
      id: uid(),
      name: board.name,
      savedAt: Date.now(),
      board: JSON.parse(JSON.stringify(board)) as Board,
    };
    const works = [work, ...get().works].slice(0, MAX_WORKS);
    persist(works);
    set({ works });
  },
  remove: (id) => {
    const works = get().works.filter((w) => w.id !== id);
    persist(works);
    set({ works });
  },
  clear: () => {
    persist([]);
    set({ works: [] });
  },
}));
