"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Egg, Layers, Server as ServerIcon, Globe, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, Badge, Input, Tabs } from "@/components/ui";
import { cn } from "@/lib/format";

export default function AdminPanelPage() {
  const { data, mutate, isLoading } = useSWR<{ nests: any[]; nodes: any[]; locations: any[]; connected: boolean }>("/admin/panel", (url: string) => get(url));
  const [tab, setTab] = useState("nests");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("");

  const sync = async () => {
    setSyncing(true);
    try {
      await post("/admin/panel/sync", {});
      toast.success("Panel data re-synced");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tabs = [
    { id: "nests", label: `Nests & Eggs (${data?.nests?.length ?? 0})` },
    { id: "nodes", label: `Nodes (${data?.nodes?.length ?? 0})` },
    { id: "locations", label: `Locations (${data?.locations?.length ?? 0})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {data?.connected ? (
            <Badge color="green"><CheckCircle2 className="mr-1 h-3 w-3" />Panel connected</Badge>
          ) : (
            <Badge color="amber"><XCircle className="mr-1 h-3 w-3" />Demo mode</Badge>
          )}
          <p className="text-xs text-slate-500">Data is fetched live from the Application API — never hardcoded.</p>
        </div>
        <Button size="sm" onClick={sync} loading={syncing} icon={<RefreshCw className="h-3.5 w-3.5" />}>Force re-sync</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="relative">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter..." className="input-base !w-48 !py-1.5 text-xs" />
        </div>
      </div>

      {isLoading && <Card><div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />)}</div></Card>}

      {tab === "nests" && (
        <Card bodyClassName="p-0">
          <div className="divide-y divide-white/[0.04]">
            {data?.nests
              ?.filter((n: any) => n.name.toLowerCase().includes(filter.toLowerCase()))
              .map((nest: any) => {
                const eggs = nest.eggs || [];
                const isOpen = expanded.has(String(nest.id));
                return (
                  <div key={nest.id}>
                    <button onClick={() => toggle(String(nest.id))} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300"><Layers className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-200">{nest.name}</p>
                        <p className="truncate text-xs text-slate-500">{nest.description}</p>
                      </div>
                      <Badge color="blue">{eggs.length} eggs</Badge>
                    </button>
                    {isOpen && (
                      <div className="grid gap-2 px-5 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                        {eggs.map((e: any) => (
                          <div key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            <div className="flex items-center gap-2">
                              <Egg className="h-3.5 w-3.5 text-amber-300" />
                              <p className="truncate text-xs font-semibold text-slate-200">{e.name}</p>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{e.description}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge color="slate">{e.docker_images?.length || 0} images</Badge>
                              <Badge color="slate">{e.variables?.filter((v: any) => v.user_viewable).length || 0} variables</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            {!data?.nests?.length && <p className="p-10 text-center text-sm text-slate-500">No nests found — connect a panel or check the API key.</p>}
          </div>
        </Card>
      )}

      {tab === "nodes" && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.nodes
              ?.filter((n: any) => n.name.toLowerCase().includes(filter.toLowerCase()))
              .map((n: any) => (
                <div key={n.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300"><ServerIcon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-200">{n.name}</p>
                      <p className="text-xs text-slate-500">{n.ip}</p>
                    </div>
                    {n.maintenance_mode ? <Badge color="amber">Maintenance</Badge> : <Badge color="green">Online</Badge>}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span>RAM: {(n.ram / 1024).toFixed(0)} GB</span>
                    <span>Disk: {(n.disk / 1024).toFixed(0)} GB</span>
                    <span>Allocs: {n.allocated}/{n.free + n.allocated}</span>
                    <span>Loc: {n.location_id}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {tab === "locations" && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.locations
              ?.filter((l: any) => (l.long || l.short).toLowerCase().includes(filter.toLowerCase()))
              .map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"><Globe className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{l.long || l.short}</p>
                    <p className="text-xs text-slate-500">ID: {l.id} · {l.short}</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
