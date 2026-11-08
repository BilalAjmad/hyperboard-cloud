import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { RoomState } from "@hyperboard/shared";

const ALG = "aes-256-gcm";

function getKey(): Buffer | null {
  const s = process.env.ROOM_SECRET;
  if (!s) return null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  return crypto.scryptSync(s, "lanboard-salt", 32);
}

export function roomsDir(dataDir: string): string {
  return path.resolve(dataDir, "rooms");
}

export function ensureRoomsDir(dataDir: string): void {
  const d = roomsDir(dataDir);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

export function roomFilePath(dataDir: string, code: string): string {
  return path.join(roomsDir(dataDir), `${code}.json`);
}

function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ enc: true, iv: iv.toString("base64"), tag: tag.toString("base64"), data: ct.toString("base64") });
}

function decrypt(raw: string): string {
  const key = getKey();
  if (!key) return raw;
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  if (!parsed || !parsed.enc) return raw;
  const iv = Buffer.from(parsed.iv, "base64");
  const tag = Buffer.from(parsed.tag, "base64");
  const data = Buffer.from(parsed.data, "base64");
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
}

export function loadRoom(dataDir: string, code: string): RoomState | null {
  const fp = roomFilePath(dataDir, code);
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const text = decrypt(raw);
    return JSON.parse(text) as RoomState;
  } catch {
    return null;
  }
}

export function saveRoomSync(dataDir: string, state: RoomState): void {
  ensureRoomsDir(dataDir);
  const fp = roomFilePath(dataDir, codeOf(state));
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, encrypt(JSON.stringify(state)), "utf8");
  fs.renameSync(tmp, fp);
}

function codeOf(state: RoomState): string {
  return state.meta.code;
}

export function listRoomCodes(dataDir: string): string[] {
  ensureRoomsDir(dataDir);
  return fs
    .readdirSync(roomsDir(dataDir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function deleteRoom(dataDir: string, code: string): void {
  const fp = roomFilePath(dataDir, code);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}
