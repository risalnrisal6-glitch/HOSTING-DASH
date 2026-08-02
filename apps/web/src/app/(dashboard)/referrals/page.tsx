"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { toast } from "sonner";
import { Gift, Copy, Check, Trophy, Users, Coins, Share2, Link as LinkIcon } from "lucide-react";
import { get } from "@/lib/api";
import { Card, Button, Badge, Skeleton } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { formatCoins, timeAgo } from "@/lib/format";

interface ReferralStats {
  code: string;
  link: string;
  invitedBy: string | null;
  count: number;
  paid: number;
  totalEarned: number;
  recent: { id: string; referred: { username: string; avatar: string | null; createdAt: string } }[];
  config: { referrer?: number; referred?: number } | null;
}
interface LeaderRow { rank: number; username: string; avatar: string | null; count: number; totalEarned: number }

export default function ReferralsPage() {
  const { data: stats } = useSWR<ReferralStats>("/wallet/referral", (url: string) => get(url));
  const { data: leaderboard } = useSWR<LeaderRow[]>("/wallet/leaderboard", (url: string) => get(url));
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!stats?.link) return;
    await navigator.clipboard.writeText(stats.link);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (!stats?.link) return;
    if (navigator.share) {
      await navigator.share({ title: "Join NOVA PANEL", text: "Deploy servers in seconds — sign up with my referral link!", url: stats.link }).catch(() => undefined);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Join NOVA PANEL and get bonus AKF coins: ${stats.link}`)}`, "_blank");
    }
  };

  if (!stats) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">Referral program</h1>
        <p className="mt-1 text-sm text-slate-500">Invite friends — you both earn AKF coins.</p>
      </div>

      {/* Hero card */}
      <Card className="relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-blue-500/25 text-violet-300"><Gift className="h-5 w-5" /></div>
              <div>
                <p className="font-display text-lg font-bold text-slate-100">Earn {formatCoins(stats.config?.referrer || 50)} AKF per friend</p>
                <p className="text-xs text-slate-500">Your friend gets {formatCoins(stats.config?.referred || 25)} AKF as a welcome bonus</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <code className="rounded-xl border border-dashed border-violet-400/40 bg-violet-500/10 px-4 py-2.5 font-mono text-lg font-bold text-violet-300">{stats.code}</code>
              <Button onClick={copy} variant="secondary" icon={copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}>{copied ? "Copied!" : "Copy link"}</Button>
              <Button onClick={share} icon={<Share2 className="h-4 w-4" />}>Share</Button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
              <LinkIcon className="h-3.5 w-3.5" />
              <span className="truncate font-mono">{stats.link}</span>
            </div>
            {stats.invitedBy && <p className="mt-3 text-xs text-slate-500">You were invited by <strong className="text-slate-300">{stats.invitedBy}</strong></p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatBox icon={<Users className="h-4 w-4" />} label="Invited" value={stats.count} />
            <StatBox icon={<Coins className="h-4 w-4" />} label="Earned" value={formatCoins(stats.totalEarned)} />
            <StatBox icon={<Check className="h-4 w-4" />} label="Rewarded" value={stats.paid} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent referrals */}
        <Card title="Recent referrals" subtitle="Friends who joined through your link">
          {stats.recent.length ? (
            <div className="space-y-2.5">
              {stats.recent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                  <Avatar src={r.referred.avatar} name={r.referred.username} size={34} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{r.referred.username}</p>
                    <p className="text-[11px] text-slate-600">Joined {timeAgo(r.referred.createdAt)}</p>
                  </div>
                  <Badge color="amber">+{formatCoins(stats.config?.referrer || 50)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No referrals yet — share your link to get started!</p>
          )}
        </Card>

        {/* Leaderboard */}
        <Card title="Top referrers" subtitle="Leaderboard" actions={<Trophy className="h-4 w-4 text-amber-300" />}>
          {leaderboard?.length ? (
            <div className="space-y-1">
              {leaderboard.map((row) => (
                <div key={row.rank} className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/[0.03]">
                  <span className={row.rank <= 3 ? "font-display text-sm font-bold text-amber-300" : "w-4 text-center font-mono text-sm text-slate-600"}>{row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}</span>
                  <Avatar src={row.avatar} name={row.username} size={28} />
                  <span className="flex-1 truncate text-sm text-slate-300">{row.username}</span>
                  <span className="text-xs text-slate-500">{row.count} invites</span>
                  <Badge color="violet">{formatCoins(row.totalEarned)} AKF</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Be the first on the leaderboard!</p>
          )}
        </Card>
      </div>
    </motion.div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">{icon}</div>
      <p className="mt-2 font-display text-xl font-bold text-slate-100">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
    </div>
  );
}
