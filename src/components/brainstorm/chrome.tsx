import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Circle,
  Copy,
  Hand,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Scan,
  Spline,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Template, Tool } from "@/lib/brainstorm/types";
import { TEMPLATES, TONES } from "@/lib/brainstorm/types";
import { readView, useStudio } from "@/lib/brainstorm/store";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function stageRect(): DOMRect | null {
  const el = document.querySelector("[data-stage]");
  return el instanceof HTMLElement ? el.getBoundingClientRect() : null;
}

function viewOfStage() {
  const rect = stageRect();
  if (rect && rect.width > 0) return { w: rect.width, h: rect.height };
  return readView();
}

const TOOLS: { id: Tool; label: string; icon: typeof Plus }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "idea", label: "Add idea", icon: Plus },
  { id: "link", label: "Link points", icon: Spline },
  { id: "pan", label: "Pan", icon: Hand },
];

export function TopBar() {
  const board = useStudio((s) => s.boards.find((item) => item.id === s.activeId) ?? s.boards[0]);
  const boards = useStudio((s) => s.boards);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(board.name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setName(board.name), [board.name, board.id]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto flex min-w-0 items-center gap-2">
        <div className="panel flex h-11 items-center gap-2 px-2.5">
          <Mark />
          <span className="font-display hidden text-lg leading-none text-ink sm:inline">Filament</span>
        </div>
        <div ref={menuRef} className="relative min-w-0">
          <button
            type="button"
            className="panel flex h-11 max-w-44 items-center gap-1.5 px-3 text-sm font-medium text-ink sm:max-w-64"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="truncate">{board.name}</span>
            <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
          </button>
          {open && (
            <div className="panel absolute left-0 top-12 w-72 p-3 sm:w-80" role="dialog" aria-label="Boards">
              <label className="block text-xs font-medium text-muted" htmlFor="board-name">
                Board name
              </label>
              <input
                id="board-name"
                value={name}
                maxLength={60}
                onChange={(event) => {
                  setName(event.target.value);
                  useStudio.getState().renameBoard(event.target.value);
                }}
                className="mt-1 h-11 w-full rounded-xl bg-elevated px-3 text-sm text-ink ring-1 ring-line"
              />
              <p className="mt-3 text-xs font-medium text-muted">Template</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cx(
                      "h-10 rounded-xl text-sm font-medium",
                      board.template === item.id ? "bg-copper text-copper-ink" : "bg-elevated text-ink",
                    )}
                    onClick={() => useStudio.getState().setTemplate(item.id, viewOfStage())}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <ul className="mt-3 max-h-40 space-y-1 overflow-auto">
                {boards.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-ink hover:bg-elevated"
                      onClick={() => {
                        useStudio.setState({ activeId: item.id, selection: null, linkDraft: null });
                        setOpen(false);
                      }}
                    >
                      <Check className={cx("size-4", item.id === board.id ? "text-copper" : "opacity-0")} aria-hidden />
                      <span className="truncate">{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-medium text-muted">New board</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="h-10 rounded-xl bg-elevated text-sm font-medium text-ink"
                    onClick={() => {
                      useStudio.getState().newBoard(item.id, viewOfStage());
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-elevated text-sm font-medium text-ink"
                  onClick={() => {
                    useStudio.getState().duplicateBoard();
                    setOpen(false);
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-elevated text-sm font-medium text-ink"
                  onClick={() => {
                    useStudio.getState().deleteBoard();
                    setOpen(false);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {boards.length > 1 ? "Delete" : "Clear"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <TemplateSwitch className="hidden md:flex" />
        <HistoryButtons />
      </div>
    </header>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden>
      <circle cx="7" cy="16" r="3" fill="var(--color-copper)" />
      <circle cx="21" cy="8" r="2.6" fill="var(--color-paper)" />
      <circle cx="20" cy="21" r="2.2" fill="var(--color-sand)" />
      <path d="M10 15.2C14 14 15 8 18.4 8" fill="none" stroke="var(--color-copper)" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 16.6C13.5 18 15 21 17.8 21" fill="none" stroke="var(--color-muted)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TemplateSwitch({ className }: { className?: string }) {
  const template = useStudio((s) => s.active().template);
  return (
    <div className={cx("panel h-11 items-center gap-1 p-1", className)} role="group" aria-label="Template">
      {TEMPLATES.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={template === item.id}
          className={cx(
            "h-9 rounded-lg px-3 text-sm font-medium",
            template === item.id ? "bg-copper text-copper-ink" : "text-muted",
          )}
          onClick={() => useStudio.getState().setTemplate(item.id, viewOfStage())}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function HistoryButtons() {
  return (
    <div className="panel flex h-11 items-center gap-1 p-1">
      <IconButton label="Undo" onClick={() => useStudio.getState().undo()}>
        <Undo2 className="size-4" />
      </IconButton>
      <IconButton label="Redo" onClick={() => useStudio.getState().redo()}>
        <Redo2 className="size-4" />
      </IconButton>
    </div>
  );
}

export function Toolbar() {
  const tool = useStudio((s) => s.tool);
  const template = useStudio((s) => s.active().template);
  const freeShape = useStudio((s) => s.freeShape);
  return (
    <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 md:left-3 md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:translate-x-0">
      <div className="panel flex items-center gap-1 p-1 md:flex-col" role="toolbar" aria-label="Canvas tools">
        {TOOLS.map((item) => {
          const Icon = item.icon;
          const active = tool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-pressed={active}
              title={item.label}
              className={cx(
                "grid size-11 place-items-center rounded-xl",
                active ? "bg-copper text-copper-ink" : "text-ink hover:bg-elevated",
              )}
              onClick={() => useStudio.getState().setTool(item.id)}
            >
              <Icon className="size-5" />
            </button>
          );
        })}
        {template === "free" && (
          <>
            <span className="mx-1 h-6 w-px bg-line md:mx-0 md:my-1 md:h-px md:w-6" aria-hidden />
            <button
              type="button"
              aria-label="New ideas are boxes"
              aria-pressed={freeShape === "box"}
              title="Box"
              className={cx(
                "grid size-11 place-items-center rounded-xl",
                freeShape === "box" ? "bg-elevated text-ink" : "text-muted",
              )}
              onClick={() => useStudio.getState().setFreeShape("box")}
            >
              <Square className="size-5" />
            </button>
            <button
              type="button"
              aria-label="New ideas are circles"
              aria-pressed={freeShape === "circle"}
              title="Circle"
              className={cx(
                "grid size-11 place-items-center rounded-xl",
                freeShape === "circle" ? "bg-elevated text-ink" : "text-muted",
              )}
              onClick={() => useStudio.getState().setFreeShape("circle")}
            >
              <Circle className="size-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ZoomHud() {
  const zoom = useStudio((s) => s.active().camera.zoom);
  const selection = useStudio((s) => s.selection);
  return (
    <div className={cx("absolute right-3 bottom-20 z-30 md:bottom-3", selection && "max-md:hidden")}>
      <div className="panel flex h-11 items-center gap-1 p-1">
        <IconButton
          label="Zoom out"
          onClick={() => {
            const rect = stageRect();
            if (!rect) return;
            useStudio.getState().zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom / 1.12, rect);
          }}
        >
          <Minus className="size-4" />
        </IconButton>
        <span className="w-12 text-center text-xs font-medium text-muted">{Math.round(zoom * 100)}%</span>
        <IconButton
          label="Zoom in"
          onClick={() => {
            const rect = stageRect();
            if (!rect) return;
            useStudio.getState().zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom * 1.12, rect);
          }}
        >
          <Plus className="size-4" />
        </IconButton>
        <IconButton label="Fit board" onClick={() => useStudio.getState().fit(viewOfStage())}>
          <Scan className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}

export function Hint() {
  const tool = useStudio((s) => s.tool);
  const linkDraft = useStudio((s) => s.linkDraft);
  let text = "";
  if (linkDraft) text = "Choose the point this arrow should reach.";
  else if (tool === "link") text = "Tap a point, then the point it links to. Or drag between points.";
  else if (tool === "idea") text = "Tap the canvas to drop an idea.";
  else if (tool === "pan") text = "Drag to move around. Pinch, or ctrl-scroll, to zoom.";
  if (!text) return null;
  return (
    <p className="pointer-events-none absolute top-16 right-3 left-3 z-20 flex justify-center">
      <span className="max-w-sm rounded-full bg-surface px-3 py-2 text-center text-xs leading-snug text-muted ring-1 ring-line">
        {text}
      </span>
    </p>
  );
}

export function Inspector({
  editingId,
  setEditingId,
  dragging,
}: {
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  dragging: boolean;
}) {
  const board = useStudio((s) => s.active());
  const selection = useStudio((s) => s.selection);
  if (!selection || dragging) return null;

  if (selection.kind === "arrow") {
    const arrow = board.arrows.find((item) => item.id === selection.id);
    if (!arrow) return null;
    return (
      <aside className="panel absolute inset-x-3 bottom-20 z-30 p-3 md:inset-x-auto md:right-3 md:bottom-auto md:top-20 md:w-72">
        <p className="text-xs font-medium text-muted">Arrow</p>
        <label className="mt-2 block text-sm text-ink" htmlFor="arrow-label">
          Label
        </label>
        <input
          id="arrow-label"
          value={arrow.label}
          maxLength={48}
          placeholder="because, then, blocks…"
          className="mt-1 h-11 w-full rounded-xl bg-elevated px-3 text-sm text-ink ring-1 ring-line"
          onChange={(event) => {
            useStudio.getState().beginGesture();
            useStudio.getState().updateArrow(arrow.id, { label: event.target.value });
          }}
          onBlur={() => useStudio.getState().endGesture()}
        />
        <button
          type="button"
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-elevated text-sm font-medium text-ink"
          onClick={() => useStudio.getState().deleteSelection()}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete arrow
        </button>
      </aside>
    );
  }

  const idea = board.ideas.find((item) => item.id === selection.id);
  if (!idea) return null;

  return (
    <aside className="panel absolute inset-x-3 bottom-20 z-30 p-3 md:inset-x-auto md:right-3 md:bottom-auto md:top-20 md:w-80">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted">{idea.shape === "circle" ? "Circle" : "Box"}</p>
        <button
          type="button"
          className="text-xs font-medium text-muted"
          onClick={() => {
            useStudio.getState().select(null);
            setEditingId(null);
          }}
        >
          Close
        </button>
      </div>
      <label className="sr-only" htmlFor="idea-text">
        Idea text
      </label>
      <textarea
        id="idea-text"
        value={idea.text}
        maxLength={400}
        rows={3}
        placeholder="Write an idea"
        className="mt-2 w-full resize-none rounded-xl bg-elevated px-3 py-2.5 text-sm leading-relaxed text-ink ring-1 ring-line"
        onFocus={() => setEditingId(idea.id)}
        onChange={(event) => {
          if (editingId !== idea.id) setEditingId(idea.id);
          useStudio.getState().beginGesture();
          useStudio.getState().updateIdea(idea.id, { text: event.target.value });
        }}
        onBlur={() => useStudio.getState().endGesture()}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex gap-1" role="group" aria-label="Shape">
          <button
            type="button"
            aria-label="Box"
            aria-pressed={idea.shape === "box"}
            className={cx(
              "grid size-11 place-items-center rounded-xl",
              idea.shape === "box" ? "bg-copper text-copper-ink" : "bg-elevated text-ink",
            )}
            onClick={() => useStudio.getState().updateIdea(idea.id, { shape: "box" })}
          >
            <Square className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Circle"
            aria-pressed={idea.shape === "circle"}
            className={cx(
              "grid size-11 place-items-center rounded-xl",
              idea.shape === "circle" ? "bg-copper text-copper-ink" : "bg-elevated text-ink",
            )}
            onClick={() => useStudio.getState().updateIdea(idea.id, { shape: "circle" })}
          >
            <Circle className="size-4" />
          </button>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Color">
          {TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              aria-label={tone.label}
              aria-pressed={idea.tone === tone.id}
              className={cx(
                "size-11 rounded-full ring-2 ring-offset-2 ring-offset-surface",
                tone.id === "paper" && "bg-paper",
                tone.id === "sand" && "bg-sand",
                tone.id === "ink" && "bg-elevated ring-1 ring-line",
                tone.id === "copper" && "bg-copper",
                idea.tone === tone.id ? "ring-copper" : "ring-transparent",
              )}
              onClick={() => useStudio.getState().updateIdea(idea.id, { tone: tone.id })}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-elevated text-sm font-medium text-ink"
        onClick={() => {
          setEditingId(null);
          useStudio.getState().deleteSelection();
        }}
      >
        <Trash2 className="size-4" aria-hidden />
        Delete idea
      </button>
    </aside>
  );
}

export function Welcome({
  setEditingId,
}: {
  setEditingId: (id: string | null) => void;
}) {
  const count = useStudio((s) => s.active().ideas.length);
  const activeId = useStudio((s) => s.activeId);
  const [skipped, setSkipped] = useState<string | null>(null);
  if (count > 0 || skipped === activeId) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 bottom-24 z-20 flex items-center justify-center px-4">
      <div className="pointer-events-auto max-h-full w-full max-w-3xl overflow-auto">
        <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">Start with a shape</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Free is a blank sheet. Boxes and circles arrive with a few prompts and arrows already drawn — rewrite them, then link any point to any other.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="panel flex flex-col gap-3 p-3 text-left transition hover:ring-1 hover:ring-copper"
              onClick={() => {
                if (item.id === "free") {
                  const id = useStudio.getState().addIdea(0, 0, "box");
                  setEditingId(id);
                  setSkipped(activeId);
                  return;
                }
                useStudio.getState().setTemplate(item.id, viewOfStage());
              }}
            >
              <TemplatePreview template={item.id} />
              <span>
                <span className="block font-display text-xl text-ink">{item.label}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{item.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ template }: { template: Template }) {
  if (template === "circles") {
    return (
      <svg viewBox="0 0 160 72" className="h-16 w-full" aria-hidden>
        <circle cx="80" cy="36" r="14" fill="var(--color-copper)" />
        <circle cx="28" cy="22" r="10" fill="var(--color-paper)" />
        <circle cx="132" cy="22" r="10" fill="var(--color-sand)" />
        <circle cx="36" cy="54" r="10" fill="var(--color-sand)" />
        <circle cx="124" cy="54" r="10" fill="var(--color-paper)" />
        <path d="M66 36H40M94 36H120M72 46L46 52M88 46L114 52" stroke="var(--color-muted)" strokeWidth="1.4" fill="none" />
      </svg>
    );
  }
  if (template === "boxes") {
    return (
      <svg viewBox="0 0 160 72" className="h-16 w-full" aria-hidden>
        <rect x="52" y="6" width="56" height="22" rx="6" fill="var(--color-paper)" />
        <rect x="8" y="40" width="44" height="22" rx="6" fill="var(--color-sand)" />
        <rect x="58" y="40" width="44" height="22" rx="6" fill="var(--color-elevated)" stroke="var(--color-line)" />
        <rect x="108" y="40" width="44" height="22" rx="6" fill="var(--color-copper)" />
        <path d="M70 28L30 40M80 28V40M90 28L130 40" stroke="var(--color-muted)" strokeWidth="1.4" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 72" className="h-16 w-full" aria-hidden>
      <rect x="18" y="16" width="46" height="28" rx="7" fill="var(--color-paper)" />
      <circle cx="112" cy="30" r="16" fill="var(--color-sand)" />
      <path d="M64 30H90" stroke="var(--color-copper)" strokeWidth="1.6" fill="none" />
      <path d="M88 26L96 30L88 34" stroke="var(--color-copper)" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} className="grid size-9 place-items-center rounded-lg text-ink hover:bg-elevated" onClick={onClick}>
      {children}
    </button>
  );
}
