"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { get, post, del } from "@/lib/api";
import { Card, Button, Badge, Modal, Input, Textarea, Select, Toggle, ConfirmDialog } from "@/components/ui";
import { timeAgo } from "@/lib/format";

interface Announcement { id: string; title: string; body: string; type: string; active: boolean; createdAt: string }

export default function AdminAnnouncementsPage() {
  const { data: announcements, mutate } = useSWR<Announcement[]>("/admin/announcements", (url: string) => get(url));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", type: "info", active: true, notify: false });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);

  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error("Title and body required");
    setBusy(true);
    try {
      await post("/admin/announcements", form);
      toast.success("Announcement published");
      setOpen(false);
      setForm({ title: "", body: "", type: "info", active: true, notify: false });
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const typeColors: Record<string, string> = { info: "blue", warning: "amber", update: "violet", promo: "emerald" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{announcements?.length ?? 0} announcements</p>
        <Button size="sm" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>New announcement</Button>
      </div>

      <Card>
        <div className="space-y-2.5">
          {!announcements?.length && <p className="py-10 text-center text-sm text-slate-500">No announcements yet.</p>}
          {announcements?.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300"><Megaphone className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-200">{a.title}</p>
                  <Badge color={typeColors[a.type]}>{a.type}</Badge>
                  {!a.active && <Badge color="slate">Hidden</Badge>}
                  <span className="text-[11px] text-slate-600">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{a.body}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(a)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New announcement">
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="update">Update</option>
            <option value="promo">Promo</option>
          </Select>
          <div className="space-y-2">
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Visible to users" />
            <Toggle checked={form.notify} onChange={(v) => setForm({ ...form, notify: v })} label="Push notification to all users" />
          </div>
          <Button onClick={create} loading={busy} className="w-full">Publish</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={async () => { await del(`/admin/announcements/${confirmDelete!.id}`); setConfirmDelete(null); mutate(); }} danger title="Delete announcement?" confirmText="Delete" />
    </div>
  );
}
