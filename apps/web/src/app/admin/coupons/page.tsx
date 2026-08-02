"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { get, post, patch, del } from "@/lib/api";
import { Card, Button, Badge, Modal, Input, Select, Toggle, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/format";

interface Coupon { id: string; code: string; type: string; value: number; maxUses: number; usedCount: number; perUserLimit: number; expiresAt: string | null; enabled: boolean; description: string | null }

export default function AdminCouponsPage() {
  const { data: coupons, mutate } = useSWR<Coupon[]>("/admin/coupons", (url: string) => get(url));
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing || !editing.code) return;
    setBusy(true);
    try {
      if (editing.id) await patch(`/admin/coupons/${editing.id}`, editing);
      else await post("/admin/coupons", editing);
      toast.success("Coupon saved");
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
        <p className="text-sm text-slate-500">{coupons?.length ?? 0} coupons</p>
        <Button size="sm" onClick={() => setEditing({ code: "", type: "percent", value: 10, enabled: true })} icon={<Plus className="h-4 w-4" />}>New coupon</Button>
      </div>

      <Card>
        <div className="space-y-2.5">
          {!coupons?.length && <p className="py-10 text-center text-sm text-slate-500">No coupons yet — create one to reward your community.</p>}
          {coupons?.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300"><Gift className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm font-bold text-violet-300">{c.code}</code>
                  <Badge color="amber">{c.type === "percent" ? `${c.value}% off` : `${c.value} AKF`}</Badge>
                  {!c.enabled && <Badge color="slate">Disabled</Badge>}
                </div>
                <p className="text-[11px] text-slate-500">
                  {c.maxUses > 0 ? `${c.usedCount}/${c.maxUses} uses` : `${c.usedCount} uses`} · {c.perUserLimit > 0 ? `${c.perUserLimit}/user` : "unlimited/user"} · {c.expiresAt ? `expires ${new Date(c.expiresAt).toLocaleDateString()}` : "no expiry"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(c)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit coupon" : "New coupon"}>
        {editing && (
          <div className="space-y-4">
            <Input label="Code" value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Type" value={editing.type || "percent"} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed (AKF)</option>
              </Select>
              <Input label="Value" type="number" value={editing.value ?? 0} onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Max uses (0 = unlimited)" type="number" value={editing.maxUses ?? 0} onChange={(e) => setEditing({ ...editing, maxUses: Number(e.target.value) })} />
              <Input label="Per-user limit (0 = unlimited)" type="number" value={editing.perUserLimit ?? 0} onChange={(e) => setEditing({ ...editing, perUserLimit: Number(e.target.value) })} />
            </div>
            <Input label="Expiry (optional)" type="datetime-local" value={editing.expiresAt ? editing.expiresAt.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            <Input label="Description" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <Toggle checked={editing.enabled !== false} onChange={(v) => setEditing({ ...editing, enabled: v })} label="Enabled" />
            <Button onClick={save} loading={busy} className="w-full">Save coupon</Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={async () => { await del(`/admin/coupons/${confirmDelete!.id}`); setConfirmDelete(null); mutate(); }} danger title="Delete coupon?" description={`Delete "${confirmDelete?.code}"?`} confirmText="Delete" />
    </div>
  );
}
