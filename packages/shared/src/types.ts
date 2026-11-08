export type Point = { x: number; y: number };

export type ElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "image"
  | "frame"
  | "embed";

export type FillStyle = "solid" | "hachure" | "cross-hatch" | "zigzag";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type FontFamily = "hand" | "normal" | "code" | "serif";
export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: number | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  locked: boolean;
  link: string | null;
  customData?: Record<string, unknown>;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  lineHeight: number;
  containerId: string | null;
}

export interface FreedrawElement extends BaseElement {
  type: "freedraw";
  points: Point[];
  pressures: number[];
  simulatePressure: boolean;
}

export interface LinearElement extends BaseElement {
  type: "arrow" | "line";
  points: Point[];
  startBinding: Binding | null;
  endBinding: Binding | null;
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
  elbowed: boolean;
}

export interface ImageElement extends BaseElement {
  type: "image";
  fileId: string;
  status: "pending" | "saved" | "error";
  scale: [number, number];
  crop: { x: number; y: number; width: number; height: number } | null;
}

export type Binding = {
  elementId: string;
  focus: number;
  gap: number;
};

export type Arrowhead =
  | "arrow"
  | "bar"
  | "dot"
  | "triangle"
  | "diamond"
  | null;

export type ExcalidrawElement =
  | BaseElement
  | TextElement
  | FreedrawElement
  | LinearElement
  | ImageElement;

export type ElementsMap = Record<string, ExcalidrawElement>;

export interface AppState {
  viewBackgroundColor: string;
  gridSize: number | null;
  zoom: { value: number };
  scrollX: number;
  scrollY: number;
  theme: "light" | "dark";
  selectedElementIds: Record<string, true>;
  activeTool: { type: "selection" | ElementType | "eraser" | "hand" | "laser"; locked: boolean };
  collaborators: Record<string, Collaborator>;
  name: string;
  username: string;
  color: string;
  cursorButton: "up" | "down";
  editingTextElement: string | null;
  multiElement: ExcalidrawElement | null;
  isResizing: boolean;
  isRotating: boolean;
  openMenu: string | null;
  openSidebar: "library" | "comments" | null;
  toastMessage: string | null;
  showGrid: boolean;
  snapToGrid: boolean;
  zenModeEnabled: boolean;
  viewModeEnabled: boolean;
  gridSizeValue: number;
}

export interface Collaborator {
  id: string;
  username: string;
  color: string;
  pointer: { x: number; y: number; tool: string } | null;
  button: "up" | "down";
  selectedElementIds: Record<string, true>;
  viewport: { scrollX: number; scrollY: number; zoom: number } | null;
  avatarUrl: string | null;
  isSpeaking: boolean;
}

export interface BinaryFileData {
  id: string;
  dataURL: string;
  mimeType: string;
  created: number;
  lastRetrieved: number;
}

export interface LibraryItem {
  id: string;
  name: string;
  elements: ExcalidrawElement[];
  createdAt: number;
}

export interface Comment {
  id: string;
  elementId: string | null;
  x: number;
  y: number;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
  resolved: boolean;
  replies: Comment[];
}

export interface RoomUser {
  id: string;
  name: string;
  color: string;
  role: "host" | "guest";
  joinedAt: number;
}

export interface RoomMeta {
  code: string;
  id: string;
  name: string;
  hostId: string;
  password: string | null;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

export interface RoomState {
  meta: RoomMeta;
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: Record<string, BinaryFileData>;
  comments: Comment[];
  version: number;
  users: RoomUser[];
}

export interface UserIdentity {
  id: string;
  name: string;
  color: string;
}
