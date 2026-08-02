"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { get, post, patch, del } from "@/lib/api";
import { Card, Button, Badge, Modal, Input, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/format";

interface Role { id: string; name: string; description: string | null; permissions: string; isSystem: boolean; _count: { users: number } }

const ALL_PERMISSIONS = [
  "dashboard.view", "users.view", "users.manage", "servers.view_all", "servers.manage", "plans.manage", "shop.manage",
  "coupons.manage", "rewards.manage", "tickets.manage", "payments.manage", "panel.sync", "announcements.manage",
  "roles.manage", "logs.view", "coins.manage", "settings.manage",
];

export default function AdminRolesPage() {
  const { data: roles, mutate } = useSWR<Role[]>("/admin/roles", (url: string) => get(url));
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string; permissions: string[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  const togglePerm = (p: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      permissions: editing.permissions.includes(p) ? editing.permissions.filter((x) => x !== p) : [...editing.permissions, p],
    });
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try {
      if (editing.id) await patch(`/admin/roles/${editing.id}`, editing);
      else await post("/admin/roles", editing);
      toast.success("Role saved");
      setEditing(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Custom roles extend the built-in role system with fine-grained permissions.</p>
        <Button size="sm" onClick={() => setEditing({ name: "", description: "", permissions: [] })} icon={<Plus className="h-4 w-4" />}>New role</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles?.map((r) => {
          const perms = JSON.parse(r.permissions || "[]") as string[];
          return (
            <Card key={r.id} className="glass-hover p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><UserCog className="h-5 w-5" /></div>
                  <div>
                    <p className="font-display text-base font-bold text-slate-100">{r.name}</p>
                    <p className="text-xs text-slate-500">{r._count.users} assigned · {perms.length} permissions</p>
                  </div>
                </div>
                {r.isSystem && <Badge color="blue">System</Badge>}
              </div>
              {r.description && <p className="mt-2 text-xs text-slate-500">{r.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {perms.slice(0, 5).map((p) => <Badge key={p} color="violet">{p}</Badge>)}
                {perms.length > 5 && <Badge color="slate">+{perms.length - 5}</Badge>}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {!r.isSystem && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ id: r.id, name: r.name, description: r.description || "", permissions: perms })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(r)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit role" : "New role"} wide>
        {editing && (
          <div className="space-y-4">
            <Input label="Role name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Input label="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">Permissions</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {ALL_PERMISSIONS.map((p) => (
                  <button key={p} onClick={() => togglePerm(p)} className={cn("rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition", editing.permissions.includes(p) ? "border-violet-400/50 bg-violet-500/15 text-violet-200" : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-violet-400/30")}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={save} loading={busy} className="w-full">Save role</Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={async () => {
        try { await del(`/admin/roles/${confirmDelete!.id}`); setConfirmDelete(null); mutate(); toast.success("Role deleted"); }
        catch (e: any) { toast.error(e.message); }
      }} danger title="Delete role?" description={`Delete "${confirmDelete?.name}"?`} confirmText="Delete" />
    </div>
  );
}
