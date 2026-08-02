"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Coins, CircleDollarSign, CalendarCheck, Play, Gift, ExternalLink, Ticket as TicketIcon, Sparkles, Trophy, ArrowUpRight, ArrowDownRight, Wand2,
} from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, Badge, Input, EmptyState, Tabs } from "@/components/ui";
import { SpinWheel } from "@/components/spin-wheel";
import type { WheelConfig, Transaction } from "@/lib/types";
import { formatCoins, formatCurrency, timeAgo, cn } from "@/lib/format";

interface CheckinStatus { dailyClaimed: boolean; weeklyClaimed: boolean; monthlyClaimed: boolean; streak: number; last7: string[] }
interface Task { id: string; title: string; description: string; url: string | null; reward: number; completed: boolean }
interface Giveaway { id: string; title: string; prize: string; coins: number; endsAt: string; status: string; entered: boolean; entryCount: number | null; winner: string | null }

export default function WalletPage() {
  const [tab, setTab] = useState("earn");
  const { data: user, mutate: mutateUser } = useSWR("/users/me", (url: string) => get(url));
  const { data: checkin, mutate: mutateCheckin } = useSWR<CheckinStatus>("/wallet/checkin", (url: string) => get(url));
  const { data: tasks, mutate: mutateTasks } = useSWR<Task[]>("/wallet/tasks", (url: string) => get(url));
  const { data: wheel } = useSWR<{ config: WheelConfig }>("/wallet/spin/config", (url: string) => get(url));
  const { data: giveaways, mutate: mutateGiveaways } = useSWR<Giveaway[]>("/wallet/giveaways", (url: string) => get(url));
  const { data: tx } = useSWR<{ items: Transaction[] }>("/users/transactions?limit=10", (url: string) => get(url));
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);

  const doCheckin = async (kind: string) => {
    setBusy(true);
    try {
      const r = await post<{ reward: number; alreadyClaimed: boolean }>(`/wallet/checkin/${kind}`, {});
      if (r.alreadyClaimed) toast.info("Already claimed today");
      else toast.success(`+${r.reward} AKF coins!`);
      mutateUser();
      mutateCheckin();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const watchAd = async () => {
    setBusy(true);
    try {
      const r = await post<{ reward: number }>("/wallet/ad", {});
      toast.success(`+${r.reward} AKF for watching the ad`);
      mutateUser();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const claimTask = async (id: string) => {
    try {
      const r = await post<{ reward: number }>(`/wallet/tasks/${id}/claim`, {});
      toast.success(`+${r.reward} AKF — task completed!`);
      mutateUser();
      mutateTasks();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const claimVote = async () => {
    try {
      const r = await post<{ reward: number; url: string }>("/wallet/vote", {});
      toast.success(`+${r.reward} AKF — thanks for voting!`);
      mutateUser();
      if (r.url) window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const redeemPromo = async () => {
    if (!promo.trim()) return;
    try {
      const r = await post<{ value: number; type: string }>("/wallet/promo", { code: promo });
      toast.success(`Promo redeemed: +${r.value} AKF!`);
      setPromo("");
      mutateUser();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const enterGiveaway = async (id: string) => {
    try {
      await post(`/wallet/giveaways/${id}/enter`, {});
      toast.success("You're in! Good luck 🍀");
      mutateGiveaways();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const tabs = [
    { id: "earn", label: "Earn coins" },
    { id: "history", label: "Transactions" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your AKF coins and wallet balance.</p>
        </div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* Balances */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-orange-500/25 text-amber-300"><Coins className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">AKF Coins</p>
              <p className="font-display text-3xl font-bold text-amber-300">{formatCoins(user?.coins || 0)}</p>
              {(user?.bonusCoins || 0) > 0 && <p className="text-[11px] text-slate-500">+{formatCoins(user.bonusCoins)} bonus coins</p>}
            </div>
          </div>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/25 to-teal-500/25 text-emerald-300"><CircleDollarSign className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Wallet Balance</p>
              <p className="font-display text-3xl font-bold text-emerald-300">{formatCurrency(user?.balance || 0)}</p>
              <p className="text-[11px] text-slate-500">Use it to pay invoices</p>
            </div>
          </div>
        </Card>
      </div>

      {tab === "earn" && (
        <div className="space-y-6">
          {/* Check-ins */}
          <Card title="Daily rewards" subtitle={`Current streak: ${checkin?.streak || 0} day${(checkin?.streak || 0) === 1 ? "" : "s"}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <RewardCard title="Daily" icon={<CalendarCheck className="h-5 w-5" />} desc="+25 AKF · grows with streak" claimed={checkin?.dailyClaimed} onClick={() => doCheckin("daily")} />
              <RewardCard title="Weekly" icon={<Trophy className="h-5 w-5" />} desc="+150 AKF every week" claimed={checkin?.weeklyClaimed} onClick={() => doCheckin("weekly")} />
              <RewardCard title="Monthly" icon={<Sparkles className="h-5 w-5" />} desc="+500 AKF every month" claimed={checkin?.monthlyClaimed} onClick={() => doCheckin("monthly")} />
            </div>
          </Card>

          {/* Spin + Ads */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Lucky spin wheel" subtitle="Try your luck — win up to 1000 AKF" bodyClassName="flex justify-center">
              {wheel?.config ? <SpinWheel config={wheel.config} /> : <div className="h-64 animate-pulse rounded-full bg-white/[0.04]" />}
            </Card>

            <div className="space-y-6">
              <Card title="Quick earn">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Play className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">Watch an ad</p>
                      <p className="text-xs text-slate-500">+5 AKF per ad · 3 min cooldown</p>
                    </div>
                    <Button size="sm" onClick={watchAd} loading={busy}>Watch</Button>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><ExternalLink className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">Vote for us</p>
                      <p className="text-xs text-slate-500">+15 AKF · every 12 hours</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={claimVote}>Vote</Button>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><TicketIcon className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">Promo code</p>
                      <p className="text-xs text-slate-500">Redeem codes for free AKF</p>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="CODE" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className="!w-32" />
                      <Button size="sm" onClick={redeemPromo}><Wand2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Tasks" subtitle="Complete tasks to earn AKF coins">
                <div className="space-y-2.5">
                  {tasks?.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Gift className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">{t.title}</p>
                        <p className="truncate text-[11px] text-slate-500">{t.description}</p>
                      </div>
                      <Badge color="amber">+{t.reward}</Badge>
                      {t.completed ? (
                        <Badge color="green">Done</Badge>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => { if (t.url) window.open(t.url, "_blank"); claimTask(t.id); }}>Claim</Button>
                      )}
                    </div>
                  ))}
                  {!tasks?.length && <p className="text-sm text-slate-500">No tasks available.</p>}
                </div>
              </Card>
            </div>
          </div>

          {/* Giveaways */}
          {giveaways?.length ? (
            <Card title="Giveaways" subtitle="Enter for a chance to win">
              <div className="space-y-2.5">
                {giveaways.map((g) => (
                  <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 text-rose-300"><Trophy className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-200">{g.title}</p>
                      <p className="text-xs text-slate-500">{g.prize} · {g.entryCount ?? 0} entries · ends {new Date(g.endsAt).toLocaleDateString()}</p>
                    </div>
                    {g.status === "ended" ? (
                      <Badge color="violet">{g.winner ? `Winner: ${g.winner}` : "Ended"}</Badge>
                    ) : g.entered ? (
                      <Badge color="green">Entered</Badge>
                    ) : (
                      <Button size="sm" onClick={() => enterGiveaway(g.id)}>Enter</Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {tab === "history" && (
        <Card title="Transaction history">
          {tx?.items?.length ? (
            <div className="space-y-2">
              {tx.items.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", t.kind === "credit" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
                    {t.kind === "credit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">{t.description}</p>
                    <p className="text-[11px] text-slate-600">{timeAgo(t.createdAt)}</p>
                  </div>
                  <span className={cn("font-mono text-sm font-semibold", t.kind === "credit" ? "text-emerald-400" : "text-rose-400")}>
                    {t.kind === "credit" ? "+" : "−"}{t.currency === "AKF" ? formatCoins(t.amount) : formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Coins className="h-6 w-6" />} title="No transactions yet" description="Earn AKF coins and your history will appear here." />
          )}
        </Card>
      )}
    </motion.div>
  );
}

function RewardCard({ title, icon, desc, claimed, onClick }: { title: string; icon: React.ReactNode; desc: string; claimed?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={claimed} className={cn("group rounded-xl border p-4 text-left transition", claimed ? "cursor-default border-emerald-400/25 bg-emerald-500/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:border-violet-400/40 hover:bg-white/[0.04]")}>
      <div className="flex items-center justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", claimed ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/15 text-violet-300")}>{icon}</div>
        {claimed && <Badge color="green">Claimed</Badge>}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </button>
  );
}
