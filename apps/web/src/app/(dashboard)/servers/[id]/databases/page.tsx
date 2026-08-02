"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Database, Plus, KeyRound, Trash2, Copy, Check } from "lucide-react";
import { get, post, del } from "@/lib/api";
import { ServerLayout } from "@/components/server-layout";
import { Card, Button, Modal, Input, EmptyState, ConfirmDialog, Badge } from "@/components/ui";
import type { DatabaseEntry, SftpInfo } from "@/lib/types";

export default function DatabasesPage() {
  const params = useParams<{ id: string }>();
  const uuid = params.id;
  const { data, mutate, isLoading } = useSWR<{ rows: DatabaseEntry[]; sftp: SftpInfo }>(`/servers/${uuid}/databases`, (url: string) => get(url));
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [remote, setRemote] = useState("%");
  const [creating, setCreating] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState("");

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1200);
  };

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await post(`/servers/${uuid}/databases`, { database: name.trim(), remote });
      toast.success("Database created");
      setOpenCreate(false);
      setName("");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async (id: string, name: string) => {
    try {
      const result = await post<{ password?: string }>(`/servers/${uuid}/databases/${id}/reset-password`, {});
      toast.success("Password reset");
      setPassword(result.password ?? `${name} password updated`);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await del(`/servers/${uuid}/databases/${confirm.id}`);
      toast.success("Database deleted");
      setConfirm(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <ServerLayout>
      <Card
        title="Databases"
        subtitle="Create and manage your server databases"
        actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpenCreate(true)}>New database</Button>}
      >
        {isLoading && <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>}
        {!isLoading && (!data?.rows?.length) && (
          <EmptyState icon={<Database className="h-6 w-6" />} title="No databases yet" description="Create a database for your application." />
        )}
        <div className="space-y-2.5">
          {data?.rows?.map((db) => (
            <div key={db.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Database className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-200">{db.name}</p>
                  <p className="font-mono text-xs text-slate-500">{db.host}:{db.port}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => resetPassword(db.id, db.name)} icon={<KeyRound className="h-3.5 w-3.5" />}>Reset password</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm({ id: db.id, name: db.name })} icon={<Trash2 className="h-3.5 w-3.5 text-rose-400" />} />
                </div>
              </div>
              <div className="mt-3 grid gap-2 border-t border-white/[0.05] pt-3 sm:grid-cols-2">
                <CopyRow label="Username" value={db.username} copied={copied === `u-${db.id}`} onCopy={() => copy(db.username, `u-${db.id}`)} />
                <CopyRow label="Remote" value={db.remote} copied={copied === `r-${db.id}`} onCopy={() => copy(db.remote, `r-${db.id}`)} />
              </div>
            </div>
          ))}
        </div>
        {data?.sftp && (
          <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-500">
            💡 Use your server's <strong>SFTP</strong> details ({data.sftp.username}@{data.sftp.ip}:{data.sftp.port}) or panel host with your account to connect with an external client.
          </p>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Create database">
        <div className="space-y-4">
          <Input label="Database name" placeholder="my_database" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Remote connections" hint="Allowed IPs — use % for any" placeholder="%" value={remote} onChange={(e) => setRemote(e.target.value)} />
          <Button onClick={create} loading={creating} className="w-full" icon={<Plus className="h-4 w-4" />}>Create database</Button>
        </div>
      </Modal>

      {/* Password result */}
      <Modal open={!!password} onClose={() => setPassword(null)} title="New password">
        <p className="mb-3 text-sm text-slate-400">Copy this password now — it won't be shown again.</p>
        <div className="flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
          <code className="flex-1 break-all font-mono text-sm text-violet-200">{password}</code>
          <button onClick={() => password && copy(password, "pw")} className="text-slate-400 hover:text-white">{copied === "pw" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button>
        </div>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setPassword(null)}>Done</Button>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={doDelete} danger title="Delete database?" description={`This will permanently delete "${confirm?.name}".`} confirmText="Delete" />
    </ServerLayout>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">{value}</code>
      <button onClick={onCopy} className="shrink-0 text-slate-500 hover:text-white">{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
    </div>
  );
}
