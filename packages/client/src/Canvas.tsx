import React, { useRef, useEffect, useState, useCallback } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import type { RoughCanvas } from "roughjs/bin/canvas";
import {
  useBoard,
  type ExcalidrawElement,
} from "./store";
import { getSocket, sendCursor, queueUpdate } from "./sync";
import {
  createBaseElement,
  getBounds,
  isPointInElement,
  rotatePoint,
  distance,
  type Point,
} from "@hyperboard/shared";

const HANDLE_SIZE = 8;

function worldToScreen(p: Point, scrollX: number, scrollY: number, zoom: number) {
  return { x: p.x * zoom + scrollX, y: p.y * zoom + scrollY };
}
function screenToWorld(p: Point, scrollX: number, scrollY: number, zoom: number) {
  return { x: (p.x - scrollX) / zoom, y: (p.y - scrollY) / zoom };
}

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rcRef = useRef<RoughCanvas | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const board = useBoard();
  const elements = board.elements;
  const appState = board.appState;
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const theme = appState.theme ?? "light";

  const stateRef = useRef({
    isPanning: false,
    isDrawing: false,
    isDragging: false,
    isResizing: false,
    resizeHandle: null as string | null,
    dragStart: null as Point | null,
    dragOffset: null as Point | null,
    creatingEl: null as ExcalidrawElement | null,
    selectionBox: null as { x1: number; y1: number; x2: number; y2: number } | null,
    lastPointer: null as Point | null,
  });

  useEffect(() => {
    const onResize = () => {
      if (containerRef.current) {
        setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    rcRef.current = rough.canvas(c);
  }, []);

  const render = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    c.style.width = size.w + "px";
    c.style.height = size.h + "px";
    ctx.scale(dpr, dpr);
    // background
    ctx.fillStyle = theme === "dark" ? "#1e1e1e" : (appState.viewBackgroundColor ?? "#ffffff");
    ctx.fillRect(0, 0, size.w, size.h);

    // grid
    if (appState.showGrid) {
      const g = appState.gridSize ?? 20;
      ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      const startX = ((scrollX % (g * zoom)) + g * zoom) % (g * zoom);
      const startY = ((scrollY % (g * zoom)) + g * zoom) % (g * zoom);
      for (let x = startX; x < size.w; x += g * zoom) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke();
      }
      for (let y = startY; y < size.h; y += g * zoom) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke();
      }
    }

    const rc = rcRef.current;
    if (!rc) return;

    // draw elements
    for (const el of elements) {
      if (el.isDeleted) continue;
      drawElement(ctx, rc, el, scrollX, scrollY, zoom, theme);
    }
    // creating element
    if (stateRef.current.creatingEl) {
      drawElement(ctx, rc, stateRef.current.creatingEl, scrollX, scrollY, zoom, theme);
    }
    // selection box
    if (stateRef.current.selectionBox) {
      const sb = stateRef.current.selectionBox;
      ctx.strokeStyle = "#1971c2";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.min(sb.x1, sb.x2), Math.min(sb.y1, sb.y2), Math.abs(sb.x2 - sb.x1), Math.abs(sb.y2 - sb.y1));
      ctx.setLineDash([]);
    }
    // selection handles
    const sel = Array.from(board.selectedIds);
    for (const id of sel) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;
      const b = getBounds(el);
      const tl = worldToScreen({ x: b.minX, y: b.minY }, scrollX, scrollY, zoom);
      const br = worldToScreen({ x: b.maxX, y: b.maxY }, scrollX, scrollY, zoom);
      ctx.strokeStyle = "#1971c2";
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      // handles
      const handles = handlePositions(tl, br);
      for (const h of handles) {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#1971c2";
      ctx.fillRect(h!.x - HANDLE_SIZE / 2, h!.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(h!.x - HANDLE_SIZE / 2, h!.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      }
    }
    // collaborator cursors
    for (const [uid, c] of Object.entries(board.collaborators)) {
      if (!c.cursor) continue;
      const sp = worldToScreen(c.cursor, scrollX, scrollY, zoom);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + 12, sp.y + 4);
      ctx.lineTo(sp.x + 4, sp.y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.font = "11px sans-serif";
      const label = c.username;
      const tw = ctx.measureText(label).width;
      ctx.fillRect(sp.x + 14, sp.y + 2, tw + 6, 16);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, sp.x + 17, sp.y + 14);
    }
  }, [size, elements, appState, zoom, scrollX, scrollY, theme, board.selectedIds, board.collaborators, board.tool]);

  useEffect(() => {
    render();
  }, [render]);

  const getPointer = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const findHandle = (sx: number, sy: number): string | null => {
    const sel = Array.from(board.selectedIds);
    if (sel.length !== 1) return null;
    const el = elements.find((e) => e.id === sel[0]);
    if (!el) return null;
    const b = getBounds(el);
    const tl = worldToScreen({ x: b.minX, y: b.minY }, scrollX, scrollY, zoom);
    const br = worldToScreen({ x: b.maxX, y: b.maxY }, scrollX, scrollY, zoom);
    const handles = handlePositions(tl, br);
    const names = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    for (let i = 0; i < handles.length; i++) {
      const h = handles[i]!;
      if (Math.abs(h.x - sx) < HANDLE_SIZE && Math.abs(h.y - sy) < HANDLE_SIZE) return names[i]!;
    }
    return null;
  };

  const hitTest = (wx: number, wy: number): ExcalidrawElement | null => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]!;
      if (el.isDeleted) continue;
      if (isPointInElement({ x: wx, y: wy }, el)) return el;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const sp = getPointer(e);
    const wp = screenToWorld(sp, scrollX, scrollY, zoom);
    stateRef.current.lastPointer = sp;
    const tool = board.tool.type;

    // pan with middle button or space+drag handled via tool hand; here: middle button pans
    if (e.button === 1) {
      stateRef.current.isPanning = true;
      stateRef.current.dragStart = sp;
      (e.target as any).setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === "hand") {
      stateRef.current.isPanning = true;
      stateRef.current.dragStart = sp;
      return;
    }

    if (tool === "selection" || tool === "eraser" || tool === "laser") {
      const handle = findHandle(sp.x, sp.y);
      if (handle) {
        stateRef.current.isResizing = true;
        stateRef.current.resizeHandle = handle;
        stateRef.current.dragStart = wp;
        return;
      }
      const hit = hitTest(wp.x, wp.y);
      if (hit) {
        if (!board.selectedIds.has(hit.id) && !e.shiftKey) {
          board.setSelection([hit.id]);
        } else if (e.shiftKey) {
          const s = new Set(board.selectedIds);
          if (s.has(hit.id)) s.delete(hit.id); else s.add(hit.id);
          board.setSelection(Array.from(s));
        }
        stateRef.current.isDragging = true;
        stateRef.current.dragStart = wp;
        const el = elements.find((x) => x.id === hit.id)!;
        stateRef.current.dragOffset = { x: wp.x - el.x, y: wp.y - el.y };
        return;
      }
      // start selection box
      board.setSelection([]);
      stateRef.current.selectionBox = { x1: sp.x, y1: sp.y, x2: sp.x, y2: sp.y };
      return;
    }

    if (tool === "text") {
      const el = createBaseElement("text", wp.x, wp.y, {
        text: "Text",
        fontSize: 20,
        fontFamily: "hand",
        textAlign: "left",
        verticalAlign: "top",
        lineHeight: 1.25,
        width: 60,
        height: 24,
        containerId: null,
      } as any);
      board.addElement(el);
      board.pushHistory();
      board.setSelection([el.id]);
      board.setTool({ type: "selection", locked: false });
      queueUpdate({ added: [el], modified: [], deleted: [], baseVersion: board.version });
      return;
    }

    // shape creation tools
    const type = tool as any;
    const el = createBaseElement(type, wp.x, wp.y);
    stateRef.current.creatingEl = el;
    stateRef.current.isDrawing = true;
    stateRef.current.dragStart = wp;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const sp = getPointer(e);
    const wp = screenToWorld(sp, scrollX, scrollY, zoom);
    const st = stateRef.current;
    sendCursor(wp.x, wp.y, board.tool.type, e.buttons ? "down" : "up");

    if (st.isPanning) {
      if (st.dragStart) {
        const dx = sp.x - st.dragStart.x;
        const dy = sp.y - st.dragStart.y;
        useBoard.setState((s) => ({
          appState: { ...s.appState, scrollX: (s.appState.scrollX ?? 0) + dx, scrollY: (s.appState.scrollY ?? 0) + dy },
        }));
        st.dragStart = sp;
      }
      return;
    }

    if (st.isDrawing && st.creatingEl && st.dragStart) {
      const el = st.creatingEl;
      const x = Math.min(st.dragStart.x, wp.x);
      const y = Math.min(st.dragStart.y, wp.y);
      const w = Math.abs(wp.x - st.dragStart.x);
      const h = Math.abs(wp.y - st.dragStart.y);
      st.creatingEl = { ...el, x, y, width: w, height: h };
      // force rerender by updating a dummy? We'll rely on state; set a temp via ref + render trigger
      useBoard.setState((s) => ({ ...s }));
      return;
    }

    if (st.isDragging && st.dragStart) {
      const dx = wp.x - st.dragStart.x;
      const dy = wp.y - st.dragStart.y;
      st.dragStart = wp;
      const sel = Array.from(board.selectedIds);
      for (const id of sel) {
        const el = elements.find((x) => x.id === id);
        if (!el) continue;
        board.updateElement(id, { x: el.x + dx, y: el.y + dy });
      }
      return;
    }

    if (st.isResizing && st.resizeHandle && st.dragStart) {
      // simple: adjust selected element bounds
      const sel = Array.from(board.selectedIds);
      if (sel.length === 1) {
        const el = elements.find((x) => x.id === sel[0]);
        if (el) {
          const dx = wp.x - st.dragStart.x;
          const dy = wp.y - st.dragStart.y;
          st.dragStart = wp;
          let { x, y, width, height } = el;
          const h = st.resizeHandle;
          if (h.includes("e")) width += dx;
          if (h.includes("w")) { x += dx; width -= dx; }
          if (h.includes("s")) height += dy;
          if (h.includes("n")) { y += dy; height -= dy; }
          if (width < 4) width = 4;
          if (height < 4) height = 4;
          board.updateElement(el.id, { x, y, width, height });
        }
      }
      return;
    }

    if (st.selectionBox) {
      st.selectionBox.x2 = sp.x;
      st.selectionBox.y2 = sp.y;
      useBoard.setState((s) => ({ ...s }));
      return;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const sp = getPointer(e);
    const wp = screenToWorld(sp, scrollX, scrollY, zoom);
    const st = stateRef.current;

    if (st.isPanning) {
      st.isPanning = false;
      st.dragStart = null;
      return;
    }

    if (st.isDrawing && st.creatingEl) {
      const el = st.creatingEl;
      // freedraw handling: if freedraw tool, collect points differently; here treat as rect-like
      if (board.tool.type === "freedraw") {
        // convert creating into freedraw with points from drag? simplified: single segment
      }
      const finalEl = { ...el, version: 1 };
      board.addElement(finalEl);
      board.pushHistory();
      board.setSelection([finalEl.id]);
      board.setTool({ type: "selection", locked: board.tool.locked });
      queueUpdate({ added: [finalEl], modified: [], deleted: [], baseVersion: board.version });
      st.creatingEl = null;
      st.isDrawing = false;
      st.dragStart = null;
      return;
    }

    if (st.isDragging) {
      st.isDragging = false;
      st.dragStart = null;
      const sel = Array.from(board.selectedIds);
      const modified = sel.map((id) => elements.find((x) => x.id === id)).filter(Boolean);
      if (modified.length) {
        board.pushHistory();
        queueUpdate({ added: [], modified, deleted: [], baseVersion: board.version });
      }
      return;
    }

    if (st.isResizing) {
      st.isResizing = false;
      st.resizeHandle = null;
      st.dragStart = null;
      const sel = Array.from(board.selectedIds);
      const modified = sel.map((id) => elements.find((x) => x.id === id)).filter(Boolean);
      if (modified.length) {
        board.pushHistory();
        queueUpdate({ added: [], modified, deleted: [], baseVersion: board.version });
      }
      return;
    }

    if (st.selectionBox) {
      const sb = st.selectionBox;
      const x1 = Math.min(sb.x1, sb.x2), y1 = Math.min(sb.y1, sb.y2);
      const x2 = Math.max(sb.x1, sb.x2), y2 = Math.max(sb.y1, sb.y2);
      const sel: string[] = [];
      for (const el of elements) {
        const b = getBounds(el);
        const tl = worldToScreen({ x: b.minX, y: b.minY }, scrollX, scrollY, zoom);
        const br = worldToScreen({ x: b.maxX, y: b.maxY }, scrollX, scrollY, zoom);
        if (tl.x >= x1 && br.x <= x2 && tl.y >= y1 && br.y <= y2) sel.push(el.id);
      }
      board.setSelection(sel);
      st.selectionBox = null;
      useBoard.setState((s) => ({ ...s }));
      return;
    }

    // eraser
    if (board.tool.type === "eraser") {
      const hit = hitTest(wp.x, wp.y);
      if (hit) {
        board.deleteElements([hit.id]);
        board.pushHistory();
        queueUpdate({ added: [], modified: [], deleted: [hit.id], baseVersion: board.version });
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const sp = getPointer(e as any);
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(8, Math.max(0.1, zoom * factor));
      useBoard.setState((s) => ({ appState: { ...s.appState, zoom: { value: newZoom } } }));
    } else {
      useBoard.setState((s) => ({
        appState: { ...s.appState, scrollX: (s.appState.scrollX ?? 0) - e.deltaX, scrollY: (s.appState.scrollY ?? 0) - e.deltaY },
      }));
    }
  };

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      if (e.shiftKey) board.redo(); else board.undo();
      e.preventDefault();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      const ids = Array.from(board.selectedIds);
      if (ids.length) {
        board.deleteElements(ids);
        board.pushHistory();
        queueUpdate({ added: [], modified: [], deleted: ids, baseVersion: board.version });
      }
      return;
    }
    if (e.key === "Escape") {
      board.setSelection([]);
      board.setTool({ type: "selection", locked: false });
    }
    // tool shortcuts
    const map: Record<string, any> = {
      v: { type: "selection", locked: false },
      r: { type: "rectangle", locked: false },
      o: { type: "ellipse", locked: false },
      d: { type: "diamond", locked: false },
      a: { type: "arrow", locked: false },
      l: { type: "line", locked: false },
      p: { type: "freedraw", locked: false },
      t: { type: "text", locked: false },
      e: { type: "eraser", locked: false },
      h: { type: "hand", locked: false },
    };
    if (map[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
      board.setTool(map[e.key.toLowerCase()]);
    }
  }, [board, elements]);

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  // freedraw points collection handled separately? We'll add a simple freedraw: on pointer down with freedraw tool, create el and append points on move.
  // Override: handle freedraw creation
  const origDown = onPointerDown;
  // We'll patch via tool check inside onPointerDown? Already not. Let's instead handle freedraw in a wrapper.
  const handleDown = (e: React.PointerEvent) => {
    if (board.tool.type === "freedraw") {
      const sp = getPointer(e);
      const wp = screenToWorld(sp, scrollX, scrollY, zoom);
      const el = createBaseElement("freedraw", wp.x, wp.y, { points: [{ x: 0, y: 0 }], pressures: [0.5], simulatePressure: true, width: 0, height: 0 } as any);
      stateRef.current.creatingEl = el;
      stateRef.current.isDrawing = true;
      stateRef.current.dragStart = wp;
      // store current point base
      (stateRef.current as any).freedrawBase = wp;
      (stateRef.current as any).freedrawPoints = [{ x: 0, y: 0 }];
      return;
    }
    origDown(e);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (board.tool.type === "freedraw" && stateRef.current.isDrawing && stateRef.current.creatingEl) {
      const sp = getPointer(e);
      const wp = screenToWorld(sp, scrollX, scrollY, zoom);
      const base = (stateRef.current as any).freedrawBase as Point;
      const pts = (stateRef.current as any).freedrawPoints as Point[];
      pts.push({ x: wp.x - base.x, y: wp.y - base.y });
      (stateRef.current as any).freedrawPoints = pts;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      stateRef.current.creatingEl = {
        ...(stateRef.current.creatingEl as any),
        points: pts,
        x: base.x + minX,
        y: base.y + minY,
        width: maxX - minX,
        height: maxY - minY,
      } as any;
      if (stateRef.current.creatingEl) {
        (stateRef.current.creatingEl as any).points = pts.map((p) => ({ x: base.x + p.x - (base.x + minX), y: base.y + p.y - (base.y + minY) }));
      }
      useBoard.setState((s) => ({ ...s }));
      return;
    }
    onPointerMove(e);
  };

  const handleUp = (e: React.PointerEvent) => {
    if (board.tool.type === "freedraw" && stateRef.current.isDrawing && stateRef.current.creatingEl) {
      const el = stateRef.current.creatingEl;
      board.addElement(el);
      board.pushHistory();
      board.setSelection([el.id]);
      board.setTool({ type: "selection", locked: board.tool.locked });
      queueUpdate({ added: [el], modified: [], deleted: [], baseVersion: board.version });
      stateRef.current.creatingEl = null;
      stateRef.current.isDrawing = false;
      stateRef.current.dragStart = null;
      return;
    }
    onPointerUp(e);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-canvas">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onWheel={onWheel}
        style={{ cursor: board.tool.type === "hand" ? "grab" : board.tool.type === "text" ? "text" : "crosshair" }}
      />
    </div>
  );
}

function handlePositions(tl: { x: number; y: number }, br: { x: number; y: number }) {
  const mx = (tl.x + br.x) / 2, my = (tl.y + br.y) / 2;
  return [
    { x: tl.x, y: tl.y }, { x: mx, y: tl.y }, { x: br.x, y: tl.y },
    { x: br.x, y: my }, { x: br.x, y: br.y }, { x: mx, y: br.y },
    { x: tl.x, y: br.y }, { x: tl.x, y: my },
  ];
}

function drawElement(ctx: CanvasRenderingContext2D, rc: RoughCanvas, el: ExcalidrawElement, scrollX: number, scrollY: number, zoom: number, theme: string) {
  const x = el.x * zoom + scrollX;
  const y = el.y * zoom + scrollY;
  const w = el.width * zoom;
  const h = el.height * zoom;
  const stroke = el.strokeColor;
  const fill = el.backgroundColor;
  const opts: any = {
    stroke,
    strokeWidth: el.strokeWidth * zoom,
    roughness: el.roughness,
    fill: fill === "transparent" ? undefined : fill,
    fillStyle: el.fillStyle,
    opacity: el.opacity / 100,
  };
  if (el.strokeStyle === "dashed") opts.strokeLineDash = [8 * zoom, 6 * zoom];
  if (el.strokeStyle === "dotted") opts.strokeLineDash = [2 * zoom, 4 * zoom];

  ctx.save();
  if (el.angle) {
    const cx = x + w / 2, cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(el.angle);
    ctx.translate(-cx, -cy);
  }

  switch (el.type) {
    case "rectangle":
      rc.rectangle(x, y, w, h, opts);
      break;
    case "ellipse":
      rc.ellipse(x + w / 2, y + h / 2, w, h, opts);
      break;
    case "diamond": {
      const cx = x + w / 2, cy = y + h / 2;
      rc.polygon([[cx, y], [x + w, cy], [cx, y + h], [x, cy]], opts);
      break;
    }
    case "freedraw": {
      const fe = el as any;
      const pts = (fe.points ?? []).map((p: any) => [el.x + p.x * zoom + (scrollX?0:0) ? p.x : p.x, 0]);
      // build screen points
      const screenPts = (fe.points ?? []).map((p: any) => ({
        x: (el.x + p.x) * zoom + scrollX,
        y: (el.y + p.y) * zoom + scrollY,
      }));
      const strokePts = (fe.points ?? []).map((p: any, i: number) => [
        (el.x + p.x) * zoom + scrollX,
        (el.y + p.y) * zoom + scrollY,
        (fe.pressures?.[i] ?? 0.5),
      ]);
      const outline = getStroke(strokePts, { size: Math.max(1, el.strokeWidth * zoom * 2), thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
      if (outline.length) {
        ctx.beginPath();
        ctx.moveTo(outline[0]![0], outline[0]![1]);
        for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i]![0], outline[i]![1]);
        ctx.closePath();
        ctx.fillStyle = el.strokeColor;
        ctx.fill();
      }
      break;
    }
    case "arrow":
    case "line": {
      const le = el as any;
      const pts = (le.points ?? [{ x: 0, y: 0 }, { x: el.width, y: el.height }]).map((p: any) => [x + p.x * zoom, y + p.y * zoom]);
      if (pts.length > 1) rc.linearPath(pts, { ...opts, fill: undefined });
      // arrowhead
      if (el.type === "arrow" && pts.length >= 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
        const size = 12 * zoom;
        ctx.beginPath();
        ctx.moveTo(last[0], last[1]);
        ctx.lineTo(last[0] - size * Math.cos(ang - Math.PI / 6), last[1] - size * Math.sin(ang - Math.PI / 6));
        ctx.moveTo(last[0], last[1]);
        ctx.lineTo(last[0] - size * Math.cos(ang + Math.PI / 6), last[1] - size * Math.sin(ang + Math.PI / 6));
        ctx.strokeStyle = stroke;
        ctx.lineWidth = el.strokeWidth * zoom;
        ctx.stroke();
      }
      break;
    }
    case "text": {
      const te = el as any;
      ctx.font = `${(te.fontSize ?? 20) * zoom}px ${fontFamily(te.fontFamily)}`;
      ctx.fillStyle = stroke;
      ctx.textBaseline = "top";
      const lines = String(te.text ?? "").split("\n");
      lines.forEach((ln: string, i: number) => {
        ctx.fillText(ln, x, y + i * (te.fontSize ?? 20) * zoom * (te.lineHeight ?? 1.25));
      });
      break;
    }
    case "image": {
      // placeholder
      ctx.fillStyle = "#eee";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#999";
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#666";
      ctx.font = "12px sans-serif";
      ctx.fillText("Image", x + 8, y + 16);
      break;
    }
    case "frame": {
      ctx.strokeStyle = "#999";
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = "#999";
      ctx.font = "12px sans-serif";
      ctx.fillText("Frame", x + 4, y - 14);
      break;
    }
    default:
      rc.rectangle(x, y, w, h, opts);
  }
  ctx.restore();
}

function fontFamily(f: string) {
  switch (f) {
    case "code": return "monospace";
    case "serif": return "serif";
    case "normal": return "sans-serif";
    default: return '"Comic Sans MS", "Marker Felt", cursive';
  }
}
