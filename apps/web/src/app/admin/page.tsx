"use client";

import { motion } from "framer-motion";
import useSWR from "swr";
import Link from "next/link";
import { Users, Server, Coins, CircleDollarSign, Ticket, CreditCard, UserPlus, TrendingUp } from "lucide-react";
import { get } from "@/lib/api";
import { Card, StatCard, Skeleton, Badge, StatusBadge } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { formatCoins, formatCurrency, timeAgo, formatMB } from "@/lib/format";

interface AdminStats {
  users: number;
  servers: number;
  coinsInCirculation: number;
  walletTotal: number;
  pendingInvoices: number;
  openTickets: number;
  newUsersToday: number;
  revenue: number;
  recent: { id: string; username: string; avatar: string | null; email: string; coins: number; createdAt: string }[];
  recentServers: { id: string; name: string; status: string; eggName: string | null; createdAt: string; user: { username: string } }[];
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useSWR<AdminStats>("/admin/dashboard", (url: string) => get(url));

  if (isLoading && !data) {
    return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Users" value={data?.users ?? 0} sub={`+${data?.newUsersToday ?? 0} today`} icon={<Users className="h-5 w-5 text-violet-300" />} />
        <StatCard label="Servers" value={data?.servers ?? 0} icon={<Server className="h-5 w-5 text-blue-300" />} />
        <StatCard label="AKF in circulation" value={formatCoins(data?.coinsInCirculation || 0)} icon={<Coins className="h-5 w-5 text-amber-300" />} />
        <StatCard label="Wallet total" value={formatCurrency(data?.walletTotal || 0)} icon={<CircleDollarSign className="h-5 w-5 text-emerald-300" />} />
        <StatCard label="Revenue" value={formatCurrency(data?.revenue || 0)} sub="paid invoices" icon={<TrendingUp className="h-5 w-5 text-cyan-300" />} />
        <StatCard label="Pending payments" value={data?.pendingInvoices ?? 0} icon={<CreditCard className="h-5 w-5 text-amber-300" />} onClick={() => { window.location.href = "/admin/payments"; }} />
        <StatCard label="Open tickets" value={data?.openTickets ?? 0} icon={<Ticket className="h-5 w-5 text-rose-300" />} onClick={() => { window.location.href = "/admin/tickets"; }} />
        <StatCard label="New today" value={data?.newUsersToday ?? 0} icon={<UserPlus className="h-5 w-5 text-violet-300" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent users" actions={<Link href="/admin/users" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>}>
          <div className="space-y-2.5">
            {data?.recent?.map((u) => (
              <Link key={u.id} href={`/admin/users?q=${u.id}`} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:border-violet-400/25">
                <Avatar src={u.avatar} name={u.username} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-200">{u.username}</p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <Badge color="amber">{formatCoins(u.coins)} AKF</Badge>
                <span className="text-[11px] text-slate-600">{timeAgo(u.createdAt)}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Recent servers" actions={<Link href="/admin/servers" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>}>
          <div className="space-y-2.5">
            {data?.recentServers?.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300"><Server className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-200">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">{s.user.username} · {s.eggName || "Custom"} · {timeAgo(s.createdAt)}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
