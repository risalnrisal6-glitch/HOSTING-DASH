"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Server as ServerIcon, Play, Square, RotateCw, Skull, TerminalSquare, FolderOpen, Archive, Database, Network, Settings2, Gauge, Power,
} from "lucide-react";
import useSWR from "swr";
import { get, post } from "@/lib/api";
import type { Server, Usage } from "@/lib/types";
import { cn, formatBytes, formatMB } from "@/lib/format";
import { StatusBadge, Badge } from "@/components/ui";

const tabs = [
  { id: "", label: "Overview", icon: Gauge },
  { id: "/console", label: "Console", icon: TerminalSquare },
  { id: "/files", label: "Files", icon: FolderOpen },
  { id: "/backups", label: "Backups", icon: Archive },
  { id: "/databases", label: "Databases", icon: Database },
  { id: "/network", label: "Network", icon: Network },
  { id: "/settings", label: "Settings", icon: Settings2 },
];

export function ServerLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const uuid = params.id;

  const { data, mutate } = useSWR<{ server: Server; stats: Usage; allocations: any[]; sftp: any }>(`/servers/${uuid}`, (url: string) => get(url), { refreshInterval: 15000 });

  const server = data?.server;
  const stats = data?.stats;

  const power = async (signal: "start" | "stop" | "restart" | "kill") => {
    try {
      await post(`/servers/${uuid}/power`, { signal });
      toast.success(`Sent ${signal} signal`);
      setTimeout(() => mutate(), 800);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!server) {
    return (
      <div className="space-y-6">
        <div className="glass flex items-center gap-4 p-5">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="flex-1 space-y-2"><div className="h-5 w-40 animate-pulse rounded bg-white/[0.06]" /><div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" /></div>
        </div>
        <div className="glass h-80 animate-pulse" />
      </div>
    );
  }

  const currentTab = "/" + pathname.split("/").slice(3).join("/");
  const activeTab = tabs.find((t) => (t.id === "" ? currentTab === "" : currentTab.startsWith(t.id)))?.id ?? "";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="glass p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", server.status === "RUNNING" ? "bg-emerald-500/15 text-emerald-400" : server.status === "SUSPENDED" ? "bg-rose-500/15 text-rose-400" : "bg-white/[0.06] text-slate-300")}>
            <ServerIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-bold text-slate-100">{server.name}</h1>
              <StatusBadge status={server.status} />
              {server.billingCycle && <Badge color="blue">{server.billingCycle}</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {server.eggName || "Custom egg"} · {formatMB(JSON.parse(server.limits).ram)} RAM · {JSON.parse(server.limits).cpu}% CPU · {formatBytes(JSON.parse(server.limits).disk * 1024 * 1024)}
            </p>
          </div>

          {/* Power controls */}
          <div className="flex items-center gap-2">
            {server.status !== "SUSPENDED" && (
              <>
                <PowerButton onClick={() => power("start")} disabled={server.status === "RUNNING"} title="Start" icon={<Play className="h-4 w-4" />} color="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" />
                <PowerButton onClick={() => power("stop")} disabled={server.status !== "RUNNING"} title="Stop" icon={<Square className="h-4 w-4" />} color="bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" />
                <PowerButton onClick={() => power("restart")} disabled={server.status !== "RUNNING"} title="Restart" icon={<RotateCw className="h-4 w-4" />} color="bg-blue-500/15 text-blue-400 hover:bg-blue-500/25" />
                <PowerButton onClick={() => power("kill")} disabled={server.status !== "RUNNING"} title="Kill" icon={<Skull className="h-4 w-4" />} color="bg-rose-500/15 text-rose-400 hover:bg-rose-500/25" />
              </>
            )}
          </div>
        </div>

        {/* Resource chips */}
        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResourceChip label="CPU" value={`${stats.cpu.toFixed(1)}%`} pct={Math.min(100, stats.cpu)} color="bg-gradient-to-r from-cyan-500 to-blue-500" />
            <ResourceChip label="Memory" value={formatBytes(stats.memory_bytes)} pct={Math.min(100, (stats.memory_bytes / (JSON.parse(server.limits).ram * 1024 * 1024)) * 100)} color="bg-gradient-to-r from-violet-500 to-purple-500" />
            <ResourceChip label="Disk" value={formatBytes(stats.disk_bytes)} pct={Math.min(100, (stats.disk_bytes / (JSON.parse(server.limits).disk * 1024 * 1024)) * 100)} color="bg-gradient-to-r from-blue-500 to-indigo-500" />
            <ResourceChip label="Uptime" value={stats.uptime_seconds ? `${Math.floor(stats.uptime_seconds / 60)}m` : "—"} pct={0} color="" hide />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 scrollbar-thin">
        {tabs.map((t) => {
          const href = `/servers/${uuid}${t.id}`;
          const active = activeTab === t.id;
          return (
            <Link key={t.id} href={href} className={cn("relative flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition", active ? "text-white" : "text-slate-400 hover:text-slate-200")}>
              {active && <motion.span layoutId="server-tab" className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-600/80 to-blue-600/80" transition={{ type: "spring", damping: 30, stiffness: 350 }} />}
              <t.icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{t.label}</span>
            </Link>
          );
        })}
      </div>

      {children}
    </motion.div>
  );
}

function PowerButton({ onClick, disabled, title, icon, color }: { onClick: () => void; disabled: boolean; title: string; icon: ReactNode; color: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn("rounded-xl p-2.5 transition disabled:cursor-not-allowed disabled:opacity-30", color)}
    >
      {icon}
    </button>
  );
}

function ResourceChip({ label, value, pct, color, hide }: { label: string; value: string; pct: number; color: string; hide?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono text-xs font-semibold text-slate-200">{value}</span>
      </div>
      {!hide && <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"><div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

export function PowerIcon({ running }: { running: boolean }) {
  return <Power className={cn("h-4 w-4", running ? "text-emerald-400" : "text-slate-500")} />;
}
