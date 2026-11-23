import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  clamp,
  clientToWorld,
  curve,
  facingPorts,
  MAX_ZOOM,
  MIN_ZOOM,
  nearestPort,
  portPoint,
  PORTS,
  projectCurve,
  worldToScreen,
  type Point,
} from "@/lib/brainstorm/geometry";
import { useStudio } from "@/lib/brainstorm/store";
import {
  backgroundOf,
  headShapes,
  layoutArrows,
  markerId,
  markerSize,
  tubeLayers,
} from "@/lib/brainstorm/arrows";
import { isLight, mixTwo } from "@/lib/brainstorm/color";
import { GUIDE_SLOT, LOGIC_CELL } from "@/lib/brainstorm/layout";
import { fitFont } from "@/lib/brainstorm/fit";
import { COPPER, MAX_TEXT, toneOf } from "@/lib/brainstorm/types";
import type { ArrowStyle, Camera, Idea, Port } from "@/lib/brainstorm/types";

type Session =
  | { kind: "pan"; x: number; y: number; moved: boolean }
  | { kind: "move"; id: string; ox: number; oy: number; px: number; py: number; moved: boolean }
  | { kind: "link"; fromId: string; fromPort: Port; moved: boolean }
  | { kind: "pinch" };

type Hit = { id: string; port: Port | null };

function isPort(value: string | null): value is Port {
  return value === "n" || value === "e" || value === "s" || value === "w";
}

function hitTarget(clientX: number, clientY: number): Hit | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    const portEl = el.closest("[data-port]");
    const id = portEl?.getAttribute("data-idea");
    const port = portEl?.getAttribute("data-port") ?? null;
    if (id && isPort(port)) return { id, port };
  }
  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    const ideaEl = el.closest("[data-idea]");
    const id = ideaEl?.getAttribute("data-idea");
    if (id) return { id, port: null };
  }
  return null;
}

export function BoardStage({
  editingId,
  setEditingId,
  onDragging,
}: {
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const session = useRef<Session | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const onDraggingRef = useRef(onDragging);
  onDraggingRef.current = onDragging;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snap, setSnap] = useState<{ id: string; port: Port } | null>(null);
  const [panning, setPanning] = useState(false);
  const [fontRev, setFontRev] = useState(0);

  // Web fonts load after first paint: measure again once they are in so boxes fit the real glyphs.
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts?.ready) return;
    let alive = true;
    fonts.ready.then(() => {
      if (!alive) return;
      useStudio.getState().refitAll();
      setFontRev((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  const board = useStudio((s) => s.boards.find((item) => item.id === s.activeId) ?? s.boards[0]);
  const tool = useStudio((s) => s.tool);
  const selection = useStudio((s) => s.selection);
  const linkDraft = useStudio((s) => s.linkDraft);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cam = useStudio.getState().active().camera;
      if (event.ctrlKey || event.metaKey) {
        const factor = event.deltaY < 0 ? 1.08 : 0.92;
        useStudio.getState().zoomAt(event.clientX, event.clientY, cam.zoom * factor, rect);
      } else {
        useStudio.getState().nudgeCamera(event.deltaX / cam.zoom, event.deltaY / cam.zoom);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    function worldAt(clientX: number, clientY: number) {
      const rect = viewportRef.current?.getBoundingClientRect() ?? new DOMRect();
      return clientToWorld(clientX, clientY, rect, useStudio.getState().active().camera);
    }

    function applyPinch() {
      const pts = [...pointers.current.values()];
      const baseline = pinch.current;
      const el = viewportRef.current;
      if (pts.length < 2 || !baseline || !el || baseline.dist < 1) return;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = el.getBoundingClientRect();
      useStudio.getState().zoomAt(
        (pts[0].x + pts[1].x) / 2,
        (pts[0].y + pts[1].y) / 2,
        clamp(baseline.zoom * (dist / baseline.dist), MIN_ZOOM, MAX_ZOOM),
        rect,
      );
    }

    function finishLink(fromId: string, fromPort: Port, clientX: number, clientY: number) {
      const state = useStudio.getState();
      const hit = hitTarget(clientX, clientY);
      if (!hit || hit.id === fromId) {
        state.setLinkDraft(null);
        return;
      }
      const ideas = state.active().ideas;
      const from = ideas.find((idea) => idea.id === fromId);
      const to = ideas.find((idea) => idea.id === hit.id);
      const toPort = hit.port ?? (from && to ? facingPorts(from, to).to : "w");
      state.addArrow(fromId, fromPort, hit.id, toPort);
    }

    function onMove(event: PointerEvent) {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size >= 2) {
        applyPinch();
        return;
      }
      const drag = session.current;
      if (!drag || drag.kind === "pinch") return;
      if (drag.kind === "pan") {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        drag.x = event.clientX;
        drag.y = event.clientY;
        const zoom = useStudio.getState().active().camera.zoom;
        useStudio.getState().nudgeCamera(-dx / zoom, -dy / zoom);
        setPanning(true);
        return;
      }
      if (drag.kind === "move") {
        const world = worldAt(event.clientX, event.clientY);
        if (!drag.moved && Math.hypot(world.x - drag.px, world.y - drag.py) < 3) return;
        if (!drag.moved) {
          useStudio.getState().beginGesture();
          onDraggingRef.current(true);
        }
        drag.moved = true;
        useStudio.getState().moveIdea(drag.id, drag.ox + (world.x - drag.px), drag.oy + (world.y - drag.py));
        return;
      }
      const world = worldAt(event.clientX, event.clientY);
      const ideas = useStudio.getState().active().ideas;
      const from = ideas.find((idea) => idea.id === drag.fromId);
      if (from) {
        const start = portPoint(from, drag.fromPort);
        if (!drag.moved && Math.hypot(world.x - start.x, world.y - start.y) > 8) drag.moved = true;
      }
      const hit = hitTarget(event.clientX, event.clientY);
      if (hit && hit.id !== drag.fromId) {
        const to = ideas.find((idea) => idea.id === hit.id);
        const port = hit.port ?? (from && to ? facingPorts(from, to).to : "w");
        setSnap({ id: hit.id, port });
        setCursor(to ? portPoint(to, port) : world);
        return;
      }
      setSnap(null);
      setCursor(world);
    }

    function onUp(event: PointerEvent) {
      if (!pointers.current.has(event.pointerId) && session.current == null) return;
      pointers.current.delete(event.pointerId);
      if (pointers.current.size >= 1) {
        pinch.current = null;
        return;
      }
      pinch.current = null;
      const drag = session.current;
      session.current = null;
      setPanning(false);
      setCursor(null);
      setSnap(null);
      onDraggingRef.current(false);
      if (!drag || drag.kind === "pinch") return;
      const state = useStudio.getState();
      if (drag.kind === "move") {
        if (drag.moved) state.endGesture();
        return;
      }
      if (drag.kind === "pan") {
        if (!drag.moved && state.tool === "idea") {
          const world = worldAt(event.clientX, event.clientY);
          const id = state.addIdea(world.x, world.y);
          setEditingId(id);
          return;
        }
        if (!drag.moved) {
          state.select(null);
          state.setLinkDraft(null);
        }
        return;
      }
      if (drag.moved) finishLink(drag.fromId, drag.fromPort, event.clientX, event.clientY);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setEditingId]);

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("textarea, input")) return;

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      session.current = { kind: "pinch" };
      pinch.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        zoom: useStudio.getState().active().camera.zoom,
      };
      setCursor(null);
      return;
    }

    event.preventDefault();
    const state = useStudio.getState();
    const ideas = state.active().ideas;
    const draft = state.linkDraft;

    const portEl = target.closest("[data-port]");
    const ideaEl = target.closest("[data-idea]");
    const arrowEl = target.closest("[data-arrow]");

    if (draft && (portEl || ideaEl)) {
      const id = (portEl ?? ideaEl)?.getAttribute("data-idea");
      if (id && id !== draft.fromId) {
        const portAttr = portEl?.getAttribute("data-port") ?? null;
        const from = ideas.find((idea) => idea.id === draft.fromId);
        const to = ideas.find((idea) => idea.id === id);
        const toPort = isPort(portAttr) ? portAttr : from && to ? facingPorts(from, to).to : "w";
        state.addArrow(draft.fromId, draft.fromPort, id, toPort);
        session.current = null;
        return;
      }
    }

    if (portEl) {
      const id = portEl.getAttribute("data-idea");
      const portAttr = portEl.getAttribute("data-port");
      const from = ideas.find((idea) => idea.id === id);
      if (!id || !from || !isPort(portAttr)) return;
      state.select({ kind: "idea", id });
      state.setLinkDraft({ fromId: id, fromPort: portAttr });
      session.current = { kind: "link", fromId: id, fromPort: portAttr, moved: false };
      setEditingId(null);
      return;
    }

    if (arrowEl && !ideaEl) {
      const id = arrowEl.getAttribute("data-arrow");
      if (id) state.select({ kind: "arrow", id });
      state.setLinkDraft(null);
      setEditingId(null);
      return;
    }

    if (ideaEl) {
      const id = ideaEl.getAttribute("data-idea");
      const idea = ideas.find((item) => item.id === id);
      if (!id || !idea) return;
      if (state.tool === "pan") {
        session.current = { kind: "pan", x: event.clientX, y: event.clientY, moved: false };
        return;
      }
      if (state.tool === "link") {
        const world = clientToWorld(
          event.clientX,
          event.clientY,
          viewportRef.current?.getBoundingClientRect() ?? new DOMRect(),
          state.active().camera,
        );
        const port = nearestPort(idea, world);
        state.select({ kind: "idea", id });
        state.setLinkDraft({ fromId: id, fromPort: port });
        session.current = { kind: "link", fromId: id, fromPort: port, moved: false };
        setEditingId(null);
        return;
      }
      state.select({ kind: "idea", id });
      state.setLinkDraft(null);
      const world = clientToWorld(
        event.clientX,
        event.clientY,
        viewportRef.current?.getBoundingClientRect() ?? new DOMRect(),
        state.active().camera,
      );
      session.current = {
        kind: "move",
        id,
        ox: idea.x,
        oy: idea.y,
        px: world.x,
        py: world.y,
        moved: false,
      };
      return;
    }

    session.current = { kind: "pan", x: event.clientX, y: event.clientY, moved: false };
  }

  function onDoubleClick(event: React.MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("textarea, input, button, [data-port], [data-arrow]")) return;
    const ideaEl = target.closest("[data-idea]");
    if (ideaEl) {
      const id = ideaEl.getAttribute("data-idea");
      if (!id) return;
      useStudio.getState().select({ kind: "idea", id });
      setEditingId(id);
      return;
    }
    if (useStudio.getState().tool === "idea") return;
    const rect = viewportRef.current?.getBoundingClientRect() ?? new DOMRect();
    const world = clientToWorld(event.clientX, event.clientY, rect, useStudio.getState().active().camera);
    const id = useStudio.getState().addIdea(world.x, world.y);
    setEditingId(id);
  }

  const project = (point: Point) => worldToScreen(point, board.camera, size);
  const grid = 28 * board.camera.zoom;
  const gridX = size.w / 2 - board.camera.x * board.camera.zoom;
  const gridY = size.h / 2 - board.camera.y * board.camera.zoom;

  const draftIdea = linkDraft ? board.ideas.find((idea) => idea.id === linkDraft.fromId) : undefined;

  const background = backgroundOf(board);
  const surfaceStyle: CSSProperties = {
    backgroundSize: `${grid}px ${grid}px`,
    backgroundPosition: `${gridX}px ${gridY}px`,
    ...(board.background
      ? {
          backgroundColor: background,
          ["--color-grid" as string]: mixTwo(background, isLight(background) ? "#000000" : "#ffffff", 0.1),
        }
      : {}),
  } as CSSProperties;
  const arrowStyle = board.arrowStyle;
  const layout = layoutArrows(board);
  const colors = new Set<string>([COPPER]);
  for (const item of layout.items) if (!item.merged) colors.add(item.color);
  for (const merge of layout.merges) colors.add(merge.color);

  return (
    <div
      ref={viewportRef}
      data-stage
      data-tool={tool}
      data-panning={panning ? "true" : "false"}
      className="canvas-surface absolute inset-0"
      style={surfaceStyle}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      role="application"
      aria-label="Brainstorm canvas"
    >
      {board.grid && size.w > 0 && <Guides camera={board.camera} size={size} background={background} />}

      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `scale(${board.camera.zoom}) translate(${-board.camera.x}px, ${-board.camera.y}px)`,
          transformOrigin: "0 0",
        }}
      >
        {board.ideas.map((idea) => (
          <IdeaNode
            key={idea.id}
            idea={idea}
            selected={selection?.kind === "idea" && selection.id === idea.id}
            linking={linkDraft?.fromId === idea.id}
            editing={editingId === idea.id}
            logic={board.mode === "logic"}
            fontRev={fontRev}
            onEdit={(value) => {
              useStudio.getState().beginGesture();
              useStudio.getState().updateIdea(idea.id, { text: value });
            }}
            onEditEnd={() => useStudio.getState().endGesture()}
            onHover={setHoverId}
          />
        ))}
      </div>

      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <filter id="fa-blur" filterUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          {[...colors].map((color) => (
            <marker
              key={color}
              id={markerId(color, arrowStyle)}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth={markerSize(arrowStyle)}
              markerHeight={markerSize(arrowStyle)}
              orient="auto"
            >
              {headShapes(color, arrowStyle).map((shape, i) => (
                <path key={i} d={shape.d} fill={shape.fill} />
              ))}
            </marker>
          ))}
        </defs>
        {size.w > 0 &&
          layout.items.map(({ arrow, curve: c, color, merged }) => {
            const screen = projectCurve(c, project);
            const hot = selection?.kind === "arrow" && selection.id === arrow.id;
            const shown = hot ? COPPER : color;
            return (
              <g key={arrow.id}>
                <path
                  data-arrow={arrow.id}
                  d={screen.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  className="pointer-events-auto"
                  style={{ pointerEvents: "stroke" }}
                />
                <Stroke
                  d={screen.d}
                  color={shown}
                  base={hot ? 2.75 : 1.75}
                  style={arrowStyle}
                  head={merged ? undefined : markerId(shown, arrowStyle)}
                />
              </g>
            );
          })}
        {size.w > 0 &&
          layout.merges.map((merge) => {
            const a = project(merge.from);
            const b = project(merge.to);
            return (
              <g key={merge.key}>
                <Stroke
                  d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                  color={merge.color}
                  base={2.3}
                  style={arrowStyle}
                  head={markerId(merge.color, arrowStyle)}
                />
                <circle cx={a.x} cy={a.y} r={3.6} fill={merge.color} />
              </g>
            );
          })}
        {draftIdea && linkDraft && cursor && size.w > 0 && (
          <path
            d={projectCurve(
              curve(
                portPoint(draftIdea, linkDraft.fromPort),
                linkDraft.fromPort,
                cursor,
                facingPorts(draftIdea, cursor).to,
              ),
              project,
            ).d}
            fill="none"
            stroke="var(--color-copper)"
            strokeWidth="2"
            strokeDasharray="7 6"
            strokeLinecap="round"
            markerEnd={`url(#${markerId(COPPER, arrowStyle)})`}
          />
        )}
      </svg>

      {layout.items.map(({ arrow, curve: c }) => {
        if (!arrow.label || size.w === 0) return null;
        const mid = projectCurve(c, project).mid;
        const hot = selection?.kind === "arrow" && selection.id === arrow.id;
        return (
          <button
            key={arrow.id}
            type="button"
            data-arrow={arrow.id}
            className={`absolute z-30 max-w-40 -translate-x-1/2 -translate-y-1/2 truncate rounded-full px-2.5 py-1 text-xs font-medium ${
              hot ? "bg-copper text-copper-ink" : "bg-surface text-ink ring-1 ring-line"
            }`}
            style={{ left: mid.x, top: mid.y }}
          >
            {arrow.label}
          </button>
        );
      })}

      {board.ideas.map((idea) => {
        const show =
          tool !== "pan" &&
          (tool === "link" ||
            linkDraft != null ||
            hoverId === idea.id ||
            (selection?.kind === "idea" && selection.id === idea.id));
        if (!show || size.w === 0) return null;
        return PORTS.map((port) => {
          const point = project(portPoint(idea, port));
          const hot =
            (linkDraft?.fromId === idea.id && linkDraft.fromPort === port) ||
            (snap?.id === idea.id && snap.port === port);
          return (
            <button
              key={`${idea.id}-${port}`}
              type="button"
              data-port={port}
              data-idea={idea.id}
              aria-label={`Link from ${portLabel(port)} of ${idea.text || "idea"}`}
              className="absolute z-40 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center"
              style={{ left: point.x, top: point.y }}
            >
              <span className="port-dot" data-hot={hot ? "true" : "false"} />
            </button>
          );
        });
      })}
    </div>
  );
}

function portLabel(port: Port): string {
  if (port === "n") return "top";
  if (port === "s") return "bottom";
  if (port === "e") return "right";
  return "left";
}

function IdeaNode({
  idea,
  selected,
  linking,
  editing,
  logic,
  fontRev,
  onEdit,
  onEditEnd,
  onHover,
}: {
  idea: Idea;
  selected: boolean;
  linking: boolean;
  editing: boolean;
  logic: boolean;
  fontRev: number;
  onEdit: (value: string) => void;
  onEditEnd: () => void;
  onHover: (id: string | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const height = idea.shape === "circle" ? idea.w : idea.h;
  const tone = toneOf(idea.tone);
  const circle = idea.shape === "circle";

  // Free mode: the container grows to fit the text, so text is never clipped.
  // Logic mode: the container keeps one size, so the text shrinks to fit instead.
  const fontPx = useMemo(
    () => (logic && !idea.image ? fitFont(idea.text, idea.shape, idea.w, height) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logic, idea.image, idea.text, idea.shape, idea.w, height, fontRev],
  );

  // Keep the textarea exactly as tall as its text so it stays centred in the box / circle.
  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, idea.text, idea.w, fontPx]);

  return (
    <div
      data-idea={idea.id}
      data-shape={idea.shape}
      data-tone={idea.tone}
      data-selected={selected || linking ? "true" : "false"}
      className="idea-node absolute"
      style={{
        left: idea.x,
        top: idea.y,
        width: idea.w,
        height,
        transform: "translate(-50%, -50%)",
        zIndex: selected || linking ? 3 : 1,
        background: tone.fill,
        color: tone.ink,
      }}
      onPointerEnter={() => onHover(idea.id)}
      onPointerLeave={() => onHover(null)}
    >
      {idea.image ? (
        <div className="h-full w-full p-1.5">
          <img
            src={idea.image}
            alt={idea.text || "Imported picture"}
            draggable={false}
            className="pointer-events-none block h-full w-full select-none rounded-[0.5rem] object-contain"
          />
        </div>
      ) : (
        <div
          className={`flex h-full items-center justify-center text-center ${
            circle ? "p-0" : "px-4 py-3"
          }`}
        >
          {editing ? (
            <textarea
              ref={ref}
              value={idea.text}
              maxLength={MAX_TEXT}
              placeholder="Write an idea"
              aria-label="Idea text"
              style={{ ...(circle ? { width: "72%" } : {}), ...(fontPx ? { fontSize: fontPx } : {}) }}
              onChange={(event) => onEdit(event.target.value)}
              onBlur={onEditEnd}
              onPointerDown={(event) => event.stopPropagation()}
            />
          ) : (
            <p
              className={`break-words ${idea.text ? "" : "opacity-45"}`}
              style={{
                width: circle ? "72%" : "100%",
                whiteSpace: "pre-wrap",
                ...(fontPx ? { fontSize: fontPx } : {}),
              }}
            >
              {idea.text || "New idea"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stroke({
  d,
  color,
  base,
  style,
  head,
}: {
  d: string;
  color: string;
  base: number;
  style: ArrowStyle;
  head?: string;
}) {
  if (style === "2d") {
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={base}
        strokeLinecap="round"
        markerEnd={head ? `url(#${head})` : undefined}
      />
    );
  }
  return (
    <g>
      {tubeLayers(color, base).map((layer, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={layer.stroke}
          strokeWidth={layer.width}
          strokeLinecap="round"
          strokeOpacity={layer.opacity}
          transform={layer.dx || layer.dy ? `translate(${layer.dx} ${layer.dy})` : undefined}
          filter={layer.blur ? "url(#fa-blur)" : undefined}
        />
      ))}
      {head && <path d={d} fill="none" stroke="none" markerEnd={`url(#${head})`} />}
    </g>
  );
}

/** Dashed outlines of the grid slots boxes and circles can sit in. */
function Guides({
  camera,
  size,
  background,
}: {
  camera: Camera;
  size: { w: number; h: number };
  background: string;
}) {
  const halfW = size.w / 2 / camera.zoom;
  const halfH = size.h / 2 / camera.zoom;
  const x0 = Math.floor((camera.x - halfW) / LOGIC_CELL.w) - 1;
  const x1 = Math.min(x0 + 60, Math.ceil((camera.x + halfW) / LOGIC_CELL.w) + 1);
  const y0 = Math.floor((camera.y - halfH) / LOGIC_CELL.h) - 1;
  const y1 = Math.min(y0 + 60, Math.ceil((camera.y + halfH) / LOGIC_CELL.h) + 1);
  const stroke = mixTwo(background, isLight(background) ? "#000000" : "#ffffff", 0.24);
  const slots: { key: string; x: number; y: number }[] = [];
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const p = worldToScreen(
        { x: cx * LOGIC_CELL.w - GUIDE_SLOT.w / 2, y: cy * LOGIC_CELL.h - GUIDE_SLOT.h / 2 },
        camera,
        size,
      );
      slots.push({ key: `${cx}:${cy}`, x: p.x, y: p.y });
    }
  }
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {slots.map((slot) => (
        <rect
          key={slot.key}
          x={slot.x}
          y={slot.y}
          width={GUIDE_SLOT.w * camera.zoom}
          height={GUIDE_SLOT.h * camera.zoom}
          rx={16 * camera.zoom}
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
          strokeDasharray="6 7"
        />
      ))}
    </svg>
  );
}
