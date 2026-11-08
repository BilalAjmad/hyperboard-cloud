import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { createServer as createHttpServer } from "node:http";
import os from "node:os";
import { registerSocketHandlers } from "./socketHandlers";
import { config } from "./config";
import { ensureRoomsDir } from "./persistence";

function lanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

async function main() {
  ensureRoomsDir(config.dataDir);
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins.includes("*") ? true : config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));

  app.get("/health", (_req, res) => res.json({ ok: true, time: Date.now() }));
  app.get("/api/info", (_req, res) => {
    res.json({ ip: lanIp(), port: config.port, mdns: config.enableMdns });
  });

  // Serve client build if present
  const path = await import("node:path");
  const fs = await import("node:fs");
  const candidates = [
    "H:\\excalidraw\\excalidraw-app\\build",
    path.resolve(process.cwd(), "..", "..", "packages", "client", "dist"),
  ];
  const distDir = candidates.find((d) => fs.existsSync(path.join(d, "index.html"))) ?? null;
  if (distDir) {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    app.use(express.static("public"));
  }

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins.includes("*") ? true : config.corsOrigins, credentials: true },
    maxHttpBufferSize: 10 * 1024 * 1024,
  });

  registerSocketHandlers(io);

  // Optional mDNS
  if (config.enableMdns) {
    try {
      const { Bonjour } = await import("bonjour-service");
      const bonjour = new Bonjour();
      bonjour.publish({ name: "LanBoard", type: "http", port: config.port, txt: { path: "/" } });
      // eslint-disable-next-line no-console
      console.log("mDNS published");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("mDNS unavailable", e);
    }
  }

  httpServer.listen(config.port, "0.0.0.0", () => {
    const ip = lanIp();
    // eslint-disable-next-line no-console
    console.log("");
    console.log("  HyperBoard server running");
    console.log(`  Local:   http://localhost:${config.port}`);
    console.log(`  LAN:     http://${ip}:${config.port}`);
    console.log(`  Health:  http://${ip}:${config.port}/health`);
    console.log("");
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
