import React, { useState, useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useBoard } from "./store";
import { createRoom, joinRoom, queueUpdate } from "./sync";
import { newId } from "@hyperboard/shared";

type View = "home" | "board";

export default function App() {
  const [view, setView] = useState<View>("home");
  const board = useBoard();
  const [name] = useState(() => "Guest");
  const [color] = useState(() => "#1a1a1a");
  const [code, setCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [err, setErr] = useState("");

  // Auto-join if ?room= in URL (shared link)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room");
    if (r) {
      setCode(r);
      const uid = localStorage.getItem("lanboard:uid") ?? newId();
      localStorage.setItem("lanboard:uid", uid);
      const user = { id: uid, name, color };
      (useBoard as any).setState({ user });
      joinRoom(r.trim().toUpperCase(), user).then((res) => {
        if (res.ok) {
          useBoard.getState().setRoom(r.trim().toUpperCase(), "", "guest");
          setView("board");
        } else {
          setErr(res.error ?? "Failed");
        }
      });
    }
  }, []);
  const handleCreate = async () => {
    if (!roomName.trim()) {
      setErr("Enter room name");
      return;
    }
    setErr("");
    const uid = localStorage.getItem("lanboard:uid") ?? newId();
    localStorage.setItem("lanboard:uid", uid);
    const user = { id: uid, name, color };
    (useBoard as any).setState({ user });
    const res = await createRoom(roomName.trim(), user);
    if (!res.ok || !res.code) { setErr(res.error ?? "Failed"); return; }
    useBoard.getState().setRoom(res.code, res.roomId!, "host");
    window.history.replaceState(null, "", `?room=${res.code}`);
    setView("board");
  };

  const handleJoin = async () => {
    if (!code.trim()) {
      setErr("Enter room code");
      return;
    }
    setErr("");
    const uid = localStorage.getItem("lanboard:uid") ?? newId();
    localStorage.setItem("lanboard:uid", uid);
    const user = { id: uid, name, color };
    (useBoard as any).setState({ user });
    const res = await joinRoom(code.trim().toUpperCase(), user);
    if (!res.ok) { setErr(res.error ?? "Failed"); return; }
    useBoard.getState().setRoom(code.trim().toUpperCase(), "", "guest");
    window.history.replaceState(null, "", `?room=${code.trim().toUpperCase()}`);
    setView("board");
  };

  if (view === "home") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="w-full max-w-sm px-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm text-neutral-700">Room name</label>
              <input
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                placeholder="Enter room name"
                value={roomName}
                onChange={(e) => { setRoomName(e.target.value); setErr(""); }}
                autoComplete="off"
              />
              <button
                onClick={handleCreate}
                className="w-full bg-neutral-900 text-white rounded-md py-2 text-sm font-medium hover:bg-neutral-800 active:bg-neutral-950 transition-colors"
              >
                Create room
              </button>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-neutral-700">Room code</label>
              <input
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:border-neutral-400 transition-colors"
                placeholder="Enter room code"
                value={code}
                onChange={(e) => { setCode(e.target.value); setErr(""); }}
                autoComplete="off"
                maxLength={8}
              />
              <button
                onClick={handleJoin}
                className="w-full border border-neutral-200 text-neutral-900 rounded-md py-2 text-sm font-medium hover:bg-neutral-50 active:bg-neutral-100 transition-colors"
              >
                Join room
              </button>
            </div>
            {err && <div className="text-sm text-red-600">{err}</div>}
          </div>
        </div>
      </div>
    );
  }

  return <Board />;
}

function Board() {
  const board = useBoard();
  const apiRef = useRef<any>(null);
  const applyingRemote = useRef(false);
  const lastVersion = useRef(0);
  const [count, setCount] = useState(0);

  const lastSentRef = useRef<Map<string, string>>(new Map());

  const onExcalidrawChange = useCallback((elements: any, appState: any, files: any) => {
    if (applyingRemote.current) return;
    setCount(elements.filter((e: any) => !e.isDeleted).length);
    const current = elements.filter((e: any) => !e.isDeleted);
    const currentIds = new Set(current.map((e: any) => e.id));
    const added: any[] = [];
    const modified: any[] = [];
    const deleted: string[] = [];
    for (const el of current) {
      const key = JSON.stringify(el);
      const prev = lastSentRef.current.get(el.id);
      if (prev === undefined) added.push(el);
      else if (prev !== key) modified.push(el);
    }
    for (const id of lastSentRef.current.keys()) {
      if (!currentIds.has(id)) deleted.push(id);
    }
    // update lastSent
    const next = new Map<string, string>();
    for (const el of current) next.set(el.id, JSON.stringify(el));
    lastSentRef.current = next;
    if (added.length === 0 && modified.length === 0 && deleted.length === 0) return;
    queueUpdate({ added, modified, deleted, baseVersion: lastVersion.current });
  }, []);

  React.useEffect(() => {
    const clean = () => {
      document.querySelectorAll("*").forEach((el) => {
        const t = (el.textContent || "").toLowerCase();
        const h = (el as any).href || (el as any).getAttribute?.("href") || "";
        const cls = (el as HTMLElement).className?.toString?.().toLowerCase() || "";
        if (h.includes("discord") || h.includes("excalidraw") || h.includes("github.com/excalidraw")) {
          (el as HTMLElement).style.display = "none";
          return;
        }
        if ((t === "discord chat" || t === "excalidraw" || t.includes("made with excalidraw")) && el.children.length === 0) {
          (el as HTMLElement).style.display = "none";
        }
      });
    };
    clean();
    const obs = new MutationObserver(clean);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    const handleInit = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      applyingRemote.current = true;
      const api = apiRef.current;
      if (api) {
        api.updateScene({ elements: detail.elements, appState: detail.appState, files: detail.files });
        setCount((detail.elements ?? []).filter((e: any) => !e.isDeleted).length);
        // sync lastSent
        const m = new Map<string, string>();
        for (const el of (detail.elements ?? []).filter((e: any) => !e.isDeleted)) m.set(el.id, JSON.stringify(el));
        lastSentRef.current = m;
      }
      lastVersion.current = detail.version;
      applyingRemote.current = false;
    };
    const handleDelta = (e: any) => {
      const p = e.detail;
      if (!p) return;
      const api = apiRef.current;
      // Update version for sender without touching canvas (avoid reconcile spam)
      if (p.sourceUserId && p.sourceUserId === useBoard.getState().user?.id) {
        lastVersion.current = p.version;
        return;
      }
      if (!api) return;
      applyingRemote.current = true;
      const current = api.getSceneElements();
      const map = new Map(current.map((el: any) => [el.id, el]));
      for (const el of p.added ?? []) map.set(el.id, el);
      for (const el of p.modified ?? []) {
        const prev = map.get(el.id);
        map.set(el.id, prev ? { ...prev, ...el } : el);
      }
      for (const id of p.deleted ?? []) {
        const el = map.get(id);
        if (el) map.set(id, { ...el, isDeleted: true });
      }
      const next = Array.from(map.values()).filter((el: any) => !el.isDeleted);
      api.updateScene({ elements: next });
      setCount(next.length);
      lastVersion.current = p.version;
      // sync lastSent
      const m = new Map<string, string>();
      for (const el of next) m.set((el as any).id, JSON.stringify(el));
      lastSentRef.current = m;
      applyingRemote.current = false;
    };
    window.addEventListener("lanboard:remote", handleInit);
    window.addEventListener("lanboard:remote-delta", handleDelta);
    return () => {
      window.removeEventListener("lanboard:remote", handleInit);
      window.removeEventListener("lanboard:remote-delta", handleDelta);
    };
  }, []);
  React.useEffect(() => {
    const tryLoad = () => {
      const api = apiRef.current;
      const els = useBoard.getState().elements;
      if (api && els && els.length > 0) {
        api.updateScene({ elements: els, appState: useBoard.getState().appState });
      }
    };
    tryLoad();
    const t = setInterval(tryLoad, 200);
    const stop = setTimeout(() => clearInterval(t), 4000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, []);

  return (
    <div className="w-full h-full relative">
      <Excalidraw
        excalidrawAPI={(api: any) => { apiRef.current = api; (window as any).excalidrawAPI = api; }}
        initialData={{ elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} }}
        onChange={onExcalidrawChange}
        name=""
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: false,
          },
        }}
      />
      <div className="absolute top-2 right-2 z-50 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 border border-neutral-200 px-2 py-1 rounded-md shadow-sm text-xs flex items-center gap-2">
          <span className="font-mono tracking-widest">{board.roomCode}</span>
          <span className="text-neutral-500">· {board.users.length} online</span>
        </div>
      </div>
    </div>
  );
}
