import { create } from "zustand";
import type {
  ExcalidrawElement,
  AppState,
  UserIdentity,
  RoomUser,
  Comment,
  BinaryFileData,
} from "@hyperboard/shared";
import { createBaseElement, newId } from "@hyperboard/shared";

export interface BoardState {
  roomId: string | null;
  roomCode: string | null;
  role: "host" | "guest" | null;
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: Record<string, BinaryFileData>;
  comments: Comment[];
  users: RoomUser[];
  version: number;
  user: UserIdentity | null;
  collaborators: Record<string, { username: string; color: string; cursor: { x: number; y: number } | null; selected: string[] }>;
  tool: AppState["activeTool"];
  selectedIds: Set<string>;
  history: ExcalidrawElement[][];
  historyIndex: number;
  setTool: (t: AppState["activeTool"]) => void;
  setElements: (els: ExcalidrawElement[]) => void;
  applyRemoteChanges: (added: any[], modified: any[], deleted: string[], version: number) => void;
  addElement: (el: ExcalidrawElement) => void;
  updateElement: (id: string, patch: Partial<ExcalidrawElement>) => void;
  deleteElements: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  setRoom: (code: string, roomId: string, role: "host" | "guest") => void;
  setUsers: (u: RoomUser[]) => void;
  addUser: (u: RoomUser) => void;
  removeUser: (id: string) => void;
  setCursor: (userId: string, username: string, color: string, x: number, y: number) => void;
  setVersion: (v: number) => void;
  reconcile: (els: ExcalidrawElement[], appState: any, files: any, comments: any, users: any, version: number) => void;
  reset: () => void;
}

const defaultTool: AppState["activeTool"] = { type: "selection", locked: false };

export const useBoard = create<BoardState>((set, get) => ({
  roomId: null,
  roomCode: null,
  role: null,
  elements: [],
  appState: { viewBackgroundColor: "#ffffff", theme: "light", zoom: { value: 1 }, scrollX: 0, scrollY: 0, gridSize: 20, showGrid: true, snapToGrid: true },
  files: {},
  comments: [],
  users: [],
  version: 0,
  user: null,
  collaborators: {},
  tool: defaultTool,
  selectedIds: new Set(),
  history: [[]],
  historyIndex: 0,
  setTool: (t) => set({ tool: t }),
  setElements: (els) => set({ elements: els }),
  applyRemoteChanges: (added, modified, deleted, version) => {
    set((s) => {
      const map = new Map(s.elements.map((e) => [e.id, e]));
      for (const el of added) map.set(el.id, el);
      for (const el of modified) {
        const prev = map.get(el.id);
        map.set(el.id, prev ? { ...prev, ...el } : el);
      }
      for (const id of deleted) {
        const el = map.get(id);
        if (el) map.set(id, { ...el, isDeleted: true });
      }
      return { elements: Array.from(map.values()).filter((e) => !e.isDeleted), version };
    });
  },
  addElement: (el) => set((s) => ({ elements: [...s.elements, el] })),
  updateElement: (id, patch) => set((s) => ({ elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
  deleteElements: (ids) => set((s) => ({ elements: s.elements.filter((e) => !ids.includes(e.id)) })),
  setSelection: (ids) => set({ selectedIds: new Set(ids) }),
  pushHistory: () => set((s) => {
    const snap = s.elements.map((e) => ({ ...e }));
    const trimmed = s.history.slice(0, s.historyIndex + 1);
    const next = [...trimmed, snap].slice(-101);
    return { history: next, historyIndex: next.length - 1 };
  }),
  undo: () => set((s) => {
    if (s.historyIndex <= 0) return {};
    const idx = s.historyIndex - 1;
    const snap = s.history[idx];
    if (!snap) return {};
    return { elements: snap.map((e) => ({ ...e })), historyIndex: idx };
  }),
  redo: () => set((s) => {
    if (s.historyIndex >= s.history.length - 1) return {};
    const idx = s.historyIndex + 1;
    const snap = s.history[idx];
    if (!snap) return {};
    return { elements: snap.map((e) => ({ ...e })), historyIndex: idx };
  }),
  setRoom: (code, roomId, role) => set({ roomCode: code, roomId, role }),
  setUsers: (u) => set({ users: u }),
  addUser: (u) => set((s) => (s.users.find((x) => x.id === u.id) ? {} : { users: [...s.users, u] })),
  removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id), collaborators: Object.fromEntries(Object.entries(s.collaborators).filter(([k]) => k !== id)) })),
  setCursor: (userId, username, color, x, y) => set((s) => ({
    collaborators: { ...s.collaborators, [userId]: { username, color, cursor: { x, y }, selected: s.collaborators[userId]?.selected ?? [] } },
  })),
  setVersion: (v) => set({ version: v }),
  reconcile: (els, appState, files, comments, users, version) => set({
    elements: els.filter((e: any) => !e.isDeleted),
    appState: { ...appState },
    files: files ?? {},
    comments: comments ?? [],
    users: users ?? [],
    version,
  }),
  reset: () => set({
    roomId: null, roomCode: null, role: null, elements: [], files: {}, comments: [], users: [], version: 0,
    collaborators: {}, selectedIds: new Set(), history: [[]], historyIndex: 0,
  }),
}));

export { createBaseElement, newId };
export type { ExcalidrawElement };
