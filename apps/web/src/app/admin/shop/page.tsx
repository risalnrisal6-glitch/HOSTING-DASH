"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, Save, Coins } from "lucide-react";
import { get, put } from "@/lib/api";
import { Card, Button, Badge, Input, Toggle } from "@/components/ui";
import type { ShopItem } from "@/lib/types";
import { cn } from "@/lib/format";

export default function AdminShopPage() {
  const { data: items, mutate } = useSWR<ShopItem[]>("/admin/shop", (url: string) => get(url));
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (item: ShopItem, fields: Partial<ShopItem>) => {
    setSaving(item.type);
    try {
      await put(`/admin/shop/${item.type}`, { ...item, ...fields });
      toast.success(`${item.name} updated`);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Configure prices, stock and discounts for the AKF resource shop.</p>

      <div className="grid gap-4 md:grid-cols-2">
        {items?.map((item) => (
          <Card key={item.type} className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><Coins className="h-5 w-5" /></div>
                <div>
                  <p className="font-display text-base font-bold text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-500">per {item.unit}</p>
                </div>
              </div>
              <Toggle checked={item.enabled} onChange={(v) => save(item, { enabled: v })} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Price (AKF)" type="number" value={item.price} onChange={(v) => save(item, { price: Number(v) })} />
              <Field label="Discount %" type="number" value={item.discount} onChange={(v) => save(item, { discount: Number(v) })} />
              <Field label="Max/user" type="number" value={item.maxPerUser} onChange={(v) => save(item, { maxPerUser: Number(v) })} />
              <Field label="Stock (-1 = ∞)" type="number" value={item.stock} onChange={(v) => save(item, { stock: Number(v) })} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge color={item.enabled ? "green" : "slate"}>{item.enabled ? "Enabled" : "Disabled"}</Badge>
              {item.discount > 0 && <Badge color="emerald">-{item.discount}% → {Math.round(item.price * (1 - item.discount / 100) * 100) / 100} AKF</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, type = "text", onChange }: { label: string; value: number | string; type?: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(String(value));
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={local}
          onChange={(e) => { setLocal(e.target.value); setSaved(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange(local);
              setSaved(true);
              setTimeout(() => setSaved(false), 1000);
            }
          }}
          className="input-base !py-1.5 text-xs"
        />
        <button onClick={() => { onChange(local); setSaved(true); setTimeout(() => setSaved(false), 1000); }} className={cn("rounded-lg p-1.5", saved ? "text-emerald-400" : "text-slate-500 hover:text-white")}>
          <Save className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
