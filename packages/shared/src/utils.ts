import type { Point, ExcalidrawElement } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function newVersionNonce(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function bumpVersion(el: ExcalidrawElement): ExcalidrawElement {
  return { ...el, version: el.version + 1, versionNonce: newVersionNonce() };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function rotatePoint(p: Point, center: Point, angle: number): Point {
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = p.x - center.x, dy = p.y - center.y;
  return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export function createBaseElement(
  type: ExcalidrawElement["type"],
  x: number,
  y: number,
  overrides: Partial<ExcalidrawElement> = {},
): ExcalidrawElement {
  const base = {
    id: newId(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "hachure" as const,
    strokeWidth: 2,
    strokeStyle: "solid" as const,
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: newSeed(),
    version: 1,
    versionNonce: newVersionNonce(),
    isDeleted: false,
    locked: false,
    link: null,
  };
  return { ...base, ...overrides } as ExcalidrawElement;
}

export function getBounds(el: ExcalidrawElement): { minX: number; minY: number; maxX: number; maxY: number } {
  if (el.type === "freedraw" || el.type === "arrow" || el.type === "line") {
    const pts = (el as { points?: Point[] }).points ?? [{ x: 0, y: 0 }];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, el.x + p.x);
      minY = Math.min(minY, el.y + p.y);
      maxX = Math.max(maxX, el.x + p.x);
      maxY = Math.max(maxY, el.y + p.y);
    }
    return { minX, minY, maxX, maxY };
  }
  return { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height };
}

export function isPointInElement(p: Point, el: ExcalidrawElement): boolean {
  const b = getBounds(el);
  if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) return false;
  if (el.type === "ellipse" || el.type === "diamond") {
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const rx = (b.maxX - b.minX) / 2, ry = (b.maxY - b.minY) / 2;
    if (rx === 0 || ry === 0) return false;
    const dx = (p.x - cx) / rx, dy = (p.y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return true;
}
