"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Check, X, CreditCard, Undo2, Search } from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, Badge, Pagination, EmptyState, StatusBadge, Modal, Textarea, Tabs } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/format";

interface Invoice { id: string; number: string; amount: number; status: string; gateway: string | null; description: string | null; createdAt: string; user: { username: string; email: string } }
interface Refund { id: string; reason: string; status: string; createdAt: string; invoice: { number: string; amount: number; user: { username: string } } }

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState("invoices");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const { data: invoices, mutate } = useSWR<{ items: Invoice[]; pages: number; page: number }>(`/admin/payments?page=${page}&status=${status}`, (url: string) => get(url));
  const { data: refunds, mutate: mutateRefunds } = useSWR<{ items: Refund[]; pages: number }>("/admin/refunds?limit=50", (url: string) => get(url));
  const [refusing, setRefusing] = useState<Invoice | null>(null);
  const [note, setNote] = useState("");

  const approve = async (id: string) => {
    try {
      await post(`/admin/payments/${id}/approve`, {});
      toast.success("Payment approved — invoice marked paid");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const refuse = async () => {
    if (!refusing) return;
    try {
      await post(`/admin/payments/${refusing.id}/refuse`, { note });
      toast.success("Payment refused");
      setRefusing(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resolveRefund = async (id: string, approve: boolean) => {
    try {
      await post(`/admin/refunds/${id}/resolve`, { approve, note: "" });
      toast.success(approve ? "Refund approved" : "Refund rejected");
      mutateRefunds();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const tabs = [
    { id: "invoices", label: "Invoices" },
    { id: "refunds", label: "Refund requests" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === "invoices" && (
          <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {[{ id: "all", label: "All" }, { id: "pending", label: "Pending" }, { id: "paid", label: "Paid" }, { id: "refunded", label: "Refunded" }, { id: "cancelled", label: "Cancelled" }].map((s) => (
              <button key={s.id} onClick={() => { setStatus(s.id); setPage(1); }} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", status === s.id ? "bg-gradient-to-r from-violet-600/80 to-blue-600/80 text-white" : "text-slate-400 hover:text-slate-200")}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "invoices" && (
        <Card bodyClassName="p-0">
          {!invoices?.items?.length ? (
            <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No invoices" />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600">
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Gateway</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.items.map((inv) => (
                    <tr key={inv.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.03]">
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{inv.number}</td>
                      <td className="px-3 py-3">
                        <p className="text-slate-300">{inv.user.username}</p>
                        <p className="text-[11px] text-slate-500">{inv.user.email}</p>
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-slate-200">{formatCurrency(inv.amount)}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{inv.gateway || "—"}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{formatDate(inv.createdAt)}</td>
                      <td className="px-3 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          {inv.status === "pending" && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => approve(inv.id)} icon={<Check className="h-3.5 w-3.5 text-emerald-400" />}>Approve</Button>
                              <Button variant="ghost" size="sm" onClick={() => setRefusing(inv)} icon={<X className="h-3.5 w-3.5 text-rose-400" />} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {invoices && <div className="p-3"><Pagination page={invoices.page} pages={invoices.pages} onChange={setPage} /></div>}
        </Card>
      )}

      {tab === "refunds" && (
        <Card>
          <div className="space-y-2.5">
            {!refunds?.items?.length && <EmptyState icon={<Undo2 className="h-6 w-6" />} title="No refund requests" />}
            {refunds?.items?.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-300"><Undo2 className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200">{r.invoice.user.username} — {r.invoice.number}</p>
                  <p className="text-xs text-slate-500">{r.reason}</p>
                </div>
                <Badge color="amber">{formatCurrency(r.invoice.amount)}</Badge>
                <StatusBadge status={r.status} />
                {r.status === "pending" && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => resolveRefund(r.id, true)} icon={<Check className="h-3.5 w-3.5 text-emerald-400" />}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => resolveRefund(r.id, false)} icon={<X className="h-3.5 w-3.5 text-rose-400" />} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!refusing} onClose={() => setRefusing(null)} title="Refuse payment">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Refuse <strong>{refusing?.number}</strong> ({formatCurrency(refusing?.amount || 0)})?</p>
          <Textarea label="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="danger" onClick={refuse} className="w-full">Refuse payment</Button>
        </div>
      </Modal>
    </div>
  );
}
