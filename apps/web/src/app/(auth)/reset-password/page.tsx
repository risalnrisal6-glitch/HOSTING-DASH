"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Input } from "@/components/ui";
import { post } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    if (!token) return toast.error("Missing reset token");
    setLoading(true);
    try {
      await post("/auth/reset-password", { token, password });
      toast.success("Password updated — sign in with your new password");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="New password" type="password" placeholder="Min 8 characters" icon={<Lock className="h-4 w-4" />} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      <Input label="Confirm new password" type="password" placeholder="Repeat password" icon={<Lock className="h-4 w-4" />} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      <Button type="submit" size="lg" loading={loading} className="w-full">Update password</Button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-violet-400 hover:text-violet-300">← Back to sign in</Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Make it strong — you'll need it to sign in">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
