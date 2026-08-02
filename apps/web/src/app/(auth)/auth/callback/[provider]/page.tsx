"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { post } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function CallbackContent() {
  const router = useRouter();
  const params = useParams<{ provider: string }>();
  const search = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState("");

  const code = search.get("code");

  useEffect(() => {
    if (!code) {
      setError("Missing authorization code");
      return;
    }
    post(`/auth/oauth/${params.provider}`, { code })
      .then(async () => {
        await refresh();
        toast.success("Signed in with " + params.provider + "!");
        router.replace("/");
      })
      .catch((err: any) => {
        setError(err.message || "OAuth sign-in failed");
      });
  }, [code, params.provider, router, refresh, search]);

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      {error ? (
        <>
          <p className="text-sm text-rose-400">{error}</p>
          <button onClick={() => router.replace("/login")} className="text-sm font-medium text-violet-400 hover:text-violet-300">← Back to sign in</button>
        </>
      ) : (
        <>
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
          <p className="text-sm text-slate-400">Completing {params.provider} sign-in...</p>
        </>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <AuthShell title="Signing you in" subtitle="One moment please">
      <Suspense fallback={null}>
        <CallbackContent />
      </Suspense>
    </AuthShell>
  );
}
