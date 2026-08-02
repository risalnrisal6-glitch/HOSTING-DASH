"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Send, Paperclip, X } from "lucide-react";
import { get, post, uploadFile } from "@/lib/api";
import { Card, Button, Input, Select, Textarea, Badge } from "@/components/ui";

export default function NewTicketPage() {
  const router = useRouter();
  const { data: config } = useSWR<{ settings: Record<string, any> }>("/public/config", (url: string) => get(url));
  const categories = config?.settings?.ticket_categories || ["General", "Billing", "Technical Support"];
  const [form, setForm] = useState({ subject: "", category: categories[0] || "General", priority: "medium", body: "" });
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const saved = await uploadFile<{ name: string; url: string }[]>("/tickets/upload", formData);
      setAttachments((a) => [...a, ...saved]);
      toast.success("Attachments uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = async () => {
    if (!form.subject.trim() || form.body.trim().length < 5) return toast.error("Subject and message are required");
    setSubmitting(true);
    try {
      const ticket = await post<{ id: string }>("/tickets", { ...form, attachments });
      toast.success("Ticket created");
      router.push(`/tickets/${ticket.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">Open a ticket</h1>
        <p className="mt-1 text-sm text-slate-500">Describe your issue and we'll get back to you.</p>
      </div>

      <Card>
        <div className="space-y-4">
          <Input label="Subject" placeholder="Brief summary of your issue" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          <Textarea label="Message" placeholder="Describe your issue in detail — include error messages if any..." rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />

          {/* Attachments */}
          <div>
            <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-400">
              <Paperclip className="h-3.5 w-3.5" /> Attach files {uploading && "(uploading...)"}
              <input type="file" multiple className="hidden" onChange={onUpload} />
            </label>
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300">
                    {a.name}
                    <button onClick={() => setAttachments((list) => list.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-rose-400"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button onClick={submit} loading={submitting} className="w-full" icon={<Send className="h-4 w-4" />}>Submit ticket</Button>
        </div>
      </Card>
    </div>
  );
}
