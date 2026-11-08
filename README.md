# HyperBoard

Realtime collaborative whiteboard. Create a room, get a code, share the code — anyone from anywhere opens the website and joins. No same-WiFi needed. Cloud-ready, encrypted, realtime sync.

## What it is

- Draw together in real time: rectangles, ellipses, diamonds, arrows, lines, freehand, text.
- Styling: colors, stroke width, fill styles, roughness, opacity, themes.
- Live cursors with names, presence, undo/redo, zoom/pan.
- Rooms protected by a 6-character code (acts as password). Host can lock.
- Persists boards (encrypted at rest with `ROOM_SECRET`).
- Export/import, multi-user, no login required.

## How it works

1. You open the website → enter a room name → **Create room** → get a 6-char code.
2. You share the code with friends/employees.
3. They open the same website → enter the code → **Join room**.
4. Everyone draws together in real time. Strokes sync in ~50ms.

The server is the authority (conflict resolution + persistence). Clients send only changed elements (diffs) for ultra-lightweight sync. Transport is HTTPS/WSS in cloud (encrypted). At-rest data encrypted with AES-256-GCM when `ROOM_SECRET` is set.

## Install (self-host / local)

Requirements: Node.js 20+, pnpm 9+.

```bash
git clone <this-repo> hyperboard
cd hyperboard
pnpm install
pnpm dev
```

- Client: http://localhost:5173
- Server: http://localhost:3000 (LAN: http://<your-ip>:3000)

### Desktop shortcut (Windows)

After install, run once:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

A **HyperBoard** shortcut appears on your Desktop. Double-click to start.

## Cloud deploy (free, realtime, ads-allowed)

Best free 24/7 option: **Oracle Cloud Always Free** (2 ARM VMs, 4 OCPU, 24GB RAM, forever free).

1. Create an Always Free ARM VM (Ubuntu), open port 3000 in the firewall.
2. Install Node + pnpm, clone repo, `pnpm install`, `pnpm --filter @hyperboard/client build`.
3. Set env: `ROOM_SECRET=<32-char-secret>`, `CORS_ORIGINS=*`, `DATA_DIR=/home/ubuntu/data`.
4. Run: `pm2 start "npx tsx packages/server/src/index.ts" --name hyperboard`.
5. Frontend (optional, for unlimited bandwidth): deploy `packages/client/dist` to **Cloudflare Pages**, set `VITE_SERVER_URL=http://<vm-ip>:3000` at build.

Simpler (sleeps after idle): **Render** or **Koyeb** — Git deploy, WS supported, free tier, commercial/ads OK.

### Ads

Uncomment the AdSense script in `packages/client/index.html`, replace `ca-pub-XXXX` with your publisher ID, add `<ins class="adsbygoogle">` slots, rebuild + redeploy.

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| PORT | 3000 | Server port |
| DATA_DIR | ../../data | Persistence dir |
| ROOM_SECRET | (none) | AES-256-GCM key for at-rest encryption (32-byte hex or passphrase) |
| CORS_ORIGINS | * | Allowed origins |
| SAVE_DEBOUNCE_MS | 100 | Debounce for disk writes |
| MAX_USERS_PER_ROOM | 0 | 0 = unlimited |
| ENABLE_MDNS | false | LAN discovery |

## Commands

- `pnpm dev` — run client + server
- `pnpm typecheck` — typecheck all packages
- `pnpm build` — build client
- `pnpm start` — run server (serves built client)

## Security

- Room code = access secret (6 chars, ~1B combos).
- Host can lock room (read-only for guests).
- Optional password per room.
- At-rest encryption with `ROOM_SECRET`.
- Transport encryption via HTTPS/WSS in cloud.
- No accounts, no tracking, no personal data stored.

## License

MIT
