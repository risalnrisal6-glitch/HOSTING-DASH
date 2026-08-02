"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wand2, Trophy, Coins, Play, Vote, Gift } from "lucide-react";
import { get, post, patch, del, put } from "@/lib/api";
import { Card, Button, Badge, Input, Modal, Select, Textarea, Toggle, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/format";

interface RewardSetting { [k: string]: any }
interface Task { id: string; title: string; description: string; url: string | null; reward: number; enabled: boolean; type: string; cooldownHours: number; sort: number }
interface Giveaway { id: string; title: string; prize: string; coins: number; startsAt: string; endsAt: string; status: string; winnerId: string | null; _count: { entries: number } }

export default function AdminRewardsPage() {
  const [tab, setTab] = useState("earn");
  const { data: rewards, mutate: mutateRewards } = useSWR<RewardSetting>("/admin/rewards", (url: string) => get(url));
  const { data: tasks, mutate: mutateTasks } = useSWR<Task[]>("/admin/tasks", (url: string) => get(url));
  const { data: giveaways, mutate: mutateGiveaways } = useSWR<Giveaway[]>("/admin/giveaways", (url: string) => get(url));
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [editingGiveaway, setEditingGiveaway] = useState<Partial<Giveaway> | null>(null);
  const [drawing, setDrawing] = useState<Giveaway | null>(null);
  const [busy, setBusy] = useState(false);

  const saveSetting = async (key: string, value: any) => {
    try {
      await put(`/admin/rewards/${key}`, value);
      toast.success("Reward settings saved");
      mutateRewards();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const saveTask = async () => {
    if (!editingTask) return;
    setBusy(true);
    try {
      if (editingTask.id) await patch(`/admin/tasks/${editingTask.id}`, editingTask);
      else await post("/admin/tasks", editingTask);
      toast.success("Task saved");
      setEditingTask(null);
      mutateTasks();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveGiveaway = async () => {
    if (!editingGiveaway) return;
    setBusy(true);
    try {
      if (editingGiveaway.id) await patch(`/admin/giveaways/${editingGiveaway.id}`, editingGiveaway);
      else await post("/admin/giveaways", editingGiveaway);
      toast.success("Giveaway saved");
      setEditingGiveaway(null);
      mutateGiveaways();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const draw = async () => {
    if (!drawing) return;
    setBusy(true);
    try {
      const result = await post<{ winner: string }>(`/admin/giveaways/${drawing.id}/draw`, {});
      toast.success(`Winner: ${result.winner}! 🏆`);
      setDrawing(null);
      mutateGiveaways();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: "earn", label: "Earning settings" },
    { id: "tasks", label: "Tasks" },
    { id: "giveaways", label: "Giveaways" },
    { id: "spin", label: "Spin wheel" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-medium transition", tab === t.id ? "bg-gradient-to-r from-violet-600/80 to-blue-600/80 text-white" : "text-slate-400 hover:text-slate-200")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "earn" && rewards && (
        <div className="grid gap-4 md:grid-cols-2">
          <RewardConfigCard icon={<Play className="h-4 w-4" />} title="Daily check-in" config={rewards.daily_checkin} fields={[{ k: "amount", label: "Coins per day" }, { k: "streakBonus", label: "7-day streak bonus" }]} onSave={(v) => saveSetting("daily_checkin", v)} />
          <RewardConfigCard icon={<Trophy className="h-4 w-4" />} title="Weekly check-in" config={rewards.weekly_checkin} fields={[{ k: "amount", label: "Coins per week" }]} onSave={(v) => saveSetting("weekly_checkin", v)} />
          <RewardConfigCard icon={<Trophy className="h-4 w-4" />} title="Monthly check-in" config={rewards.monthly_checkin} fields={[{ k: "amount", label: "Coins per month" }]} onSave={(v) => saveSetting("monthly_checkin", v)} />
          <RewardConfigCard icon={<Play className="h-4 w-4" />} title="Watch ad" config={rewards.ad_watch} fields={[{ k: "amount", label: "Coins per ad" }, { k: "cooldownMinutes", label: "Cooldown (min)" }, { k: "dailyLimit", label: "Daily limit" }]} onSave={(v) => saveSetting("ad_watch", v)} />
          <RewardConfigCard icon={<Gift className="h-4 w-4" />} title="Referral" config={rewards.referral} fields={[{ k: "referrer", label: "Referrer reward" }, { k: "referred", label: "New user reward" }]} onSave={(v) => saveSetting("referral", v)} />
          <RewardConfigCard icon={<Vote className="h-4 w-4" />} title="Voting" config={rewards.vote} fields={[{ k: "amount", label: "Coins per vote" }, { k: "cooldownHours", label: "Cooldown (hours)" }]} urlField onSave={(v) => saveSetting("vote", v)} />
        </div>
      )}

      {tab === "tasks" && (
        <Card title="Tasks" actions={<Button size="sm" onClick={() => setEditingTask({ title: "", reward: 50, enabled: true, type: "link", cooldownHours: 24, sort: 0 })} icon={<Plus className="h-4 w-4" />}>New task</Button>}>
          <div className="space-y-2.5">
            {tasks?.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Coins className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200">{t.title} <Badge color="amber">+{t.reward}</Badge></p>
                  <p className="truncate text-xs text-slate-500">{t.description} · {t.type} · {t.cooldownHours}h cooldown</p>
                </div>
                <Toggle checked={t.enabled} onChange={(v) => saveTaskField(t.id, { enabled: v })} />
                <Button variant="ghost" size="sm" onClick={() => setEditingTask(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={async () => { await del(`/admin/tasks/${t.id}`); mutateTasks(); }}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "giveaways" && (
        <Card title="Giveaways" actions={<Button size="sm" onClick={() => setEditingGiveaway({ title: "", prize: "", coins: 100, status: "upcoming" })} icon={<Plus className="h-4 w-4" />}>New giveaway</Button>}>
          <div className="space-y-2.5">
            {giveaways?.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"><Trophy className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200">{g.title}</p>
                  <p className="text-xs text-slate-500">{g.prize} · {g.coins} AKF · {g._count.entries} entries · {new Date(g.endsAt).toLocaleDateString()}</p>
                </div>
                <Badge color={g.status === "running" ? "green" : g.status === "ended" ? "slate" : "blue"}>{g.status}</Badge>
                {g.status === "running" && g._count.entries > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setDrawing(g)} icon={<Wand2 className="h-3.5 w-3.5" />}>Draw winner</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setEditingGiveaway(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={async () => { await del(`/admin/giveaways/${g.id}`); mutateGiveaways(); }}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "spin" && rewards?.spin_wheel && (
        <SpinEditor config={rewards.spin_wheel} onSave={(v) => saveSetting("spin_wheel", v)} />
      )}

      {/* Task editor */}
      <Modal open={!!editingTask} onClose={() => setEditingTask(null)} title={editingTask?.id ? "Edit task" : "New task"}>
        {editingTask && (
          <div className="space-y-4">
            <Input label="Title" value={editingTask.title || ""} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} />
            <Input label="Description" value={editingTask.description || ""} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })} />
            <Select label="Type" value={editingTask.type || "link"} onChange={(e) => setEditingTask({ ...editingTask, type: e.target.value })}>
              <option value="link">Link click</option>
              <option value="vote">Vote</option>
              <option value="join_discord">Join Discord</option>
            </Select>
            <Input label="URL" value={editingTask.url || ""} onChange={(e) => setEditingTask({ ...editingTask, url: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Reward (AKF)" type="number" value={editingTask.reward ?? 0} onChange={(e) => setEditingTask({ ...editingTask, reward: Number(e.target.value) })} />
              <Input label="Cooldown (hours)" type="number" value={editingTask.cooldownHours ?? 24} onChange={(e) => setEditingTask({ ...editingTask, cooldownHours: Number(e.target.value) })} />
            </div>
            <Toggle checked={!!editingTask.enabled} onChange={(v) => setEditingTask({ ...editingTask, enabled: v })} label="Enabled" />
            <Button onClick={saveTask} loading={busy} className="w-full">Save task</Button>
          </div>
        )}
      </Modal>

      {/* Giveaway editor */}
      <Modal open={!!editingGiveaway} onClose={() => setEditingGiveaway(null)} title={editingGiveaway?.id ? "Edit giveaway" : "New giveaway"}>
        {editingGiveaway && (
          <div className="space-y-4">
            <Input label="Title" value={editingGiveaway.title || ""} onChange={(e) => setEditingGiveaway({ ...editingGiveaway, title: e.target.value })} />
            <Input label="Prize description" value={editingGiveaway.prize || ""} onChange={(e) => setEditingGiveaway({ ...editingGiveaway, prize: e.target.value })} />
            <Input label="Prize coins (AKF)" type="number" value={editingGiveaway.coins ?? 0} onChange={(e) => setEditingGiveaway({ ...editingGiveaway, coins: Number(e.target.value) })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Starts" type="datetime-local" value={editingGiveaway.startsAt ? editingGiveaway.startsAt.slice(0, 16) : ""} onChange={(e) => setEditingGiveaway({ ...editingGiveaway, startsAt: e.target.value })} />
              <Input label="Ends" type="datetime-local" value={editingGiveaway.endsAt ? editingGiveaway.endsAt.slice(0, 16) : ""} onChange={(e) => setEditingGiveaway({ ...editingGiveaway, endsAt: e.target.value })} />
            </div>
            <Select label="Status" value={editingGiveaway.status || "upcoming"} onChange={(e) => setEditingGiveaway({ ...editingGiveaway, status: e.target.value })}>
              <option value="upcoming">Upcoming</option>
              <option value="running">Running</option>
              <option value="ended">Ended</option>
            </Select>
            <Button onClick={saveGiveaway} loading={busy} className="w-full">Save giveaway</Button>
          </div>
        )}
      </Modal>

      {/* Draw confirm */}
      <ConfirmDialog open={!!drawing} onClose={() => setDrawing(null)} onConfirm={draw} loading={busy} title="Draw a winner?" description={`Randomly pick a winner for "${drawing?.title}" (${drawing?._count.entries} entries)? The winner receives ${drawing?.coins} AKF.`} confirmText="Draw winner" />
    </div>
  );
}

async function saveTaskField(id: string, fields: any) {
  await patch(`/admin/tasks/${id}`, fields);
}

function RewardConfigCard({ icon, title, config, fields, onSave, urlField }: { icon: React.ReactNode; title: string; config: any; fields: { k: string; label: string }[]; onSave: (v: any) => void; urlField?: boolean }) {
  const [values, setValues] = useState<Record<string, any>>(config || {});
  const [enabled, setEnabled] = useState(config?.enabled !== false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave({ ...values, enabled });
    setSaving(false);
  };

  return (
    <Card title={<span className="flex items-center gap-2">{icon}{title}</span>}>
      <div className="space-y-3">
        <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
        {fields.map((f) => (
          <Input key={f.k} label={f.label} type="number" value={values[f.k] ?? 0} onChange={(e) => setValues({ ...values, [f.k]: Number(e.target.value) })} />
        ))}
        {urlField && <Input label="Vote URL" value={values.url || ""} onChange={(e) => setValues({ ...values, url: e.target.value })} />}
        <Button onClick={save} loading={saving} size="sm">Save settings</Button>
      </div>
    </Card>
  );
}

function SpinEditor({ config, onSave }: { config: any; onSave: (v: any) => void }) {
  const [cfg, setCfg] = useState({ ...config, segments: [...(config.segments || [])] });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(cfg);
    setSaving(false);
  };

  const setSeg = (i: number, k: string, v: any) => {
    const segments = [...cfg.segments];
    segments[i] = { ...segments[i], [k]: v };
    setCfg({ ...cfg, segments });
  };

  return (
    <Card title="Lucky spin wheel" subtitle="Configure segments, weights and limits">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Input label="Cost per spin (AKF)" type="number" value={cfg.cost ?? 0} onChange={(e) => setCfg({ ...cfg, cost: Number(e.target.value) })} />
          <Input label="Daily limit" type="number" value={cfg.dailyLimit ?? 5} onChange={(e) => setCfg({ ...cfg, dailyLimit: Number(e.target.value) })} />
          <div className="flex items-end pb-1"><Toggle checked={cfg.enabled !== false} onChange={(v) => setCfg({ ...cfg, enabled: v })} label="Enabled" /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.segments.map((seg: any, i: number) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: seg.color }} />
              <Input label="Label" value={seg.label} onChange={(e) => setSeg(i, "label", e.target.value)} className="!py-1" />
              <Input label="Coins" type="number" value={seg.coins} onChange={(e) => setSeg(i, "coins", Number(e.target.value))} className="!py-1" />
              <Input label="Weight" type="number" value={seg.weight} onChange={(e) => setSeg(i, "weight", Number(e.target.value))} className="!py-1" />
              <input type="color" value={seg.color} onChange={(e) => setSeg(i, "color", e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
            </div>
          ))}
        </div>
        <Button onClick={save} loading={saving} icon={<Wand2 className="h-4 w-4" />}>Save wheel configuration</Button>
      </div>
    </Card>
  );
}
