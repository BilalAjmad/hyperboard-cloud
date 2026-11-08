export const COLORS = {
  stroke: [
    "#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00",
    "#9c36b5", "#0c8599", "#ffffff", "#868e96", "#495057",
  ],
  background: [
    "transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99",
    "#d0bfff", "#99e9f2", "#f8f9fa", "#dee2e6", "#212529",
  ],
};

export const DEFAULT_STROKE = "#1e1e1e";
export const DEFAULT_BACKGROUND = "transparent";
export const DEFAULT_FILL_STYLE: "solid" | "hachure" | "cross-hatch" | "zigzag" = "hachure";

export function randomColor(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] ?? list[0] ?? "#1e1e1e";
}

export function parseColorHex(c: string): { r: number; g: number; b: number; a: number } {
  if (c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const h = c.replace("#", "");
  const n = parseInt(h, 16);
  if (h.length === 6) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  if (h.length === 8) return { r: (n >> 24) & 255, g: (n >> 16) & 255, b: (n >> 8) & 255, a: (n & 255) / 255 };
  return { r: 0, g: 0, b: 0, a: 1 };
}
