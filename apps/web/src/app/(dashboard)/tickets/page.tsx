"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Ticket as TicketIcon, Plus, MessageSquare } from "lucide-react";
import { get } from "@/lib/api";
import { Card, Button, EmptyState, StatusBadge, Badge, Pagination } from "@/components/ui";
import type { Ticket } from "@/lib/types";
import { timeAgo, cn } from "@/lib/format";

const priorityColors: Record<string, string> = { low: "slate", medium: "blue", high: "amber", urgent: "red" };

export default function TicketsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const { data } = useSWR<{ items: Ticket[]; pages: number; page: number }>(`/tickets?page=${page}&status=${status}`, (url: string) => get(url));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Support tickets</h1>
          <p className="mt-1 text-sm text-slate-500">We usually reply within a few hours.</p>
        </div>
        <Link href="/tickets/new"><Button icon={<Plus className="h-4 w-4" />}>New ticket</Button></Link>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {[{ id: "all", label: "All" }, { id: "open", label: "Open" }, { id: "answered", label: "Answered" }, { id: "closed", label: "Closed" }].map((s) => (
          <button key={s.id} onClick={() => { setStatus(s.id); setPage(1); }} className={cn("flex-1 rounded-lg px-4 py-1.5 text-xs font-medium transition", status === s.id ? "bg-gradient-to-r from-violet-600/80 to-blue-600/80 text-white" : "text-slate-400 hover:text-slate-200")}>
            {s.label}
          </button>
        ))}
      </div>

      <Card>
        {!data?.items?.length ? (
          <EmptyState icon={<TicketIcon className="h-6 w-6" />} title="No tickets found" description="Need help? Open a ticket and our team will assist you." action={<Link href="/tickets/new"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Open a ticket</Button></Link>} />
        ) : (
          <div className="space-y-2.5">
            {data.items.map((t) => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-violet-400/30 hover:bg-white/[0.04]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><TicketIcon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-200">{t.subject}</p>
                    <Badge color={priorityColors[t.priority]}>{t.priority}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">{t.category} · {t.messages?.[0]?.body ? <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {timeAgo(t.updatedAt)}</span> : timeAgo(t.updatedAt)}</p>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      </Card>
    </div>
  );
}
