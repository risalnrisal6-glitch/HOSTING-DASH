"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Cpu, MemoryStick, HardDrive } from "lucide-react";
import { get, post, patch, del } from "@/lib/api";
import { Card, Button, Badge, Modal, Input, Select, Textarea, Toggle, ConfirmDialog } from "@/components/ui";
import type { Plan } from "@/lib/types";
import { formatCurrency, formatMB, cn } from "@/lib/format";

export default function AdminPlansPage() {
  const { data: plans, mutate } = useSWR<Plan[]>("/admin/plans", (url: string) => get(url));
  const { data: panel } = useSWR("/admin/panel", (url: string) => get(url));
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  const nests = panel?.nests || [];
  const eggs = editing?.nestId ? nests.find((n: any) => String(n.id) === String(editing.nestId))?.eggs || [] : [];

  const openNew = () => setEditing({ name: "", price: 0, cycle: "monthly", ram: 1024, cpu: 100, disk: 10240, databases: 1, backups: 1, allocations: 1, active: true, sort: 0, environment: "{}" } as Partial<Plan>);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) await patch(`/admin/plans/${editing.id}`, editing);
      else await post("/admin/plans", editing);
      toast.success("Plan saved");
      setEditing(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await del(`/admin/plans/${confirmDelete.id}`);
      toast.success("Plan deleted");
      setConfirmDelete(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const set = (k: string, v: any) => setEditing((e) => (e ? { ...e, [k]: v } : e));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{plans?.length ?? 0} plans configured</p>
        <Button size="sm" onClick={openNew} icon={<Plus className="h-4 w-4" />}>New plan</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans?.map((p) => (
          <Card key={p.id} className="glass-hover p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 text-violet-300"><Package className="h-5 w-5" /></div>
                <div>
                  <p className="font-display text-base font-bold text-slate-100">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.cycle} · {formatCurrency(p.price)}</p>
                </div>
              </div>
              {!p.active && <Badge color="slate">Draft</Badge>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini label="RAM" value={formatMB(p.ram)} />
              <Mini label="CPU" value={`${p.cpu}%`} />
              <Mini label="Disk" value={formatMB(p.disk)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(p)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Editor */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing?.name}` : "New plan"} wide>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={editing.name || ""} onChange={(e) => set("name", e.target.value)} />
            <Input label="Price (USD)" type="number" value={editing.price ?? 0} onChange={(e) => set("price", Number(e.target.value))} />
            <Select label="Billing cycle" value={editing.cycle || "monthly"} onChange={(e) => set("cycle", e.target.value)}>
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
            </Select>
            <Textarea label="Description" value={editing.description || ""} onChange={(e) => set("description", e.target.value)} />
            <Input label="RAM (MB)" type="number" value={editing.ram ?? 1024} onChange={(e) => set("ram", Number(e.target.value))} icon={<MemoryStick className="h-4 w-4" />} />
            <Input label="CPU (%)" type="number" value={editing.cpu ?? 100} onChange={(e) => set("cpu", Number(e.target.value))} icon={<Cpu className="h-4 w-4" />} />
            <Input label="Disk (MB)" type="number" value={editing.disk ?? 10240} onChange={(e) => set("disk", Number(e.target.value))} icon={<HardDrive className="h-4 w-4" />} />
            <div className="grid grid-cols-3 gap-2">
              <Input label="DBs" type="number" value={editing.databases ?? 1} onChange={(e) => set("databases", Number(e.target.value))} />
              <Input label="BKs" type="number" value={editing.backups ?? 1} onChange={(e) => set("backups", Number(e.target.value))} />
              <Input label="ALs" type="number" value={editing.allocations ?? 1} onChange={(e) => set("allocations", Number(e.target.value))} />
            </div>
            <Select label="Nest (from panel)" value={editing.nestId || ""} onChange={(e) => set("nestId", e.target.value)}>
              <option value="">Auto / default</option>
              {nests.map((n: any) => <option key={n.id} value={String(n.id)}>{n.name}</option>)}
            </Select>
            <Select label="Egg" value={editing.eggId || ""} onChange={(e) => set("eggId", e.target.value)}>
              <option value="">Auto / default</option>
              {eggs.map((e: any) => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
            </Select>
            <Select label="Location" value={editing.locationId || ""} onChange={(e) => set("locationId", e.target.value)}>
              <option value="">Auto / default</option>
              {(panel?.locations || []).map((l: any) => <option key={l.id} value={String(l.id)}>{l.long || l.short}</option>)}
            </Select>
            <Input label="Docker image" value={editing.dockerImage || ""} onChange={(e) => set("dockerImage", e.target.value)} placeholder="ghcr.io/pterodactyl/yolks:java_21" />
            <div className="sm:col-span-2">
              <Toggle checked={!!editing.active} onChange={(v) => set("active", v)} label="Active (visible in store)" />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} loading={busy}>Save plan</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={remove} danger title="Delete plan?" description={`Delete "${confirmDelete?.name}"? This cannot be undone.`} confirmText="Delete" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] py-2">
      <p className="text-[9px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-300">{value}</p>
    </div>
  );
}
