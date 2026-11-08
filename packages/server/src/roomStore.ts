import { randomUUID } from "node:crypto";
import {
  generateRoomCode,
  newId,
  type RoomState,
  type RoomMeta,
  type RoomUser,
  type UserIdentity,
  type ExcalidrawElement,
} from "@hyperboard/shared";
import { loadRoom, saveRoomSync } from "./persistence";
import { config } from "./config";

export interface Room {
  state: RoomState;
  sockets: Map<string, string>; // socketId -> userId
  saveTimer: NodeJS.Timeout | null;
  dirty: boolean;
}

const rooms = new Map<string, Room>();

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function createRoom(name: string, host: UserIdentity, password?: string, customCode?: string): Room {
  let code = (customCode ?? "").trim().toUpperCase();
  if (code.length < 4) code = generateRoomCode();
  // ensure uniqueness
  while (rooms.has(code) || loadRoom(config.dataDir, code)) {
    code = generateRoomCode();
  }
  const now = Date.now();
  const meta: RoomMeta = {
    code,
    id: newId(),
    name,
    hostId: host.id,
    password: password ?? null,
    locked: false,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };
  const state: RoomState = {
    meta,
    elements: [],
    appState: { viewBackgroundColor: "#ffffff", theme: "light" },
    files: {},
    comments: [],
    version: 0,
    users: [{ id: host.id, name: host.name, color: host.color, role: "host", joinedAt: now }],
  };
  const room: Room = { state, sockets: new Map(), saveTimer: null, dirty: true };
  rooms.set(code, room);
  scheduleSave(room);
  return room;
}

export function loadOrCreateRoom(code: string): Room | null {
  const existing = rooms.get(code);
  if (existing) return existing;
  const persisted = loadRoom(config.dataDir, code);
  if (!persisted) return null;
  const room: Room = { state: persisted, sockets: new Map(), saveTimer: null, dirty: false };
  rooms.set(code, room);
  return room;
}

export function joinRoom(room: Room, user: UserIdentity, password?: string): { ok: boolean; error?: string; role: "host" | "guest" } {
  if (room.state.meta.password && room.state.meta.password !== (password ?? "")) {
    return { ok: false, error: "Invalid password", role: "guest" };
  }
  if (room.state.meta.locked && room.state.meta.hostId !== user.id) {
    return { ok: false, error: "Room is locked", role: "guest" };
  }
  if (config.maxUsersPerRoom > 0 && room.state.users.length >= config.maxUsersPerRoom) {
    return { ok: false, error: "Room is full", role: "guest" };
  }
  const existing = room.state.users.find((u: any) => u.id === user.id);
  if (!existing) {
    const role: "host" | "guest" = room.state.meta.hostId === user.id ? "host" : "guest";
    room.state.users.push({ id: user.id, name: user.name, color: user.color, role, joinedAt: Date.now() });
    room.dirty = true;
    scheduleSave(room);
  }
  const role: "host" | "guest" = room.state.meta.hostId === user.id ? "host" : "guest";
  return { ok: true, role };
}

export function leaveRoom(room: Room, userId: string): void {
  room.state.users = room.state.users.filter((u: any) => u.id !== userId);
  room.dirty = true;
  scheduleSave(room);
  if (room.state.users.length === 0) {
    // keep persisted; remove from memory after TTL? keep simple: keep in memory
  }
}

export function applyPatch(
  room: Room,
  patch: { added: any[]; modified: any[]; deleted: string[]; baseVersion: number },
  sourceUserId: string,
): { ok: boolean; version: number; reconcile?: boolean } {
  if (patch.baseVersion !== room.state.version) {
    return { ok: false, version: room.state.version, reconcile: true };
  }
  const byId = new Map(room.state.elements.map((e: any) => [e.id, e]));
  for (const el of patch.added) byId.set(el.id, { ...el, version: el.version ?? 1 });
  for (const el of patch.modified) {
    const prev = byId.get(el.id);
    byId.set(el.id, { ...(prev ?? {}), ...el, version: (prev?.version ?? 0) + 1 });
  }
  for (const id of patch.deleted) {
    const el = byId.get(id);
    if (el) byId.set(id, { ...el, isDeleted: true, version: el.version + 1 });
  }
  room.state.elements = Array.from(byId.values());
  room.state.version += 1;
  room.state.meta.updatedAt = Date.now();
  room.dirty = true;
  scheduleSave(room);
  return { ok: true, version: room.state.version };
}

export function scheduleSave(room: Room): void {
  if (room.saveTimer) return;
  room.saveTimer = setTimeout(() => {
    room.saveTimer = null;
    if (room.dirty) {
      try {
        saveRoomSync(config.dataDir, room.state);
        room.dirty = false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("save failed", e);
      }
    }
  }, config.saveDebounceMs);
}

export function forceSave(room: Room): void {
  if (room.saveTimer) {
    clearTimeout(room.saveTimer);
    room.saveTimer = null;
  }
  if (room.dirty) {
    saveRoomSync(config.dataDir, room.state);
    room.dirty = false;
  }
}

export function setLocked(room: Room, locked: boolean, userId: string): boolean {
  if (room.state.meta.hostId !== userId) return false;
  room.state.meta.locked = locked;
  room.dirty = true;
  scheduleSave(room);
  return true;
}

export function roomToInit(room: Room) {
  return {
    meta: {
      code: room.state.meta.code,
      id: room.state.meta.id,
      name: room.state.meta.name,
      hostId: room.state.meta.hostId,
      locked: room.state.meta.locked,
      createdAt: room.state.meta.createdAt,
      updatedAt: room.state.meta.updatedAt,
    },
    elements: room.state.elements,
    appState: room.state.appState,
    files: room.state.files,
    comments: room.state.comments,
    users: room.state.users,
    version: room.state.version,
  };
}

export function allRooms(): Room[] {
  return Array.from(rooms.values());
}
