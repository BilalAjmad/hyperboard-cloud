import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@hyperboard/shared";
import { useBoard } from "./store";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL || "/";

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(SERVER_URL, { transports: ["websocket", "polling"], reconnection: true });
    wire(socket);
  }
  return socket;
}

function wire(s: Socket<ServerToClientEvents, ClientToServerEvents>) {
  s.on("room:init", (p) => {
    const st = useBoard.getState();
    st.reconcile(p.elements as any, p.appState, p.files, p.comments, p.users, p.version);
    st.setUsers(p.users);
    if (p.meta?.code) useBoard.setState({ roomCode: p.meta.code });
    window.dispatchEvent(new CustomEvent("lanboard:remote", { detail: { elements: p.elements, appState: p.appState, files: p.files, version: p.version } }));
  });
  s.on("room:changes", (p) => {
    useBoard.getState().applyRemoteChanges(p.added, p.modified, p.deleted, p.version);
    // Reconstruct full elements? We only have deltas. Need to fetch? For Excalidraw, apply deltas by merging into current scene.
    // Use Excalidraw API via global? We'll dispatch a delta event.
    window.dispatchEvent(new CustomEvent("lanboard:remote-delta", { detail: p }));
  });
  s.on("room:reconcile", (p) => {
    useBoard.getState().reconcile(p.elements as any, p.appState, p.files, p.comments, p.users, p.version);
  });
  s.on("room:cursor", (p) => {
    useBoard.getState().setCursor(p.userId, p.username, p.color, p.cursor.x, p.cursor.y);
  });
  s.on("room:presence", (p) => {
    // merge selection into collaborator
    const st = useBoard.getState();
    const c = st.collaborators[p.userId];
    if (c) {
      useBoard.setState((s) => ({
        collaborators: { ...s.collaborators, [p.userId]: { ...c, selected: Object.keys(p.presence.selectedElementIds) } },
      }));
    }
  });
  s.on("room:user-joined", (u) => useBoard.getState().addUser(u));
  s.on("room:user-left", (p) => useBoard.getState().removeUser(p.userId));
  s.on("room:chat", () => { /* handled in component */ });
  s.on("room:locked", (p) => {
    // eslint-disable-next-line no-console
    console.log("room locked", p.locked);
  });
  s.on("room:error", (p) => {
    // eslint-disable-next-line no-console
    console.error("room error", p);
  });
}

export function joinRoom(code: string, user: { id: string; name: string; color: string }, password?: string) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    getSocket().emit("room:join", { code, user, password }, (res) => resolve(res));
  });
}

export function createRoom(name: string, user: { id: string; name: string; color: string }, password?: string) {
  return new Promise<{ ok: boolean; code?: string; roomId?: string; error?: string }>((resolve) => {
    getSocket().emit("room:create", { name, user, password }, (res) => resolve(res));
  });
}

let cursorTimer: any = null;
let pendingCursor: { x: number; y: number; tool: string; button: "up" | "down" } | null = null;
export function sendCursor(x: number, y: number, tool: string, button: "up" | "down") {
  pendingCursor = { x, y, tool, button };
  if (cursorTimer) return;
  cursorTimer = setTimeout(() => {
    cursorTimer = null;
    if (pendingCursor) {
      getSocket().emit("room:cursor", pendingCursor);
      pendingCursor = null;
    }
  }, 30);
}

let updateTimer: any = null;
let pendingPatch: { added: any[]; modified: any[]; deleted: string[]; baseVersion: number } | null = null;
export function queueUpdate(patch: { added: any[]; modified: any[]; deleted: string[]; baseVersion: number }) {
  if (!pendingPatch) pendingPatch = { added: [], modified: [], deleted: [], baseVersion: patch.baseVersion };
  pendingPatch.added.push(...patch.added);
  pendingPatch.modified.push(...patch.modified);
  pendingPatch.deleted.push(...patch.deleted);
  pendingPatch.baseVersion = patch.baseVersion;
  if (updateTimer) return;
  updateTimer = setTimeout(() => {
    updateTimer = null;
    if (pendingPatch) {
      getSocket().emit("room:update", pendingPatch);
      pendingPatch = null;
    }
  }, 50);
}

export function sendPresence(selectedElementIds: Record<string, true>) {
  getSocket().emit("room:presence", { selectedElementIds, viewport: null });
}

export function sendChat(text: string) {
  getSocket().emit("room:chat", { text });
}

export function sendLock(locked: boolean) {
  getSocket().emit("room:lock", { locked });
}
