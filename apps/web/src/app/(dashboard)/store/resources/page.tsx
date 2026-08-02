"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { toast } from "sonner";
import { MemoryStick, Cpu, HardDrive, Database, Archive, Network, Server as ServerIcon, Coins, ShoppingCart } from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, Badge, Modal, Select, Skeleton } from "@/components/ui";
import type { ShopItem, Server } from "@/lib/types";
import { formatCoins, formatMB, cn } from "@/lib/format";

const icons: Record<string, any> = { ram: MemoryStick, cpu: Cpu, disk: HardDrive, databases: Database, backups: Archive, allocations: Network, slots: ServerIcon };

export default function ResourceShopPage() {
  const { data: items, isLoading } = useSWR<ShopItem[]>("/store/shop", (url: string) => get(url));
  const { data: servers } = useSWR<Server[]>("/servers", (url: string) => get(url));
  const { data: user, mutate } = useSWR("/users/me", (url: string) => get(url));
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [units, setUnits] = useState(1);
  const [serverId, setServerId] = useState("");
  const [processing, setProcessing] = useState(false);

  const startBuy = (item: ShopItem) => {
    setBuying(item);
    setUnits(item.minUnits);
    setServerId(item.type === "slots" ? "" : servers?.[0]?.id || "");
  };

  const total = buying ? Math.round(buying.effectivePrice * units * 100) / 100 : 0;

  const confirm = async () => {
    if (!buying) return;
    setProcessing(true);
    try {
      const result = await post(`/store/shop/purchase`, { type: buying.type, units, serverId: serverId || undefined });
      toast.success(`Purchased ${units}× ${buying.name} for ${formatCoins(result.total)} AKF`);
      mutate();
      setBuying(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Resource shop</h1>
          <p className="mt-1 text-sm text-slate-500">Spend AKF coins to upgrade resources instantly — applied live via the panel.</p>
        </div>
        <Badge color="amber" className="px-3 py-1.5 text-sm"><Coins className="mr-1 h-4 w-4" />{formatCoins(user?.coins || 0)} AKF</Badge>
      </div>

      {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-44" />)}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items?.map((item, i) => {
          const Icon = icons[item.type] || ServerIcon;
          return (
            <motion.div key={item.type} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="glass-hover h-full p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 text-violet-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  {item.discount > 0 && <Badge color="emerald">-{item.discount}%</Badge>}
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-slate-100">{item.name}</h3>
                <p className="text-xs text-slate-500">per {item.unit}</p>
                <div className="mt-3 flex items-center gap-2">
                  {item.discount > 0 && <span className="text-sm text-slate-600 line-through">{item.price} AKF</span>}
                  <span className="font-display text-xl font-bold text-amber-300">{item.effectivePrice} AKF</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">{item.stock === -1 ? "Unlimited stock" : `${item.stock} in stock`} · max {item.maxPerUser}/user</p>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => startBuy(item)} icon={<ShoppingCart className="h-4 w-4" />}>Buy now</Button>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Buy modal */}
      <Modal open={!!buying} onClose={() => setBuying(null)} title={`Buy ${buying?.name}`}>
        {buying && (
          <div className="space-y-4">
            {buying.type !== "slots" && (
              <Select label="Target server" value={serverId} onChange={(e) => setServerId(e.target.value)}>
                {servers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                {!servers?.length && <option value="">No servers available</option>}
              </Select>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Quantity ({buying.unit})</label>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" disabled={units <= buying.minUnits} onClick={() => setUnits(Math.max(buying.minUnits, units - 1))}>−</Button>
                <input type="number" min={buying.minUnits} max={buying.maxPerUser} value={units} onChange={(e) => setUnits(Math.min(buying.maxPerUser, Math.max(buying.minUnits, Number(e.target.value) || 1)))} className="input-base w-24 text-center" />
                <Button variant="secondary" size="sm" disabled={units >= buying.maxPerUser} onClick={() => setUnits(Math.min(buying.maxPerUser, units + 1))}>+</Button>
              </div>
              {buying.type === "ram" && <p className="mt-1 text-[11px] text-slate-600">+{units * 256} MB RAM</p>}
              {buying.type === "cpu" && <p className="mt-1 text-[11px] text-slate-600">+{units * 10}% CPU</p>}
              {buying.type === "disk" && <p className="mt-1 text-[11px] text-slate-600">+{units} GB Disk</p>}
              {buying.type === "slots" && <p className="mt-1 text-[11px] text-slate-600">+{units} server slot{units > 1 ? "s" : ""} on your account</p>}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <span className="text-sm text-slate-400">Total</span>
              <span className="font-display text-xl font-bold text-amber-300">{formatCoins(total)} AKF</span>
            </div>
            <Button onClick={confirm} loading={processing} className="w-full" disabled={buying.type !== "slots" && !serverId}>
              <Coins className="mr-1 h-4 w-4" /> Pay {formatCoins(total)} AKF
            </Button>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
