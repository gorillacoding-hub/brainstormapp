import { useEffect, useState } from "react";
import { Hint, Inspector, Toolbar, TopBar, Welcome, ZoomHud } from "@/components/brainstorm/chrome";
import { BoardStage } from "@/components/brainstorm/stage";
import { spawnAround } from "@/lib/brainstorm/geometry";
import { persistStudio, readView, useStudio } from "@/lib/brainstorm/store";

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function Studio() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const selection = useStudio((s) => s.selection);

  useEffect(() => {
    useStudio.getState().hydrate();
    return useStudio.subscribe((state, prev) => {
      if (state.boards !== prev.boards || state.activeId !== prev.activeId) persistStudio(state);
    });
  }, []);

  useEffect(() => {
    if (!editingId) return;
    if (selection?.kind !== "idea" || selection.id !== editingId) {
      useStudio.getState().endGesture();
      setEditingId(null);
    }
  }, [selection, editingId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const state = useStudio.getState();
      const typing = isTyping(event.target);
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if (typing) {
        if (event.key === "Escape") (event.target as HTMLElement).blur();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        if (!event.repeat) state.holdPan(true);
        return;
      }
      if (event.key === "Escape") {
        state.select(null);
        state.setLinkDraft(null);
        setEditingId(null);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        state.deleteSelection();
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "v") state.setTool("select");
      else if (key === "l") state.setTool("link");
      else if (key === "h") state.setTool("pan");
      else if (key === "f") state.fit(readView());
      else if (key === "n" || key === "a") {
        const board = state.active();
        const at = spawnAround(board.camera, board.ideas.length);
        const id = state.addIdea(at.x, at.y);
        setEditingId(id);
      } else if (key === "1") state.setTemplate("free", readView());
      else if (key === "2") state.setTemplate("boxes", readView());
      else if (key === "3") state.setTemplate("circles", readView());
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === " ") useStudio.getState().holdPan(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <main className="relative h-dvh overflow-hidden bg-canvas text-ink">
      <h1 className="sr-only">Filament</h1>
      <BoardStage editingId={editingId} setEditingId={setEditingId} onDragging={setDragging} />
      <TopBar />
      <Toolbar />
      <ZoomHud />
      <Hint />
      <Inspector editingId={editingId} setEditingId={setEditingId} dragging={dragging} />
      <Welcome setEditingId={setEditingId} />
    </main>
  );
}
