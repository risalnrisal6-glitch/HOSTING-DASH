"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { User as UserIcon, KeyRound, ShieldCheck, QrCode } from "lucide-react";
import { get, post, patch } from "@/lib/api";
import { Card, Button, Input, Toggle } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/avatar";

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [username, setUsername] = useState(user?.username || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [twoFactor, setTwoFactor] = useState<{ secret: string; otpauth: string; qrDataUrl: string } | null>(null);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaDisableCode, setTfaDisableCode] = useState("");

  const saveProfile = async () => {
    setBusy("profile");
    try {
      await patch("/users/profile", { username, avatar: avatar || undefined });
      await refresh();
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async () => {
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
    setBusy("pw");
    try {
      await post("/users/change-password", { current: pw.current, next: pw.next });
      toast.success("Password changed");
      setPw({ current: "", next: "", confirm: "" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const setup2fa = async () => {
    setBusy("2fa");
    try {
      const data = await post<{ secret: string; otpauth: string; qrDataUrl: string }>("/users/2fa/setup", {});
      setTwoFactor(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const enable2fa = async () => {
    setBusy("2fa");
    try {
      await post("/users/2fa/enable", { code: tfaCode });
      toast.success("Two-factor authentication enabled!");
      setTwoFactor(null);
      setTfaCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const disable2fa = async () => {
    setBusy("2fa");
    try {
      await post("/users/2fa/disable", { code: tfaDisableCode });
      toast.success("2FA disabled");
      setTfaDisableCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">Account settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your profile and security.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile" subtitle="Your public identity">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={avatar || user?.avatar} name={username || user?.username || "U"} size={56} />
              <div className="text-sm">
                <p className="font-semibold text-slate-200">{user?.username}</p>
                <p className="text-slate-500">{user?.email}</p>
              </div>
            </div>
            <Input label="Username" icon={<UserIcon className="h-4 w-4" />} value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input label="Avatar URL" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
            <Button onClick={saveProfile} loading={busy === "profile"}>Save profile</Button>
          </div>
        </Card>

        <Card title="Password" subtitle="Change your password">
          <div className="space-y-4">
            <Input label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <Input label="New password" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <Input label="Confirm new password" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            <Button onClick={changePassword} loading={busy === "pw"} icon={<KeyRound className="h-4 w-4" />}>Update password</Button>
          </div>
        </Card>
      </div>

      <Card title="Two-factor authentication" subtitle="Add an extra layer of security">
        {user?.twoFactorEnabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-slate-200">2FA is enabled</p>
                <p className="text-xs text-slate-500">Your account is protected by an authenticator app.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="6-digit code" value={tfaDisableCode} onChange={(e) => setTfaDisableCode(e.target.value)} className="!w-32" />
              <Button variant="danger" size="sm" onClick={disable2fa} loading={busy === "2fa"}>Disable</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!twoFactor ? (
              <Button onClick={setup2fa} loading={busy === "2fa"} icon={<ShieldCheck className="h-4 w-4" />}>Set up 2FA</Button>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={twoFactor.qrDataUrl} alt="QR code" className="rounded-2xl border border-white/10 bg-white p-3" width={180} height={180} />
                <div className="w-full">
                  <p className="mb-2 flex items-center justify-center gap-2 text-xs text-slate-400"><QrCode className="h-3.5 w-3.5" />Scan with Google Authenticator or Authy, then enter the code:</p>
                  <div className="flex items-center justify-center gap-2">
                    <Input placeholder="6-digit code" value={tfaCode} onChange={(e) => setTfaCode(e.target.value)} className="!w-40 text-center font-mono tracking-widest" />
                    <Button onClick={enable2fa} loading={busy === "2fa"}>Enable</Button>
                  </div>
                  <code className="mt-3 block break-all font-mono text-[11px] text-slate-600">Secret: {twoFactor.secret}</code>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
