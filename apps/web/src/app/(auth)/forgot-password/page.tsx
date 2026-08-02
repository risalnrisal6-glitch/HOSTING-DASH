"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Input } from "@/components/ui";
import { post } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure reset link">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <p className="text-sm text-slate-300">If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
          <p className="text-xs text-slate-500">Check your inbox (and spam folder). The link expires in 24 hours.</p>
          <Link href="/login" className="mt-2 text-sm font-medium text-violet-400 hover:text-violet-300">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" size="lg" loading={loading} className="w-full">Send reset link</Button>
          <p className="text-center text-sm text-slate-500">
            Remembered it? <Link href="/login" className="text-violet-400 hover:text-violet-300">Sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
