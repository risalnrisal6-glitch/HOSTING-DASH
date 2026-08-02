"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import useSWR from "swr";
import { Server as ServerIcon, Plus, Search, MoreHorizontal } from "lucide-react";
import { get } from "@/lib/api";
import { Card, EmptyState, StatusBadge, Button, Skeleton } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import type { Server } from "@/lib/types";
import { formatBytes, formatMB, timeAgo, cn } from "@/lib/format";

export default function ServersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useSWR<Server[]>(`/servers?search=${encodeURIComponent(search)}`, (url: string) => get(url), { refreshInterval: 15000 });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Your servers</h1>
          <p className="mt-1 text-sm text-slate-500">Manage all of your deployed servers.</p>
        </div>
        <Link href="/servers/new">
          <Button icon={<Plus className="h-4 w-4" />}>Deploy server</Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search servers..." className="input-base pl-9" />
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <Card>
          <EmptyState
            icon={<ServerIcon className="h-6 w-6" />}
            title={search ? "No servers match your search" : "You don't have any servers yet"}
            description={search ? "Try a different search term." : "Deploy a game server, bot or application in under a minute."}
            action={!search ? <Link href="/servers/new"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Deploy your first server</Button></Link> : undefined}
          />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((server, i) => {
          const limits = JSON.parse(server.limits);
          const features = JSON.parse(server.featureLimits);
          return (
            <motion.div key={server.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/servers/${server.uuid}`}>
                <Card className="glass-hover h-full p-5 transition-transform hover:-translate-y-1">
                  <div className="flex items-start justify-between">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", server.status === "RUNNING" ? "bg-emerald-500/15 text-emerald-400" : server.status === "SUSPENDED" ? "bg-rose-500/15 text-rose-400" : "bg-white/[0.06] text-slate-400")}>
                      <ServerIcon className="h-6 w-6" />
                    </div>
                    <StatusBadge status={server.status} />
                  </div>
                  <h3 className="mt-4 truncate font-display text-base font-bold text-slate-100">{server.name}</h3>
                  <p className="text-xs text-slate-500">{server.eggName || "Custom egg"} · {server.uuid}</p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="RAM" value={formatMB(limits.ram)} />
                    <MiniStat label="CPU" value={`${limits.cpu}%`} />
                    <MiniStat label="Disk" value={formatMB(limits.disk)} />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <div className="w-24 opacity-60">
                      <Sparkline data={[15, 22, 18, 30, 26, 38, 34, 44, 40, 52, 48, 58]} color={server.status === "RUNNING" ? "#34d399" : "#64748b"} height={32} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-600">Deployed</p>
                      <p className="text-xs text-slate-400">{timeAgo(server.createdAt)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] py-2">
      <p className="text-[9px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-300">{value}</p>
    </div>
  );
}
