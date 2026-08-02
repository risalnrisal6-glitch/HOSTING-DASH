"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Server as ServerIcon, Ban, CheckCircle2 } from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, Badge, Pagination, EmptyState, StatusBadge } from "@/components/ui";
import { formatMB, timeAgo } from "@/lib/format";

interface AdminServer {
  id: string; uuid: string; name: string; status: string; eggName: string | null; createdAt: string; limits: string;
  user: { id: string; username: string; email: string };
}

export default function AdminServersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, mutate } = useSWR<{ items: AdminServer[]; pages: number; page: number }>(`/admin/servers?page=${page}&search=${encodeURIComponent(search)}`, (url: string) => get(url));

  const toggleSuspend = async (s: AdminServer) => {
    const suspend = s.status !== "SUSPENDED";
    try {
      await post(`/admin/servers/${s.id}/suspend`, { suspend });
      toast.success(suspend ? `${s.name} suspended` : `${s.name} re-enabled`);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search servers or owners..." className="input-base pl-9" />
      </div>

      <Card bodyClassName="p-0">
        {!data?.items?.length ? (
          <EmptyState title="No servers found" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="px-5 py-3">Server</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Resources</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => {
                  const limits = JSON.parse(s.limits);
                  return (
                    <tr key={s.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <Link href={`/servers/${s.uuid}`} className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300"><ServerIcon className="h-4 w-4" /></div>
                          <div>
                            <p className="font-semibold text-slate-200 hover:text-violet-300">{s.name}</p>
                            <p className="text-[11px] text-slate-500">{s.eggName || "Custom"}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{s.user.username}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{formatMB(limits.ram)} · {limits.cpu}%</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{timeAgo(s.createdAt)}</td>
                      <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => toggleSuspend(s)}>
                            {s.status === "SUSPENDED" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Ban className="h-4 w-4 text-amber-400" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="p-3"><Pagination page={data.page} pages={data.pages} onChange={setPage} /></div>}
      </Card>
    </div>
  );
}
