"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Receipt, Plus, CreditCard, Coins, Wallet as WalletIcon, Landmark, Bitcoin, ArrowUpDown, Undo2 } from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, Badge, Modal, Input, EmptyState, StatusBadge, Tabs } from "@/components/ui";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/format";

interface Gateway { id: string; name: string; enabled: boolean; hint?: string }

const gatewayIcons: Record<string, any> = { akf: Coins, wallet: WalletIcon, manual: Landmark, upi: Landmark, stripe: CreditCard, paypal: CreditCard, razorpay: CreditCard, crypto: Bitcoin };

function BillingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState("invoices");
  const { data: invoices, mutate } = useSWR<{ items: Invoice[] }>("/billing/invoices?limit=20", (url: string) => get(url));
  const { data: gateways } = useSWR<Gateway[]>("/billing/gateways", (url: string) => get(url));
  const { data: tx } = useSWR("/billing/transactions?limit=15", (url: string) => get(url));
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState(10);
  const [refundFor, setRefundFor] = useState<Invoice | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Auto-open pay modal from store redirect (?pay=invoiceId)
  useEffect(() => {
    const payId = params.get("pay");
    if (payId && invoices?.items) {
      const inv = invoices.items.find((i) => i.id === payId);
      if (inv && inv.status === "pending") setPaying(inv);
      router.replace("/billing");
    }
  }, [params, invoices, router]);

  const pay = async (gateway: string) => {
    if (!paying) return;
    setBusy(true);
    try {
      const result = await post<Invoice>(`/billing/invoices/${paying.id}/pay`, { gateway });
      if (result.status === "paid") toast.success("Payment successful!");
      else toast.success(`Payment submitted via ${gateway} — awaiting confirmation`);
      setPaying(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const topup = async () => {
    setBusy(true);
    try {
      const invoice = await post<Invoice>("/billing/topup", { amount: topupAmount });
      setTopupOpen(false);
      setPaying(invoice);
      toast.success("Top-up invoice created");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const requestRefund = async () => {
    if (!refundFor || refundReason.length < 5) return toast.error("Please provide a reason (min 5 chars)");
    setBusy(true);
    try {
      await post("/billing/refunds", { invoiceId: refundFor.id, reason: refundReason });
      toast.success("Refund request submitted");
      setRefundFor(null);
      setRefundReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const itemsOf = (inv: Invoice) => {
    try { return JSON.parse(inv.items); } catch { return []; }
  };

  const tabs = [
    { id: "invoices", label: "Invoices" },
    { id: "transactions", label: "Transactions" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">Invoices, payments and refunds.</p>
        </div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === "invoices" && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setTopupOpen(true)} icon={<Plus className="h-4 w-4" />}>Top up balance</Button>
          </div>
          <Card title="Invoices" subtitle="All your orders">
            {!invoices?.items?.length ? (
              <EmptyState icon={<Receipt className="h-6 w-6" />} title="No invoices yet" description="Plan purchases and top-ups will appear here." />
            ) : (
              <div className="space-y-2.5">
                {invoices.items.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Receipt className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-200">{inv.description || inv.number}</p>
                      <p className="text-xs text-slate-500">{inv.number} · {formatDate(inv.createdAt)}{inv.gateway ? ` · ${inv.gateway}` : ""}</p>
                    </div>
                    {inv.discount > 0 && <Badge color="emerald">−{formatCurrency(inv.discount)}</Badge>}
                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-slate-100">{formatCurrency(inv.amount)}</p>
                      <StatusBadge status={inv.status} />
                    </div>
                    {inv.status === "pending" && (
                      <Button size="sm" onClick={() => setPaying(inv)}>Pay now</Button>
                    )}
                    {inv.status === "paid" && (
                      <Button size="sm" variant="secondary" onClick={() => setRefundFor(inv)} icon={<Undo2 className="h-3.5 w-3.5" />}>Refund</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "transactions" && (
        <Card title="Payment history" subtitle="Wallet & AKF transactions">
          {tx?.items?.length ? (
            <div className="space-y-2">
              {tx.items.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", t.kind === "credit" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">{t.description}</p>
                    <p className="text-[11px] text-slate-600">{formatDate(t.createdAt)}</p>
                  </div>
                  <span className={cn("font-mono text-sm font-semibold", t.kind === "credit" ? "text-emerald-400" : "text-rose-400")}>
                    {t.kind === "credit" ? "+" : "−"}{t.currency === "AKF" ? `${t.amount} AKF` : formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<ArrowUpDown className="h-6 w-6" />} title="No transactions" />
          )}
        </Card>
      )}

      {/* Top-up modal */}
      <Modal open={topupOpen} onClose={() => setTopupOpen(false)} title="Top up wallet balance">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 25, 50, 100, 250].map((a) => (
              <button key={a} onClick={() => setTopupAmount(a)} className={cn("rounded-xl border py-3 text-sm font-semibold transition", topupAmount === a ? "border-violet-400/60 bg-violet-500/10 text-violet-200" : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-violet-400/30")}>
                ${a}
              </button>
            ))}
          </div>
          <Input type="number" label="Custom amount" value={topupAmount} onChange={(e) => setTopupAmount(Number(e.target.value))} min={1} max={5000} />
          <Button onClick={topup} loading={busy} className="w-full">Create top-up invoice</Button>
        </div>
      </Modal>

      {/* Pay modal */}
      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Pay ${paying?.number}`}>
        <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div>
            <p className="text-xs text-slate-500">{paying?.description}</p>
            <p className="text-[11px] text-slate-600">Items: {itemsOf(paying!).map((i: any) => i.label).join(", ")}</p>
          </div>
          <span className="font-display text-2xl font-bold text-gradient">{formatCurrency(paying?.amount || 0)}</span>
        </div>
        <div className="space-y-2">
          {gateways?.filter((g) => g.enabled).map((g) => {
            const Icon = gatewayIcons[g.id] || CreditCard;
            return (
              <button key={g.id} onClick={() => pay(g.id)} disabled={busy} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-violet-400/40 hover:bg-white/[0.05] disabled:opacity-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 text-violet-300"><Icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200">{g.name}</p>
                  {g.hint && <p className="text-[11px] text-slate-500">{g.hint}</p>}
                </div>
                <Badge color={g.id === "akf" || g.id === "wallet" ? "green" : "slate"}>{g.id === "akf" || g.id === "wallet" ? "Instant" : "Manual"}</Badge>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-600">Stripe, PayPal, Razorpay, UPI & Crypto require gateway credentials in Admin → Settings.</p>
      </Modal>

      {/* Refund modal */}
      <Modal open={!!refundFor} onClose={() => setRefundFor(null)} title="Request refund">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Requesting refund for <strong>{refundFor?.number}</strong> ({formatCurrency(refundFor?.amount || 0)}).</p>
          <Input label="Reason" placeholder="Why do you want a refund?" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <Button onClick={requestRefund} loading={busy} className="w-full">Submit request</Button>
        </div>
      </Modal>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}
