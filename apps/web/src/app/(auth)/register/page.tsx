"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, Gift } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { post } from "@/lib/api";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "", referralCode: params.get("ref") || "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setErrors({ confirm: "Passwords do not match" });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      await post("/auth/register", {
        username: form.username,
        email: form.email,
        password: form.password,
        referralCode: form.referralCode || undefined,
      });
      await refresh();
      toast.success("Account created — welcome to NOVA PANEL! 🎉");
      router.push("/");
    } catch (err: any) {
      setErrors(err.fields || {});
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Username" placeholder="NovaUser" icon={<UserIcon className="h-4 w-4" />} value={form.username} onChange={set("username")} error={errors.username} required minLength={3} />
      <Input label="Email" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={form.email} onChange={set("email")} error={errors.email} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Password" type="password" placeholder="Min 8 chars" icon={<Lock className="h-4 w-4" />} value={form.password} onChange={set("password")} error={errors.password} required minLength={8} />
        <Input label="Confirm" type="password" placeholder="Repeat password" icon={<Lock className="h-4 w-4" />} value={form.confirm} onChange={set("confirm")} error={errors.confirm} required minLength={8} />
      </div>
      <Input label="Referral code (optional)" placeholder="NOVAFRIEND" icon={<Gift className="h-4 w-4" />} value={form.referralCode} onChange={set("referralCode")} />
      <p className="text-[11px] leading-relaxed text-slate-600">
        By creating an account you agree to our Terms of Service and Privacy Policy.
      </p>
      <Button type="submit" size="lg" loading={loading} className="w-full">Create free account</Button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join NOVA PANEL and deploy your first server in minutes"
      footer={<>Already have an account? <Link href="/login" className="font-medium text-violet-400 hover:text-violet-300">Sign in</Link></>}
    >
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
