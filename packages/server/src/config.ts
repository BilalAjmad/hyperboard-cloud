import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataDir: process.env.DATA_DIR ?? "../../data",
  corsOrigins: (process.env.CORS_ORIGINS ?? "*").split(",").map((s) => s.trim()),
  roomTtlDays: Number(process.env.ROOM_TTL_DAYS ?? 30),
  maxUsersPerRoom: Number(process.env.MAX_USERS_PER_ROOM ?? 0), // 0 = unlimited
  enableMdns: process.env.ENABLE_MDNS === "true",
  saveDebounceMs: Number(process.env.SAVE_DEBOUNCE_MS ?? 100),
};
