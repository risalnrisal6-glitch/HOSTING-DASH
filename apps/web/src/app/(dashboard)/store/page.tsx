"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { toast } from "sonner";
import { Zap, Cpu, MemoryStick, HardDrive, Database, Archive, Network, Check, Rocket } from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, Badge, Modal, Input, Skeleton } from "@/components/ui";
import type { Plan } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/format";

const cycles = [
  { id: "one_time", label: "One-time" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly", tag: "-15%" },
  { id: "lifetime", label: "Lifetime" },
];

export default function StorePage() {
  const { data: plans, isLoading } = useSWR<Plan[]>("/store/plans", (url: string) => get(url));
  const [cycle, setCycle] = useState("monthly");
  const [buying, setBuying] = useState<Plan | null>(null);
  const [promo, setPromo] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: user, mutate } = useSWR("/users/me", (url: string) => get(url));

  const priceFor = (plan: Plan) => {
    if (cycle === "yearly") return plan.price * 12 * 0.85;
    if (cycle === "one_time" || cycle === "lifetime") return plan.price;
    return plan.price;
  };

  const startPurchase = async () => {
    if (!buying) return;
    setCreating(true);
    try {
      const invoice = await post<{ id: string }>("/store/plan/invoice", { planId: buying.id, cycle, promoCode: promo || undefined });
      toast.success("Invoice created");
      window.location.href = `/billing?pay=${invoice.id}`;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const featureIcons = [MemoryStick, Cpu, HardDrive, Database, Archive, Network];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Server plans</h1>
          <p className="mt-1 text-sm text-slate-500">Pick a plan — the server is deployed automatically after payment.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {cycles.map((c) => (
            <button key={c.id} onClick={() => setCycle(c.id)} className={cn("relative rounded-lg px-3 py-1.5 text-xs font-medium transition", cycle === c.id ? "text-white" : "text-slate-400 hover:text-slate-200")}>
              {cycle === c.id && <motion.span layoutId="cycle-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-600/80 to-blue-600/80" />}
              <span className="relative z-10 flex items-center gap-1">{c.label}{c.tag && <Badge color="emerald">{c.tag}</Badge>}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80" />)}</div>}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans?.map((plan, i) => {
          const featured = i === 2;
          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="relative">
              {featured && (
                <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                  <Badge color="violet" className="bg-gradient-to-r from-violet-600 to-blue-600 border-transparent px-3 py-1 text-white">MOST POPULAR</Badge>
                </div>
              )}
              <Card className={cn("glass-hover relative h-full p-6", featured && "border-violet-400/40 shadow-glow")}>
                <div className="flex items-center gap-2">
                  <Zap className={cn("h-5 w-5", featured ? "text-violet-400" : "text-slate-500")} />
                  <h3 className="font-display text-lg font-bold text-slate-100">{plan.name}</h3>
                </div>
                <p className="mt-1 min-h-8 text-xs text-slate-500">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-gradient">{formatCurrency(priceFor(plan))}</span>
                  <span className="text-xs text-slate-500">/ {cycle === "one_time" ? "once" : cycle}</span>
                </div>
                {cycle === "yearly" && <p className="mt-1 text-[11px] text-emerald-400">Save 15% with yearly billing</p>}

                <div className="mt-5 space-y-2.5">
                  {[
                    [MemoryStick, `${plan.ram} MB RAM`],
                    [Cpu, `${plan.cpu}% CPU`],
                    [HardDrive, `${plan.disk} MB Disk`],
                    [Database, `${plan.databases} Database${plan.databases !== 1 ? "s" : ""}`],
                    [Archive, `${plan.backups} Backup${plan.backups !== 1 ? "s" : ""}`],
                    [Network, `${plan.allocations} Allocation${plan.allocations !== 1 ? "s" : ""}`],
                  ].map(([Icon, label]: any, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <Icon className="h-4 w-4 text-slate-500" /> {label}
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => setBuying(plan)}
                  className={cn("mt-6 w-full", featured && "")}
                  variant={featured ? "primary" : "secondary"}
                  icon={<Rocket className="h-4 w-4" />}
                >
                  Deploy {plan.name}
                </Button>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Purchase modal */}
      <Modal open={!!buying} onClose={() => setBuying(null)} title={`Deploy ${buying?.name}`}>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Plan</span>
              <span className="font-semibold text-slate-200">{buying?.name} ({cycle})</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-slate-400">Price</span>
              <span className="font-display text-lg font-bold text-gradient">{buying && formatCurrency(priceFor(buying))}</span>
            </div>
          </div>
          <Input label="Promo code (optional)" placeholder="NOVALAUNCH" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
          <Button onClick={startPurchase} loading={creating} className="w-full" icon={<Rocket className="h-4 w-4" />}>Continue to payment</Button>
          <p className="text-center text-[11px] text-slate-600">Your server deploys instantly once the invoice is paid.</p>
        </div>
      </Modal>
    </motion.div>
  );
}
