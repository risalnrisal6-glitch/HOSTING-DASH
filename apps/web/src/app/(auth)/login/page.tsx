"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Zap } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import useSWR from "swr";

function OAuthSection() {
  const { data } = useSWR<{ settings: Record<string, any> }>("/public/config", (url: string) => api(url));
  const s = data?.settings || {};
  if (!s.oauth_discord_enabled && !s.oauth_google_enabled) return null;

  const startOAuth = async (provider: "discord" | "google") => {
    const redirect = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const params = new URLSearchParams({
      client_id: provider === "discord" ? String(s.oauth_discord_client_id || "") : String(s.oauth_google_client_id || ""),
      redirect_uri: `${redirect}/auth/callback/${provider}`,
      response_type: "code",
      scope: provider === "discord" ? "identify" : "openid email profile",
    });
    const base = provider === "discord" ? "https://discord.com/oauth2/authorize" : "https://accounts.google.com/o/oauth2/v2/auth";
    window.location.href = `${base}?${params}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.08]" />
        <span className="text-[11px] uppercase tracking-wider text-slate-600">or continue with</span>
        <div className="h-px flex-1 bg-white/[0.08]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {s.oauth_discord_enabled && (
          <Button variant="secondary" onClick={() => startOAuth("discord")} icon={<Zap className="h-4 w-4 text-indigo-400" />}>Discord</Button>
        )}
        {s.oauth_google_enabled && (
          <Button variant="secondary" onClick={() => startOAuth("google")}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </Button>
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const result = await login(email, password);
      if (result.needsTwoFactor) {
        sessionStorage.setItem("nova_2fa_temp", result.tempToken || "");
        router.push(`/two-factor?uid=${result.userId}`);
      } else {
        toast.success("Welcome back!");
        router.push(params.get("next") || "/");
      }
    } catch (err: any) {
      setErrors(err.fields || {});
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Email" type="email" placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
      <div className="relative">
        <Input label="Password" type={show ? "text" : "password"} placeholder="••••••••" icon={<Lock className="h-4 w-4" />} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-[34px] text-slate-500 hover:text-slate-300">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-violet-400 hover:text-violet-300">Forgot password?</Link>
        <Link href="/register" className="text-slate-400 hover:text-slate-200">Create account</Link>
      </div>
      <Button type="submit" size="lg" loading={loading} className="w-full">Sign in</Button>
      <OAuthSection />
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your NOVA PANEL account"
      footer={<>New here? <Link href="/register" className="font-medium text-violet-400 hover:text-violet-300">Create a free account</Link></>}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
