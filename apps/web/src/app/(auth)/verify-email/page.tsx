"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { post } from "@/lib/api";

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) return setState("error");
    post("/auth/verify-email", { token })
      .then(() => setState("success"))
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      {state === "loading" && <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />}
      {state === "success" && (
        <>
          <CheckCircle2 className="h-14 w-14 text-emerald-400" />
          <h3 className="font-display text-lg font-bold text-slate-100">Email verified!</h3>
          <p className="max-w-xs text-sm text-slate-400">Your account is now fully activated. Referral rewards have been unlocked.</p>
          <Button onClick={() => router.push("/")} className="mt-2">Go to dashboard</Button>
        </>
      )}
      {state === "error" && (
        <>
          <XCircle className="h-14 w-14 text-rose-400" />
          <h3 className="font-display text-lg font-bold text-slate-100">Verification failed</h3>
          <p className="max-w-xs text-sm text-slate-400">The link is invalid or expired. Try resending the verification email.</p>
          <Link href="/login" className="mt-2 text-sm font-medium text-violet-400 hover:text-violet-300">← Back to sign in</Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email" subtitle="Confirm your address to activate your account">
      <Suspense fallback={null}>
        <VerifyContent />
      </Suspense>
    </AuthShell>
  );
}
