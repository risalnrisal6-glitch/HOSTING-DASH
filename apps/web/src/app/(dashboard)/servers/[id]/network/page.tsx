"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Network, Plus, Star, Trash2, Globe } from "lucide-react";
import { get, post, del } from "@/lib/api";
import { ServerLayout } from "@/components/server-layout";
import { Card, Button, EmptyState, ConfirmDialog, Badge } from "@/components/ui";
import type { Allocation } from "@/lib/types";
import { cn } from "@/lib/format";

export default function NetworkPage() {
  const params = useParams<{ id: string }>();
  const uuid = params.id;
  const { data, mutate, isLoading } = useSWR<Allocation[]>(`/servers/${uuid}/network`, (url: string) => get(url));
  const [confirm, setConfirm] = useState<{ id: string; ip: string; port: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    try {
      await post(`/servers/${uuid}/network`, {});
      toast.success("Allocation created");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const setPrimary = async (id: string) => {
    try {
      await post(`/servers/${uuid}/network/${id}/primary`, {});
      toast.success("Primary allocation updated");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await del(`/servers/${uuid}/network/${confirm.id}`);
      toast.success("Allocation removed");
      setConfirm(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ServerLayout>
      <Card
        title="Network"
        subtitle="Manage your server's IP allocations and ports"
        actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={create}>New allocation</Button>}
      >
        {isLoading && <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>}
        {!isLoading && (!data || data.length === 0) && (
          <EmptyState icon={<Globe className="h-6 w-6" />} title="No allocations" description="Create an allocation to give your server a network port." />
        )}
        <div className="space-y-2.5">
          {data?.map((a) => (
            <div key={a.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-4 transition", a.isPrimary ? "border-violet-400/30 bg-violet-500/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-violet-400/25")}>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", a.isPrimary ? "bg-violet-500/20 text-violet-300" : "bg-blue-500/15 text-blue-300")}>
                <Network className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold text-slate-200">{a.ip}:{a.port}</p>
                <p className="text-xs text-slate-500">Node {a.nodeId || "—"}</p>
              </div>
              {a.isPrimary && <Badge color="violet">Primary</Badge>}
              <div className="flex gap-1.5">
                {!a.isPrimary && (
                  <Button variant="secondary" size="sm" onClick={() => setPrimary(a.id)} icon={<Star className="h-3.5 w-3.5" />}>Make primary</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setConfirm({ id: a.id, ip: a.ip, port: a.port })} icon={<Trash2 className="h-3.5 w-3.5 text-rose-400" />} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={doDelete} loading={busy} danger title="Remove allocation?" description={`Remove ${confirm?.ip}:${confirm?.port} from this server?`} confirmText="Remove" />
    </ServerLayout>
  );
}
