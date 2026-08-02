"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search, Ticket as TicketIcon } from "lucide-react";
import { get } from "@/lib/api";
import { Card, Button, Badge, EmptyState, Pagination, StatusBadge } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import type { Ticket } from "@/lib/types";
import { timeAgo, cn } from "@/lib/format";

const priorityColors: Record<string, string> = { low: "slate", medium: "blue", high: "amber", urgent: "red" };

export default function AdminTicketsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const { data } = useSWR<{ items: (Ticket & { user?: { username: string; avatar: string | null } })[], pages: number; page: number }>(
    `/admin/tickets?page=${page}&status=${status}`,
    (url: string) => get(url)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {[{ id: "all", label: "All" }, { id: "open", label: "Open" }, { id: "answered", label: "Answered" }, { id: "closed", label: "Closed" }].map((s) => (
            <button key={s.id} onClick={() => { setStatus(s.id); setPage(1); }} className={cn("rounded-lg px-4 py-1.5 text-xs font-medium transition", status === s.id ? "bg-gradient-to-r from-violet-600/80 to-blue-600/80 text-white" : "text-slate-400 hover:text-slate-200")}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card bodyClassName="p-0">
        {!data?.items?.length ? (
          <EmptyState icon={<TicketIcon className="h-6 w-6" />} title="No tickets" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <Link href={`/tickets/${t.id}`} className="font-semibold text-slate-200 hover:text-violet-300">{t.subject}</Link>
                      {t.internalNote && <p className="mt-0.5 max-w-xs truncate text-[11px] text-amber-400/80">📝 {t.internalNote}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={t.user?.avatar} name={t.user?.username || "?"} size={26} />
                        <span className="text-slate-300">{t.user?.username}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">{t.category}</td>
                    <td className="px-3 py-3"><Badge color={priorityColors[t.priority]}>{t.priority}</Badge></td>
                    <td className="px-3 py-3 text-xs text-slate-500">{timeAgo(t.updatedAt)}</td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="p-3"><Pagination page={data.page} pages={data.pages} onChange={setPage} /></div>}
      </Card>
    </div>
  );
}
