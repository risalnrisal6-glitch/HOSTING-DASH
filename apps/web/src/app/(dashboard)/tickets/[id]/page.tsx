"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Send, Paperclip, Lock, X, CheckCircle2, RotateCcw } from "lucide-react";
import { get, post, uploadFile } from "@/lib/api";
import { Card, Button, Badge, Textarea, StatusBadge, ConfirmDialog } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/lib/auth";
import type { Ticket, TicketMessage } from "@/lib/types";
import { formatDate, cn } from "@/lib/format";

export default function TicketThreadPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const isStaff = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR");
  const { data: ticket, mutate } = useSWR<Ticket>(`/tickets/${params.id}`, (url: string) => get(url));
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await post(`/tickets/${params.id}/reply`, { body, attachments, isInternal: internal });
      setBody("");
      setAttachments([]);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: string) => {
    try {
      await post(`/tickets/${params.id}/status`, { status });
      toast.success(status === "closed" ? "Ticket closed" : "Ticket reopened");
      setConfirmClose(false);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!ticket) return <div className="glass h-96 animate-pulse" />;

  const messages: TicketMessage[] = (ticket.messages || []).filter((m) => !m.isInternal || isStaff);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">{ticket.subject}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge color="slate">{ticket.category}</Badge>
            <Badge color="violet">{ticket.priority}</Badge>
            <StatusBadge status={ticket.status} />
            <span>Created {formatDate(ticket.createdAt)}</span>
          </div>
        </div>
        {ticket.status === "closed" ? (
          <Button variant="secondary" size="sm" onClick={() => setStatus("open")} icon={<RotateCcw className="h-3.5 w-3.5" />}>Reopen</Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirmClose(true)} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Close ticket</Button>
        )}
      </div>

      {/* Thread */}
      <Card bodyClassName="p-0">
        <div className="space-y-0">
          {messages.map((m, i) => {
            const mine = m.userId === user?.id;
            return (
              <div key={m.id} className={cn("flex gap-3 border-b border-white/[0.04] p-4 sm:p-5", m.isInternal && "bg-amber-500/[0.04]")}>
                <Avatar src={mine ? user?.avatar : undefined} name={m.userId === user?.id ? user?.username || "You" : ticket.user?.username || "Staff"} size={36} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">
                      {mine ? user?.username : m.isStaff ? (isStaff ? "Support Staff" : ticket.user?.username || "Support Staff") : ticket.user?.username || "You"}
                    </span>
                    {m.isStaff && <Badge color="violet">Staff</Badge>}
                    {m.isInternal && <Badge color="amber"><Lock className="mr-1 h-2.5 w-2.5" />Internal</Badge>}
                    <span className="text-[11px] text-slate-600">{formatDate(m.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{m.body}</p>
                  {JSON.parse(m.attachments || "[]").length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {JSON.parse(m.attachments).map((a: any, idx: number) => (
                        <a key={idx} href={a.url} target="_blank" className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-violet-300 hover:bg-white/[0.06]">
                          <Paperclip className="h-3 w-3" />{a.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {messages.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No messages yet.</p>}
        </div>
      </Card>

      {/* Reply */}
      <Card title={ticket.status === "closed" ? "Ticket closed" : "Write a reply"} subtitle={isStaff ? "Staff view — you can post internal notes" : undefined}>
        {ticket.status === "closed" ? (
          <p className="text-sm text-slate-500">This ticket is closed. Reopen it to continue the conversation.</p>
        ) : (
          <div className="space-y-3">
            <Textarea placeholder="Type your message..." rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
                <Paperclip className="h-3.5 w-3.5" /> Attach
                <input type="file" multiple className="hidden" onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  const fd = new FormData();
                  files.forEach((f) => fd.append("files", f));
                  try {
                    const saved = await uploadFile<{ name: string; url: string }[]>("/tickets/upload", fd);
                    setAttachments((a) => [...a, ...saved]);
                  } catch (err: any) { toast.error(err.message); }
                }} />
              </label>
              {attachments.map((a, i) => (
                <span key={i} className="flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-300">
                  {a.name}
                  <button onClick={() => setAttachments((l) => l.filter((_, idx) => idx !== i))}><X className="h-3 w-3 text-slate-500 hover:text-rose-400" /></button>
                </span>
              ))}
              {isStaff && (
                <button onClick={() => setInternal(!internal)} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition", internal ? "border-amber-400/50 bg-amber-500/10 text-amber-300" : "border-white/[0.08] text-slate-500 hover:text-slate-300")}>
                  <Lock className="h-3 w-3" /> Internal note
                </button>
              )}
              <Button onClick={send} loading={sending} className="ml-auto" icon={<Send className="h-4 w-4" />}>Send</Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} onConfirm={() => setStatus("closed")} title="Close this ticket?" description="You can reopen it later if needed." confirmText="Close ticket" />
    </div>
  );
}
