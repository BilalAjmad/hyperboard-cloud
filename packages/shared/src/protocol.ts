import { z } from "zod";
import type { ExcalidrawElement, AppState, BinaryFileData, Comment, RoomUser, UserIdentity } from "./types";

export const PointSchema = z.object({ x: z.number(), y: z.number() });

export const UserIdentitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const JoinRoomSchema = z.object({
  code: z.string().min(4).max(12),
  user: UserIdentitySchema,
  password: z.string().max(64).optional(),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(60).default("Untitled board"),
  user: UserIdentitySchema,
  password: z.string().max(64).optional(),
  code: z.string().min(4).max(12).optional(),
});

export const ElementPatchSchema = z.object({
  added: z.array(z.any()).default([]),
  modified: z.array(z.any()).default([]),
  deleted: z.array(z.string()).default([]),
  baseVersion: z.number().int().nonnegative(),
});

export const CursorSchema = z.object({
  x: z.number(),
  y: z.number(),
  tool: z.string().default("pointer"),
  button: z.enum(["up", "down"]).default("up"),
});

export const PresenceSchema = z.object({
  selectedElementIds: z.record(z.string(), z.literal(true)).default({}),
  viewport: z
    .object({ scrollX: z.number(), scrollY: z.number(), zoom: z.number() })
    .nullable()
    .default(null),
});

export const ChatSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const LockSchema = z.object({ locked: z.boolean() });

export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type CreateRoomPayload = z.infer<typeof CreateRoomSchema>;
export type ElementPatchPayload = z.infer<typeof ElementPatchSchema>;
export type CursorPayload = z.infer<typeof CursorSchema>;
export type PresencePayload = z.infer<typeof PresenceSchema>;
export type ChatPayload = z.infer<typeof ChatSchema>;

export type ServerToClientEvents = {
  "room:created": (payload: { code: string; roomId: string }) => void;
  "room:joined": (payload: { code: string; roomId: string; role: "host" | "guest" }) => void;
  "room:init": (payload: {
    meta: RoomMetaLike;
    elements: ExcalidrawElement[];
    appState: Partial<AppState>;
    files: Record<string, BinaryFileData>;
    comments: Comment[];
    users: RoomUser[];
    version: number;
  }) => void;
  "room:changes": (payload: {
    added: ExcalidrawElement[];
    modified: ExcalidrawElement[];
    deleted: string[];
    version: number;
    sourceUserId: string;
  }) => void;
  "room:reconcile": (payload: {
    elements: ExcalidrawElement[];
    appState: Partial<AppState>;
    files: Record<string, BinaryFileData>;
    comments: Comment[];
    users: RoomUser[];
    version: number;
  }) => void;
  "room:cursor": (payload: { userId: string; username: string; color: string; cursor: CursorPayload }) => void;
  "room:presence": (payload: { userId: string; presence: PresencePayload }) => void;
  "room:user-joined": (payload: RoomUser) => void;
  "room:user-left": (payload: { userId: string }) => void;
  "room:chat": (payload: { userId: string; username: string; color: string; text: string; at: number }) => void;
  "room:locked": (payload: { locked: boolean }) => void;
  "room:error": (payload: { message: string; code?: string }) => void;
  "room:saved": (payload: { version: number; at: number }) => void;
};

export type ClientToServerEvents = {
  "room:create": (payload: CreateRoomPayload, ack?: (res: { ok: boolean; code?: string; roomId?: string; error?: string }) => void) => void;
  "room:join": (payload: JoinRoomPayload, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  "room:update": (payload: ElementPatchPayload) => void;
  "room:cursor": (payload: CursorPayload) => void;
  "room:presence": (payload: PresencePayload) => void;
  "room:chat": (payload: ChatPayload) => void;
  "room:lock": (payload: { locked: boolean }) => void;
  "room:leave": () => void;
};

export interface RoomMetaLike {
  code: string;
  id: string;
  name: string;
  hostId: string;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export const EVENT_NAMES = {
  create: "room:create",
  join: "room:join",
  update: "room:update",
  cursor: "room:cursor",
  presence: "room:presence",
  chat: "room:chat",
  lock: "room:lock",
  leave: "room:leave",
} as const;
