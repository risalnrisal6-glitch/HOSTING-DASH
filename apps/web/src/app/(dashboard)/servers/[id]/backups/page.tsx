"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Archive, Plus, Download, RotateCcw, Trash2, Lock, Unlock } from "lucide-react";
import { get, post, del } from "@/lib/api";
import { ServerLayout } from "@/components/server-layout";
import { Card, Button, EmptyState, ConfirmDialog, Badge } from "@/components/ui";
import type { Backup } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/format";

export default function BackupsPage() {
  const params = useParams<{ id: string }>();
  const uuid = params.id;
  const { data, mutate, isLoading } = useSWR<Backup[]>(`/servers/${uuid}/backups`, (url: string) => get(url));
  const [confirm, setConfirm] = useState<{ type: "restore" | "delete"; id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    try {
      await post(`/servers/${uuid}/backups`, {});
      toast.success("Backup created");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const download = async (id: string) => {
    window.location.href = `/api/servers/${uuid}/backups/${id}/download`;
  };

  const run = async (type: "restore" | "delete") => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (type === "restore") {
        await post(`/servers/${uuid}/backups/${confirm.id}/restore`, {});
        toast.success("Backup restored");
      } else {
        await del(`/servers/${uuid}/backups/${confirm.id}`);
        toast.success("Backup deleted");
      }
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const featureLimits = useServerLimits(uuid);

  return (
    <ServerLayout>
      <Card
        title="Backups"
        subtitle={`${data?.length ?? 0} / ${featureLimits?.backups ?? "—"} backup slots used`}
        actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={create}>Create backup</Button>}
      >
        {isLoading && <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>}
        {!isLoading && (!data || data.length === 0) && (
          <EmptyState icon={<Archive className="h-6 w-6" />} title="No backups yet" description="Create your first backup to protect your server files." />
        )}
        <div className="space-y-2.5">
          {data?.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-violet-400/25">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                {b.locked ? <Lock className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-200">{b.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(b.size)} · {formatDate(b.createdAt)}</p>
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => download(b.id)} icon={<Download className="h-3.5 w-3.5" />}>Download</Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirm({ type: "restore", id: b.id, name: b.name })} icon={<RotateCcw className="h-3.5 w-3.5" />}>Restore</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: "delete", id: b.id, name: b.name })} icon={<Trash2 className="h-3.5 w-3.5 text-rose-400" />} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(confirm?.type as "restore" | "delete")}
        loading={busy}
        danger={confirm?.type === "delete"}
        title={confirm?.type === "restore" ? "Restore this backup?" : "Delete this backup?"}
        description={confirm?.type === "restore" ? `Restoring "${confirm?.name}" will overwrite all current server files.` : `This will permanently delete "${confirm?.name}".`}
        confirmText={confirm?.type === "restore" ? "Restore" : "Delete"}
      />
    </ServerLayout>
  );
}

function useServerLimits(uuid: string) {
  const { data } = useSWR(`/servers/${uuid}`, (url: string) => get(url));
  const server = (data as any)?.server;
  return server ? JSON.parse(server.featureLimits) : null;
}
