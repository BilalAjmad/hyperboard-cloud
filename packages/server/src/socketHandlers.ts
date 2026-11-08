import type { Server, Socket } from "socket.io";
import {
  JoinRoomSchema,
  CreateRoomSchema,
  ElementPatchSchema,
  CursorSchema,
  PresenceSchema,
  ChatSchema,
} from "@hyperboard/shared";
import {
  createRoom,
  loadOrCreateRoom,
  joinRoom,
  leaveRoom,
  applyPatch,
  setLocked,
  roomToInit,
  getRoom,
  forceSave,
} from "./roomStore";
import { config } from "./config";

interface SocketData {
  userId?: string;
  username?: string;
  color?: string;
  roomCode?: string;
}

export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on("room:create", (payload, ack) => {
      const parsed = CreateRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: "Invalid payload" });
        return;
      }
      const { name, user, password, code } = parsed.data;
      const room = createRoom(name, user, password, code);
      data.userId = user.id;
      data.username = user.name;
      data.color = user.color;
      data.roomCode = room.state.meta.code;
      socket.join(room.state.meta.code);
      socket.emit("room:joined", { code: room.state.meta.code, roomId: room.state.meta.id, role: "host" });
      socket.emit("room:init", roomToInit(room));
      io.to(room.state.meta.code).emit("room:user-joined", room.state.users[room.state.users.length - 1]);
      ack?.({ ok: true, code: room.state.meta.code, roomId: room.state.meta.id });
    });

    socket.on("room:join", (payload, ack) => {
      const parsed = JoinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: "Invalid payload" });
        return;
      }
      const { code, user, password } = parsed.data;
      const room = loadOrCreateRoom(code.toUpperCase());
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }
      const res = joinRoom(room, user, password);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      data.userId = user.id;
      data.username = user.name;
      data.color = user.color;
      data.roomCode = room.state.meta.code;
      socket.join(room.state.meta.code);
      socket.emit("room:joined", { code: room.state.meta.code, roomId: room.state.meta.id, role: res.role });
      socket.emit("room:init", roomToInit(room));
      const u = room.state.users.find((x: any) => x.id === user.id);
      if (u) io.to(room.state.meta.code).emit("room:user-joined", u);
      ack?.({ ok: true });
    });

    socket.on("room:update", (payload) => {
      const parsed = ElementPatchSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = data.roomCode;
      if (!code) return;
      const room = getRoom(code);
      if (!room) return;
      if (room.state.meta.locked && room.state.meta.hostId !== data.userId) return;
      const res = applyPatch(room, parsed.data as any, data.userId ?? "unknown");
      if (!res.ok && res.reconcile) {
        socket.emit("room:reconcile", {
          elements: room.state.elements,
          appState: room.state.appState,
          files: room.state.files,
          comments: room.state.comments,
          users: room.state.users,
          version: room.state.version,
        });
        return;
      }
      io.to(code).emit("room:changes", {
        added: (parsed.data as any).added ?? [],
        modified: (parsed.data as any).modified ?? [],
        deleted: (parsed.data as any).deleted ?? [],
        version: res.version,
        sourceUserId: data.userId ?? "unknown",
      });
    });

    socket.on("room:cursor", (payload) => {
      const parsed = CursorSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = data.roomCode;
      if (!code) return;
      socket.to(code).emit("room:cursor", {
        userId: data.userId ?? "unknown",
        username: data.username ?? "Guest",
        color: data.color ?? "#1e1e1e",
        cursor: parsed.data,
      });
    });

    socket.on("room:presence", (payload) => {
      const parsed = PresenceSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = data.roomCode;
      if (!code) return;
      socket.to(code).emit("room:presence", {
        userId: data.userId ?? "unknown",
        presence: parsed.data,
      });
    });

    socket.on("room:chat", (payload) => {
      const parsed = ChatSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = data.roomCode;
      if (!code) return;
      io.to(code).emit("room:chat", {
        userId: data.userId ?? "unknown",
        username: data.username ?? "Guest",
        color: data.color ?? "#1e1e1e",
        text: parsed.data.text,
        at: Date.now(),
      });
    });

    socket.on("room:lock", (payload) => {
      const code = data.roomCode;
      if (!code) return;
      const room = getRoom(code);
      if (!room) return;
      const ok = setLocked(room, Boolean((payload as any)?.locked), data.userId ?? "");
      if (ok) io.to(code).emit("room:locked", { locked: room.state.meta.locked });
    });

    socket.on("room:leave", () => {
      const code = data.roomCode;
      if (!code) return;
      const room = getRoom(code);
      if (room && data.userId) leaveRoom(room, data.userId);
      socket.leave(code);
      if (room) forceSave(room);
      if (data.userId) io.to(code).emit("room:user-left", { userId: data.userId });
      data.roomCode = undefined;
    });

    socket.on("disconnect", () => {
      const code = data.roomCode;
      if (!code) return;
      const room = getRoom(code);
      if (room && data.userId) leaveRoom(room, data.userId);
      if (room) forceSave(room);
      if (data.userId) io.to(code).emit("room:user-left", { userId: data.userId });
    });
  });
}
