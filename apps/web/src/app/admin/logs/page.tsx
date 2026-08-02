"use client";

import { useState } from "react";
import useSWR from "swr";
import { Search, ScrollText } from "lucide-react";
import { get } from "@/lib/api";
import { Card, Badge, Pagination, EmptyState } from "@/components/ui";
import { formatDate, cn } from "@/lib/format";

interface Log { id: string; username: string | null; action: string; entity: string | null; entityId: string | null; meta: string; ip: string | null; createdAt: string }

const actionColors: Record<string, string> = {
  "auth.login": "blue", "auth.register": "blue", "auth.oauth.discord": "blue", "auth.oauth.google": "blue",
  "server.create": "green", "server.delete": "red", "server.power.start": "green", "server.power.kill": "red",
  "billing.pay": "emerald", "admin.payment.approve": "emerald", "admin.user.ban": "red", "admin.user.role": "violet",
  "wallet.checkin.daily": "amber", "wallet.spin": "amber", "store.purchase": "amber",
};

export default function AdminLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data } = useSWR<{ items: Log[]; pages: number; page: number }>(`/admin/logs?page=${page}&search=${encodeURIComponent(search)}`, (url: string) => get(url));

  return (
    <div className="space-y-5">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search logs..." className="input-base pl-9" />
      </div>

      <Card bodyClassName="p-0">
        {!data?.items?.length ? (
          <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No log entries" description="Actions across the platform are recorded here." />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Entity</th>
                  <th className="px-3 py-3">Details</th>
                  <th className="px-5 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-slate-500">{formatDate(l.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-300">{l.username || "—"}</td>
                    <td className="px-3 py-3"><Badge color={actionColors[l.action] || "slate"}>{l.action}</Badge></td>
                    <td className="px-3 py-3 text-xs text-slate-400">{l.entity || "—"}{l.entityId ? ` · ${l.entityId.slice(0, 12)}` : ""}</td>
                    <td className="max-w-[240px] truncate px-3 py-3 font-mono text-[10px] text-slate-600">{l.meta}</td>
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-600">{l.ip || "—"}</td>
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
