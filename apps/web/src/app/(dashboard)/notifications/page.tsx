"use client";

import { useState } from "react";
import useSWR from "swr";
import { Bell, CheckCheck } from "lucide-react";
import { get, post } from "@/lib/api";
import { Card, Button, EmptyState, Pagination, Badge } from "@/components/ui";
import type { Notification } from "@/lib/types";
import { timeAgo, cn } from "@/lib/format";

const typeColors: Record<string, string> = {
  server_created: "green", server_suspended: "red", payment_received: "emerald", resource_upgraded: "blue", ticket_reply: "violet", announcement: "amber", reward: "amber", system: "slate",
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, mutate } = useSWR<{ items: Notification[]; unread: number; pages: number; page: number }>(`/notifications?page=${page}`, (url: string) => get(url));

  const markAll = async () => {
    await post("/notifications/read", {});
    mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">{data?.unread || 0} unread</p>
        </div>
        <Button variant="secondary" size="sm" onClick={markAll} icon={<CheckCheck className="h-4 w-4" />}>Mark all read</Button>
      </div>

      <Card bodyClassName="p-0">
        {!data?.items?.length ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title="You're all caught up" description="Notifications for payments, servers and tickets will appear here." />
        ) : (
          <div>
            {data.items.map((n) => (
              <div key={n.id} className={cn("flex items-start gap-3 border-b border-white/[0.04] p-4 transition", !n.readAt && "bg-violet-500/[0.05]")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-slate-700" : "bg-violet-400")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-200">{n.title}</p>
                    <Badge color={typeColors[n.type] || "slate"}>{n.type.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{n.body}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
            {data && <div className="p-3"><Pagination page={data.page} pages={data.pages} onChange={setPage} /></div>}
          </div>
        )}
      </Card>
    </div>
  );
}
