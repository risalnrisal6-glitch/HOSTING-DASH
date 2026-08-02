"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";

function TwoFactorForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { completeTwoFactor } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempToken = sessionStorage.getItem("nova_2fa_temp");
    if (!tempToken) {
      toast.error("Session expired — please sign in again");
      return router.push("/login");
    }
    setLoading(true);
    try {
      await completeTwoFactor(tempToken, code);
      sessionStorage.removeItem("nova_2fa_temp");
      toast.success("Verified! Welcome back.");
      router.push("/");
    } catch (err: any) {
      toast.error(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 text-violet-300">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="max-w-xs text-sm text-slate-400">Enter the 6-digit code from your authenticator app to continue.</p>
      </div>
      <input
        autoFocus
        inputMode="numeric"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
        placeholder="000 000"
        className="input-base text-center font-mono text-2xl tracking-[0.5em]"
        required
        minLength={6}
        maxLength={6}
      />
      <Button type="submit" size="lg" loading={loading} className="w-full">Verify & continue</Button>
    </form>
  );
}

export default function TwoFactorPage() {
  return (
    <AuthShell title="Two-factor authentication" subtitle="Extra security step">
      <Suspense fallback={null}>
        <TwoFactorForm />
      </Suspense>
    </AuthShell>
  );
}
