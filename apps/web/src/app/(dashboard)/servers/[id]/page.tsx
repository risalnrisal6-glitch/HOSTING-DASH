"use client";

import Link from "next/link";
import useSWR from "swr";
import { TerminalSquare, FolderOpen, Archive, Database, Network, Settings2, KeyRound, FileDown, ExternalLink, Trash2 } from "lucide-react";
import { get, del } from "@/lib/api";
import { ServerLayout } from "@/components/server-layout";
import { Card, Button, Badge, ConfirmDialog, EmptyState } from "@/components/ui";
import { LineChart, Donut } from "@/components/charts";
import type { Server, Usage } from "@/lib/types";
import { formatBytes, formatUptime, formatDate, cn } from "@/lib/format";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ServerOverviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const uuid = params.id;
  const { data, mutate } = useSWR<{ server: Server; stats: Usage; allocations: any[]; sftp: any }>(`/servers/${uuid}`, (url: string) => get(url), { refreshInterval: 20000 });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const server = data?.server;
  const stats = data?.stats;
  const limits = server ? JSON.parse(server.limits) : null;
  const features = server ? JSON.parse(server.featureLimits) : null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await del(`/servers/${uuid}`);
      toast.success("Server deleted");
      router.push("/servers");
    } catch (e: any) {
      toast.error(e.message);
      setDeleting(false);
    }
  };

  if (!data || !server) return <ServerLayout><div className="glass h-96 animate-pulse" /></ServerLayout>;

  const memPct = limits && stats ? (stats.memory_bytes / (limits.ram * 1024 * 1024)) * 100 : 0;
  const diskPct = limits && stats ? (stats.disk_bytes / (limits.disk * 1024 * 1024)) * 100 : 0;

  const quickLinks = [
    { href: `/servers/${uuid}/console`, icon: TerminalSquare, label: "Console", desc: "Live logs & commands" },
    { href: `/servers/${uuid}/files`, icon: FolderOpen, label: "File Manager", desc: "Upload, edit & manage files" },
    { href: `/servers/${uuid}/backups`, icon: Archive, label: "Backups", desc: `${features?.backups ?? 0} slots available` },
    { href: `/servers/${uuid}/databases`, icon: Database, label: "Databases", desc: `${features?.databases ?? 0} allowed` },
    { href: `/servers/${uuid}/network`, icon: Network, label: "Network", desc: `${data.allocations?.length ?? 0} allocations` },
    { href: `/servers/${uuid}/settings`, icon: Settings2, label: "Settings", desc: "Startup, rename & more" },
  ];

  return (
    <ServerLayout>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Usage charts */}
        <Card title="Resource usage" subtitle="Live from panel" className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-4">
              <Legend color="#34d399" label={`CPU ${stats?.cpu.toFixed(1) ?? 0}%`} />
              <Legend color="#8b5cf6" label={`RAM ${formatBytes(stats?.memory_bytes || 0)}`} />
              <Legend color="#3b82f6" label={`Disk ${formatBytes(stats?.disk_bytes || 0)}`} />
            </div>
            <Badge color={stats?.state === "running" ? "green" : "slate"} dot>{stats?.state || "unknown"}</Badge>
          </div>
          <UsageVisualizer memPct={memPct} diskPct={diskPct} cpu={stats?.cpu || 0} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Uptime" value={formatUptime(stats?.uptime_seconds || 0)} />
            <Detail label="Network RX" value={formatBytes(stats?.network_rx_bytes || 0)} />
            <Detail label="Network TX" value={formatBytes(stats?.network_tx_bytes || 0)} />
            <Detail label="Last started" value={server.lastStartAt ? formatDate(server.lastStartAt) : "—"} />
          </div>
        </Card>

        {/* Server info */}
        <Card title="Server details" subtitle="Overview">
          <div className="space-y-3 text-sm">
            <InfoRow label="Identifier" value={server.uuid} mono />
            <InfoRow label="Egg" value={server.eggName || "Custom"} />
            <InfoRow label="Docker image" value={server.dockerImage || "—"} mono small />
            <InfoRow label="Billing cycle" value={server.billingCycle ? server.billingCycle.charAt(0).toUpperCase() + server.billingCycle.slice(1) : "Custom"} />
            {server.renewsAt && <InfoRow label="Renews on" value={formatDate(server.renewsAt)} />}
            <InfoRow label="Deployed" value={formatDate(server.createdAt)} />
            {data.sftp && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400"><KeyRound className="h-3.5 w-3.5" /> SFTP access</p>
                <p className="font-mono text-xs text-slate-300">{data.sftp.username}@{data.sftp.ip}:{data.sftp.port}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="danger" size="sm" className="flex-1" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" />}>Delete server</Button>
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {quickLinks.map((q) => (
          <Link key={q.href} href={q.href} className="glass glass-hover group p-4">
            <q.icon className="h-5 w-5 text-violet-300" />
            <p className="mt-2.5 text-sm font-semibold text-slate-200 group-hover:text-white">{q.label}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{q.desc}</p>
          </Link>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        danger
        title="Delete server?"
        description={`This will permanently delete "${server?.name}" and all its files. This action cannot be undone.`}
        confirmText="Delete permanently"
      />
    </ServerLayout>
  );
}

function UsageVisualizer({ cpu, memPct, diskPct }: { cpu: number; memPct: number; diskPct: number }) {
  const donutData = [Math.min(100, cpu), Math.min(100, memPct), Math.min(100, diskPct)];
  const labels = ["CPU", "RAM", "Disk"];
  const colors = ["#34d399", "#8b5cf6", "#3b82f6"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <Donut values={donutData} labels={labels} colors={colors} centerLabel={`${Math.round((cpu + memPct + diskPct) / 3)}%`} />
      <div className="space-y-2.5">
        {labels.map((l, i) => (
          <div key={l} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />
            <span className="w-10 text-slate-400">{l}</span>
            <span className="font-mono font-semibold text-slate-200">{Math.round(donutData[i])}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 font-mono text-xs font-semibold text-slate-300">{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span className={cn("truncate text-right text-xs font-medium text-slate-300", mono && "font-mono", small && "max-w-[60%]")}>{value}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}
