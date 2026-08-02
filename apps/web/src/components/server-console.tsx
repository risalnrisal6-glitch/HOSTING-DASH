"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Square, RotateCw, Skull, Terminal, Trash2, Pause } from "lucide-react";
import { post } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/format";
import { Button } from "@/components/ui";

interface LogLine {
  id: number;
  text: string;
  kind: "output" | "system" | "command" | "status";
}

const MAX_LINES = 500;

export function ServerConsole({ uuid, status }: { uuid: string; status: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [command, setCommand] = useState("");
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const bufferRef = useRef<LogLine[]>([]);

  const append = useCallback((line: LogLine) => {
    bufferRef.current = [...bufferRef.current.slice(-MAX_LINES), line];
    if (!paused) setLines(bufferRef.current);
  }, [paused]);

  useEffect(() => {
    setLines([]);
    bufferRef.current = [];
    setPaused(false);
    const es = new EventSource(`/api/servers/${uuid}/console/stream`);
    setConnected(true);

    const onEvent = (event: string, payload: any) => {
      if (event === "output") append({ id: ++idRef.current, text: payload.line, kind: "output" });
      else if (event === "status") append({ id: ++idRef.current, text: `● server state: ${payload.state}`, kind: "status" });
      else if (event === "notice") append({ id: ++idRef.current, text: payload.message, kind: "system" });
    };

    es.addEventListener("output", (e) => onEvent("output", JSON.parse((e as MessageEvent).data)));
    es.addEventListener("status", (e) => onEvent("status", JSON.parse((e as MessageEvent).data)));
    es.addEventListener("notice", (e) => onEvent("notice", JSON.parse((e as MessageEvent).data)));
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [uuid, append]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cmd = command.trim();
    if (!cmd) return;
    append({ id: ++idRef.current, text: `> ${cmd}`, kind: "command" });
    setCommand("");
    try {
      await post(`/servers/${uuid}/command`, { command: cmd });
    } catch (err: any) {
      append({ id: ++idRef.current, text: `[error] ${err.message}`, kind: "system" });
    }
  };

  const power = async (signal: string) => {
    try {
      await post(`/servers/${uuid}/power`, { signal });
      append({ id: ++idRef.current, text: `[system] ${signal} signal sent`, kind: "system" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="glass overflow-hidden">
      {/* Console toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", connected ? "bg-emerald-400" : "bg-rose-400")} />
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-rose-500")} />
          </span>
          <span className="text-xs font-medium text-slate-400">{connected ? "Live" : "Disconnected — reconnecting..."}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setPaused(!paused)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.08]" title={paused ? "Resume" : "Pause"}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button onClick={() => { setLines([]); bufferRef.current = []; }} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.08]" title="Clear console">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Log output */}
      <div className="console-wrap h-[420px] overflow-y-auto bg-[#04050c] p-4 text-[12.5px] leading-relaxed scrollbar-thin">
        {lines.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-600">
            <Terminal className="h-8 w-8" />
            <p className="text-sm">Console output will appear here</p>
            {status !== "RUNNING" && <p className="text-xs">Start the server to see live logs</p>}
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={cn("whitespace-pre-wrap break-all", l.kind === "output" && "text-slate-300", l.kind === "command" && "font-semibold text-violet-300", l.kind === "status" && "text-emerald-400", l.kind === "system" && "text-amber-400")}>
            {l.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Power + input */}
      <div className="border-t border-white/[0.06] p-3">
        <form onSubmit={send} className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <ConsoleBtn onClick={() => power("start")} disabled={status === "RUNNING"} title="Start" icon={<Play className="h-4 w-4" />} className="text-emerald-400 hover:bg-emerald-500/15" />
            <ConsoleBtn onClick={() => power("stop")} disabled={status !== "RUNNING"} title="Stop" icon={<Square className="h-4 w-4" />} className="text-amber-400 hover:bg-amber-500/15" />
            <ConsoleBtn onClick={() => power("restart")} disabled={status !== "RUNNING"} title="Restart" icon={<RotateCw className="h-4 w-4" />} className="text-blue-400 hover:bg-blue-500/15" />
            <ConsoleBtn onClick={() => power("kill")} disabled={status !== "RUNNING"} title="Kill" icon={<Skull className="h-4 w-4" />} className="text-rose-400 hover:bg-rose-500/15" />
          </div>
          <div className="relative min-w-[180px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-violet-400">$</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Type a command..."
              className="input-base font-mono pl-8"
              autoComplete="off"
            />
          </div>
          <Button type="submit" size="md" icon={<Terminal className="h-4 w-4" />}>Send</Button>
        </form>
      </div>
    </div>
  );
}

function ConsoleBtn({ onClick, disabled, title, icon, className }: { onClick: () => void; disabled: boolean; title: string; icon: React.ReactNode; className: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={cn("rounded-lg p-2 text-slate-500 transition disabled:opacity-30", className)}>
      {icon}
    </button>
  );
}
