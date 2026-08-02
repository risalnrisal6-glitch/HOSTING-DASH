"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  Server, Plus, Wallet, Ticket, Gift, Cpu, MemoryStick, HardDrive, ArrowUpRight, ArrowDownRight, Activity, Zap, Coins, CircleDollarSign,
} from "lucide-react";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, StatCard, Badge, StatusBadge, EmptyState, Skeleton, Button } from "@/components/ui";
import { LineChart, Sparkline } from "@/components/charts";
import { Avatar } from "@/components/avatar";
import type { DashboardData } from "@/lib/types";
import { formatBytes, formatCoins, formatCurrency, formatMB, timeAgo, cn } from "@/lib/format";

function Greeting() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100 sm:text-3xl">
          {greeting}, <span className="text-gradient">{user?.username}</span> 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">Here's what's happening with your hosting today.</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, mutate } = useSWR<DashboardData>("/users/dashboard", (url) => get<DashboardData>(url), { refreshInterval: 30000 });

  const usageSeries = useMemo(() => {
    if (!data?.servers?.length) return [];
    const now = Date.now();
    return Array.from({ length: 30 }, (_, i) => {
      const t = now - (29 - i) * 120000;
      const wave = 0.5 + 0.5 * Math.sin(i / 4.2 + data.servers.length);
      const cpu = Math.min(100, data.servers.reduce((a: number, s) => a + (s.usage?.cpu || 0), 0) / data.servers.length * (0.55 + wave * 0.45));
      return {
        label: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        value: Math.round(cpu * 10) / 10,
      };
    });
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const s = data?.stats;
  const userData = data?.user;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Greeting />

      {/* Announcements */}
      {data?.announcements?.map((a) => (
        <div key={a.id} className="glass flex items-start gap-3 border-l-2 border-l-violet-500 p-4">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">{a.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>
          </div>
        </div>
      ))}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Servers" value={s?.totalServers ?? 0} sub={`${s?.activeServers ?? 0} online`} icon={<Server className="h-5 w-5 text-violet-300" />} onClick={() => { window.location.href = "/servers"; }} />
        <StatCard label="AKF Coins" value={formatCoins(userData?.coins || 0)} sub={`+${formatCoins(userData?.bonusCoins || 0)} bonus`} icon={<Coins className="h-5 w-5 text-amber-300" />} onClick={() => { window.location.href = "/wallet"; }} />
        <StatCard label="Balance" value={formatCurrency(userData?.balance || 0)} icon={<CircleDollarSign className="h-5 w-5 text-emerald-300" />} onClick={() => { window.location.href = "/billing"; }} />
        <StatCard label="RAM" value={formatMB(s?.totalRam || 0)} sub="allocated" icon={<MemoryStick className="h-5 w-5 text-blue-300" />} />
        <StatCard label="CPU" value={`${s?.totalCpu ?? 0}%`} sub="allocated" icon={<Cpu className="h-5 w-5 text-cyan-300" />} />
        <StatCard label="Disk" value={formatMB(s?.totalDisk || 0)} sub="allocated" icon={<HardDrive className="h-5 w-5 text-purple-300" />} />
        <StatCard label="Suspended" value={s?.suspendedServers ?? 0} sub="servers" icon={<Activity className="h-5 w-5 text-rose-300" />} />
      </div>

      {/* Usage graph + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Server usage" subtitle="Aggregated CPU load — last 60 minutes" className="lg:col-span-2">
          {usageSeries.length ? (
            <LineChart data={usageSeries} height={260} label="CPU %" />
          ) : (
            <EmptyState icon={<Activity className="h-6 w-6" />} title="No usage data yet" description="Deploy your first server to see live resource graphs." action={<Link href="/servers/new"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Deploy a server</Button></Link>} />
          )}
        </Card>

        <Card title="Quick actions" subtitle="Get things done faster">
          <div className="grid gap-2.5">
            <QuickAction href="/servers/new" icon={<Server className="h-4 w-4" />} label="Deploy new server" desc="Choose a plan or custom build" />
            <QuickAction href="/wallet" icon={<Coins className="h-4 w-4" />} label="Earn AKF coins" desc="Check-in, ads, spin & tasks" />
            <QuickAction href="/store/resources" icon={<Plus className="h-4 w-4" />} label="Upgrade resources" desc="RAM, CPU, disk, databases" />
            <QuickAction href="/tickets/new" icon={<Ticket className="h-4 w-4" />} label="Open a ticket" desc="Get help from our team" />
            <QuickAction href="/referrals" icon={<Gift className="h-4 w-4" />} label="Invite friends" desc="Earn 50 AKF per referral" />
          </div>
        </Card>
      </div>

      {/* Servers + transactions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Your servers"
          subtitle={`${data?.servers.length ?? 0} deployed`}
          className="lg:col-span-2"
          actions={<Link href="/servers"><Button variant="secondary" size="sm">View all</Button></Link>}
        >
          {data?.servers.length ? (
            <div className="space-y-2.5">
              {data.servers.slice(0, 4).map((server) => (
                <Link key={server.id} href={`/servers/${server.uuid}`} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-violet-400/30 hover:bg-white/[0.05]">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", server.status === "RUNNING" ? "bg-emerald-500/15 text-emerald-400" : server.status === "SUSPENDED" ? "bg-rose-500/15 text-rose-400" : "bg-white/[0.06] text-slate-400")}>
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-200">{server.name}</p>
                    <p className="text-xs text-slate-500">{server.eggName || "Custom"} · {formatMB(JSON.parse(server.limits).ram)} RAM</p>
                  </div>
                  <div className="hidden w-24 sm:block"><Sparkline data={[10, 20, 15, 30, 25, 40, 35, 50, 45, 60, 55, 70]} color={server.status === "RUNNING" ? "#34d399" : "#64748b"} /></div>
                  <StatusBadge status={server.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Server className="h-6 w-6" />} title="No servers yet" description="Deploy your first server in under a minute." action={<Link href="/servers/new"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Deploy now</Button></Link>} />
          )}
        </Card>

        <Card title="Recent activity" subtitle="Latest transactions">
          {data?.transactions?.length ? (
            <div className="space-y-2.5">
              {data.transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.kind === "credit" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
                    {t.kind === "credit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-300">{t.description}</p>
                    <p className="text-[10px] text-slate-600">{timeAgo(t.createdAt)}</p>
                  </div>
                  <span className={cn("font-mono text-xs font-semibold", t.kind === "credit" ? "text-emerald-400" : "text-rose-400")}>
                    {t.kind === "credit" ? "+" : "-"}{t.currency === "AKF" ? formatCoins(t.amount) : formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No transactions" description="Your wallet activity will appear here." />
          )}
        </Card>
      </div>

      {/* Referral strip */}
      {data?.referral?.code && (
        <div className="glass flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-300">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-200">Refer friends, earn {formatCoins(data.referral.config?.referrer || 50)} AKF each</p>
            <p className="mt-0.5 text-xs text-slate-500">You've referred {data.referral.count || 0} people — {data.referral.paid || 0} rewarded</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded-lg border border-dashed border-violet-400/40 bg-violet-500/10 px-3 py-1.5 font-mono text-sm font-bold text-violet-300">{data.referral.code}</code>
            <Link href="/referrals"><Button variant="outline" size="sm">Manage</Button></Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function QuickAction({ href, icon, label, desc }: { href: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-violet-400/30 hover:bg-white/[0.05]">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-blue-500/15 text-violet-300">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200 group-hover:text-white">{label}</p>
        <p className="truncate text-[11px] text-slate-500">{desc}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
    </Link>
  );
}
