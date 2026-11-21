import { useEffect, useMemo, useState } from "react";
import { Download, FolderOpen, Save, SlidersHorizontal, Trash2, X } from "lucide-react";
import { buildSvg, fileSafe, makeMeasure, svgToJpeg } from "@/lib/brainstorm/export";
import { useSaved, type SavedWork } from "@/lib/brainstorm/saved";
import { readView, useStudio } from "@/lib/brainstorm/store";
import { saveFile } from "@/lib/files";
import { BACKGROUNDS } from "@/lib/brainstorm/types";
import type { Board } from "@/lib/brainstorm/types";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={cx(
            "h-11 rounded-xl text-sm font-medium",
            value === option.id ? "bg-copper text-copper-ink" : "bg-elevated text-ink",
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-muted first:mt-0">{children}</p>;
}

function previewUrl(board: Board): string {
  const { svg } = buildSvg(board, makeMeasure());
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function exportBoard(board: Board, kind: "svg" | "jpg") {
  const out = buildSvg(board, makeMeasure());
  const base = fileSafe(board.name);
  if (kind === "svg") {
    await saveFile(`${base}.svg`, new Blob([out.svg], { type: "image/svg+xml" }));
  } else {
    await saveFile(`${base}.jpg`, await svgToJpeg(out.svg, out.width, out.height, out.background));
  }
}

export function SettingsPanel() {
  const board = useStudio((s) => s.active());
  const selection = useStudio((s) => s.selection);
  const works = useSaved((s) => s.works);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"board" | "saved">("board");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (selection) setOpen(false);
  }, [selection]);
  useEffect(() => {
    if (!open) setConfirmClear(false);
  }, [open]);

  const empty = board.ideas.length === 0;

  async function run(id: string, board: Board, kind: "svg" | "jpg") {
    setBusy(id);
    setNote("");
    try {
      await exportBoard(board, kind);
    } catch {
      setNote("Could not export. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={open}
        aria-label="Board settings, export and saved works"
        title="Board settings"
        className="panel absolute right-[3.75rem] top-16 z-30 flex size-11 items-center justify-center text-ink"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Board settings"
          className="panel absolute inset-x-3 top-[7.25rem] z-40 max-h-[calc(100dvh-12rem)] overflow-auto p-3 md:inset-x-auto md:left-[4.75rem] md:w-80"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-1" role="tablist">
              {(["board", "saved"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={cx(
                    "h-10 rounded-xl text-sm font-medium",
                    tab === id ? "bg-copper text-copper-ink" : "bg-elevated text-ink",
                  )}
                  onClick={() => setTab(id)}
                >
                  {id === "board" ? "Board" : `Saved (${works.length})`}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Close settings"
              className="grid size-10 place-items-center rounded-xl bg-elevated text-ink"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {tab === "board" ? (
            <div>
              <Heading>Layout</Heading>
              <Segmented
                label="Layout mode"
                value={board.mode}
                options={[
                  { id: "free", label: "Free" },
                  { id: "logic", label: "Logic" },
                ]}
                onChange={(mode) => useStudio.getState().setMode(mode, readView())}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {board.mode === "logic"
                  ? "Boxes and circles snap to one tidy grid, all the same size."
                  : "Place boxes and circles anywhere, any size."}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={board.grid}
                className="mt-2 flex h-11 w-full items-center justify-between rounded-xl bg-elevated px-3 text-sm font-medium text-ink"
                onClick={() => useStudio.getState().setGuides(!board.grid)}
              >
                Guide lines
                <span
                  className={cx(
                    "rounded-full px-2.5 py-0.5 text-xs",
                    board.grid ? "bg-copper text-copper-ink" : "bg-surface text-muted",
                  )}
                >
                  {board.grid ? "On" : "Off"}
                </span>
              </button>

              <Heading>Arrows</Heading>
              <Segmented
                label="Arrow style"
                value={board.arrowStyle}
                options={[
                  { id: "2d", label: "2D" },
                  { id: "3d", label: "3D" },
                ]}
                onChange={(style) => useStudio.getState().setArrowStyle(style)}
              />

              <Heading>Background</Heading>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Background color">
                {BACKGROUNDS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={board.background === item.color}
                    title={item.label}
                    className={cx(
                      "h-10 rounded-xl ring-2 ring-offset-2 ring-offset-surface",
                      board.background === item.color ? "ring-copper" : "ring-transparent",
                    )}
                    style={{ background: item.color || "#12110f", border: "1px solid var(--color-line)" }}
                    onClick={() => useStudio.getState().setBackground(item.color)}
                  />
                ))}
              </div>
              <label className="mt-2 flex h-11 cursor-pointer items-center justify-between rounded-xl bg-elevated px-3 text-sm font-medium text-ink">
                Custom color
                <input
                  type="color"
                  aria-label="Custom background color"
                  className="h-7 w-10 cursor-pointer rounded bg-transparent"
                  value={board.background || "#12110f"}
                  onChange={(event) => useStudio.getState().setBackground(event.target.value)}
                />
              </label>

              <Heading>Download</Heading>
              <div className="grid grid-cols-2 gap-2">
                {(["svg", "jpg"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={empty || busy !== null}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-elevated text-sm font-medium text-ink disabled:opacity-40"
                    onClick={() => void run(kind, board, kind)}
                  >
                    <Download className="size-4" aria-hidden />
                    {busy === kind ? "Working…" : kind === "svg" ? "SVG (vector)" : "JPG (HD)"}
                  </button>
                ))}
              </div>

              <Heading>Keep</Heading>
              <button
                type="button"
                disabled={empty}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-copper text-sm font-medium text-copper-ink disabled:opacity-40"
                onClick={() => {
                  useSaved.getState().save(board);
                  setNote("Saved to your works.");
                }}
              >
                <Save className="size-4" aria-hidden />
                Save this work
              </button>
              {note && (
                <p className="mt-2 text-xs text-muted" role="status">
                  {note}
                </p>
              )}
            </div>
          ) : (
            <SavedList
              works={works}
              busy={busy}
              confirmClear={confirmClear}
              setConfirmClear={setConfirmClear}
              onExport={(work, kind) => void run(`${work.id}-${kind}`, work.board, kind)}
              onOpen={(work) => {
                useStudio.getState().importBoard(work.board);
                setOpen(false);
              }}
            />
          )}
        </section>
      )}
    </>
  );
}

function SavedList({
  works,
  busy,
  confirmClear,
  setConfirmClear,
  onExport,
  onOpen,
}: {
  works: SavedWork[];
  busy: string | null;
  confirmClear: boolean;
  setConfirmClear: (v: boolean) => void;
  onExport: (work: SavedWork, kind: "svg" | "jpg") => void;
  onOpen: (work: SavedWork) => void;
}) {
  if (!works.length) {
    return <p className="py-6 text-center text-sm text-muted">No saved works yet. Use “Save this work” on the Board tab.</p>;
  }
  return (
    <div>
      <ul className="grid gap-3">
        {works.map((work) => (
          <WorkItem key={work.id} work={work} busy={busy} onExport={onExport} onOpen={onOpen} />
        ))}
      </ul>
      <button
        type="button"
        className={cx(
          "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium",
          confirmClear ? "bg-copper text-copper-ink" : "bg-elevated text-ink",
        )}
        onClick={() => {
          if (confirmClear) {
            useSaved.getState().clear();
            setConfirmClear(false);
          } else {
            setConfirmClear(true);
          }
        }}
      >
        <Trash2 className="size-4" aria-hidden />
        {confirmClear ? "Tap again to clear all history" : "Clear history"}
      </button>
    </div>
  );
}

function WorkItem({
  work,
  busy,
  onExport,
  onOpen,
}: {
  work: SavedWork;
  busy: string | null;
  onExport: (work: SavedWork, kind: "svg" | "jpg") => void;
  onOpen: (work: SavedWork) => void;
}) {
  const url = useMemo(() => {
    try {
      return previewUrl(work.board);
    } catch {
      return "";
    }
  }, [work.board]);
  return (
    <li className="rounded-xl bg-elevated p-2">
      {url && <img src={url} alt="" className="h-24 w-full rounded-lg bg-surface object-contain" />}
      <div className="mt-2 flex items-baseline justify-between gap-2 px-1">
        <p className="truncate text-sm font-medium text-ink">{work.name}</p>
        <p className="shrink-0 text-xs text-muted">{new Date(work.savedAt).toLocaleDateString()}</p>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        <button
          type="button"
          aria-label={`Open ${work.name}`}
          className="grid h-10 place-items-center rounded-lg bg-surface text-ink"
          onClick={() => onOpen(work)}
        >
          <FolderOpen className="size-4" aria-hidden />
        </button>
        {(["svg", "jpg"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={busy !== null}
            aria-label={`Download ${work.name} as ${kind.toUpperCase()}`}
            className="h-10 rounded-lg bg-surface text-xs font-medium uppercase text-ink disabled:opacity-40"
            onClick={() => onExport(work, kind)}
          >
            {busy === `${work.id}-${kind}` ? "…" : kind}
          </button>
        ))}
        <button
          type="button"
          aria-label={`Delete ${work.name}`}
          className="grid h-10 place-items-center rounded-lg bg-surface text-ink"
          onClick={() => useSaved.getState().remove(work.id)}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
