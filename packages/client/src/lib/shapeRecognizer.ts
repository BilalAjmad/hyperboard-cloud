import type { Point } from "@hyperboard/shared";

export type ShapeKind = "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | null;

export function recognizeShape(points: Point[]): ShapeKind {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 4 || h < 4) return "line";
  const aspect = w / h;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const closureDist = Math.hypot(first.x - last.x, first.y - last.y);
  const perimeter = points.reduce((acc, p, i) => {
    if (i === 0) return acc;
    const prev = points[i - 1]!;
    return acc + Math.hypot(p.x - prev.x, p.y - prev.y);
  }, 0);
  const closed = closureDist < perimeter * 0.15;

  let corners = 0;
  for (let i = 2; i < points.length; i++) {
    const p0 = points[i - 2]!;
    const p1 = points[i - 1]!;
    const p2 = points[i]!;
    const a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const b = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let diff = Math.abs(b - a);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 0.6) corners++;
  }

  if (!closed) {
    if (corners <= 2) return "arrow";
    return "line";
  }
  if (corners <= 4 && aspect > 0.7 && aspect < 1.4) {
    const targets = [
      { x: (minX + maxX) / 2, y: minY },
      { x: maxX, y: (minY + maxY) / 2 },
      { x: (minX + maxX) / 2, y: maxY },
      { x: minX, y: (minY + maxY) / 2 },
    ];
    let midCorners = 0;
    for (const t of targets) {
      if (points.some((p) => Math.hypot(p.x - t.x, p.y - t.y) < 8)) midCorners++;
    }
    if (midCorners >= 3) return "diamond";
    return "rectangle";
  }
  if (aspect > 0.5 && aspect < 2) return "ellipse";
  return "rectangle";
}
