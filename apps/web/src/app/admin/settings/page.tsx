"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Globe, Mail, KeyRound, CreditCard, ShieldCheck, Save, PlugZap, CheckCircle2, XCircle, Loader2, Server as ServerIcon, Inbox, Palette,
} from "lucide-react";
import { get, put, post } from "@/lib/api";
import { Card, Button, Input, Toggle, Badge, Tabs } from "@/components/ui";
import { cn } from "@/lib/format";

export default function AdminSettingsPage() {
  const { data, mutate } = useSWR<Record<string, any>>("/admin/settings", (url: string) => get(url));
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [tab, setTab] = useState("pterodactyl");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const { data: outbox } = useSWR("/admin/outbox?limit=5", (url: string) => get(url));

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const set = (k: string, v: any) => setSettings((s) => ({ ...s, [k]: v }));

  const saveAll = async () => {
    setSaving(true);
    try {
      await put("/admin/settings", settings);
      toast.success("Settings saved");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await post<{ nodes: number; users: number; servers: number; client: boolean }>("/admin/settings/test-pterodactyl", {
        url: settings.panel_url,
        appKey: settings.panel_app_key,
        clientKey: settings.panel_client_key,
      });
      setTestResult({
        ok: true,
        message: `Connected! ${result.nodes} nodes, ${result.users} users, ${result.servers} servers${result.client ? " · Client API verified" : ""}`,
      });
      toast.success("Connection successful!");
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    setSmtpResult(null);
    try {
      const result = await post<{ status: string }>("/admin/settings/test-smtp", { to: settings.smtp_test_to || "you@example.com", ...settings });
      setSmtpResult({ ok: result.status === "sent", message: result.status === "sent" ? "Email sent successfully!" : result.status === "logged" ? "No SMTP configured — email stored in outbox (check Email Logs tab)." : "Failed to send" });
    } catch (e: any) {
      setSmtpResult({ ok: false, message: e.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  const sections = [
    { id: "branding", label: "Branding", icon: Palette },
    { id: "pterodactyl", label: "Pterodactyl API", icon: Globe },
    { id: "mail", label: "Mail", icon: Mail },
    { id: "oauth", label: "OAuth", icon: KeyRound },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "security", label: "Security & General", icon: ShieldCheck },
    { id: "outbox", label: "Email Logs", icon: Inbox },
  ];

  const tabs = sections.map((s) => ({ id: s.id, label: s.label }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <Button onClick={saveAll} loading={saving} icon={<Save className="h-4 w-4" />}>Save all settings</Button>
      </div>

      {tab === "branding" && (
        <Card title="Branding" subtitle="Customize your site name, description, favicon, and logo — changes take effect immediately.">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Site name" value={settings.site_name || ""} onChange={(e) => set("site_name", e.target.value)} placeholder="NOVA PANEL" />
              <Input label="Coin name" value={settings.coin_name || ""} onChange={(e) => set("coin_name", e.target.value)} placeholder="AKF" />
            </div>
            <Input label="Site description" value={settings.site_description || ""} onChange={(e) => set("site_description", e.target.value)} placeholder="Premium Pterodactyl hosting dashboard" />
            <Input label="Favicon URL" value={settings.site_favicon || ""} onChange={(e) => set("site_favicon", e.target.value)} placeholder="https://example.com/favicon.ico or data:image/svg+xml,..." hint="Leave empty for the default NOVA logo. Supports any URL: .ico, .png, .svg, or base64 data URI." />
            <Input label="Logo URL (optional)" value={settings.site_logo || ""} onChange={(e) => set("site_logo", e.target.value)} placeholder="https://example.com/logo.png" hint="Used in the sidebar and email templates — leave empty for text-only branding." />
            <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-glow">
                <span className="text-lg font-bold text-white">{(settings.site_name || "N")[0]}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Preview</p>
                <p className="text-xs text-slate-500">{settings.site_name || "NOVA PANEL"} — {settings.site_description || "Premium Hosting"}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === "pterodactyl" && (
        <Card title="Pterodactyl connection" subtitle="Secrets are encrypted at rest and never exposed to users">
          <div className="space-y-4">
            <Input label="Panel URL" value={settings.panel_url || ""} onChange={(e) => set("panel_url", e.target.value)} placeholder="https://panel.yourhost.com" icon={<Globe className="h-4 w-4" />} />
            <Input label="Application API Key" type="password" value={settings.panel_app_key || ""} onChange={(e) => set("panel_app_key", e.target.value)} placeholder="ptla_..." icon={<KeyRound className="h-4 w-4" />} hint="Create in Panel Admin → Application API" />
            <Input label="Client API Key (optional)" type="password" value={settings.panel_client_key || ""} onChange={(e) => set("panel_client_key", e.target.value)} placeholder="ptlc_..." icon={<KeyRound className="h-4 w-4" />} hint="Required for console, files & runtime features" />
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <Toggle checked={!!settings.panel_enabled} onChange={(v) => set("panel_enabled", v)} label="Enable live panel connection (off = demo mode)" />
              <Badge color={settings.panel_enabled ? "green" : "amber"}>{settings.panel_enabled ? "Enabled" : "Demo mode"}</Badge>
            </div>

            {/* THE single check button */}
            <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.06] p-4">
              <p className="mb-3 text-sm font-semibold text-slate-200">Test connection</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={testConnection} loading={testing} icon={<PlugZap className="h-4 w-4" />}>Test Connection</Button>
                {testResult && (
                  <span className={cn("flex items-center gap-2 text-sm", testResult.ok ? "text-emerald-400" : "text-rose-400")}>
                    {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{testResult.message}
                  </span>
                )}
              </div>
              {testing && <p className="mt-2 text-xs text-slate-500"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Contacting panel...</p>}
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              <p className="mb-3 text-sm font-semibold text-slate-200">Defaults for new servers</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Default Node ID" value={settings.default_node || ""} onChange={(e) => set("default_node", e.target.value)} />
                <Input label="Default Location ID" value={settings.default_location || ""} onChange={(e) => set("default_location", e.target.value)} />
                <Input label="Default Nest ID" value={settings.default_nest || ""} onChange={(e) => set("default_nest", e.target.value)} />
                <Input label="Default Egg ID" value={settings.default_egg || ""} onChange={(e) => set("default_egg", e.target.value)} />
                <Input label="Default Docker image" value={settings.default_docker_image || ""} onChange={(e) => set("default_docker_image", e.target.value)} placeholder="ghcr.io/pterodactyl/yolks:java_21" />
                <Input label="Max servers per user" type="number" value={settings.max_servers_per_user ?? 10} onChange={(e) => set("max_servers_per_user", Number(e.target.value))} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === "mail" && (
        <Card title="Mail (SMTP)" subtitle="Used for verification emails & password resets">
          <div className="space-y-4">
            <Input label="From address" value={settings.mail_from || ""} onChange={(e) => set("mail_from", e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="SMTP Host" value={settings.mail_host || ""} onChange={(e) => set("mail_host", e.target.value)} />
              <Input label="Port" type="number" value={settings.mail_port ?? 587} onChange={(e) => set("mail_port", Number(e.target.value))} />
              <div className="flex items-end pb-1"><Toggle checked={!!settings.mail_secure} onChange={(v) => set("mail_secure", v)} label="TLS/SSL" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Username" value={settings.mail_user || ""} onChange={(e) => set("mail_user", e.target.value)} />
              <Input label="Password" type="password" value={settings.mail_pass || ""} onChange={(e) => set("mail_pass", e.target.value)} />
            </div>
            <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.06] p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Input label="Send test email to" value={settings.smtp_test_to || ""} onChange={(e) => set("smtp_test_to", e.target.value)} placeholder="you@example.com" className="!w-64" />
                <Button onClick={testSmtp} loading={testingSmtp} variant="secondary" icon={<Mail className="h-4 w-4" />}>Send test email</Button>
              </div>
              {smtpResult && <p className={cn("mt-3 text-sm", smtpResult.ok ? "text-emerald-400" : "text-rose-400")}>{smtpResult.message}</p>}
            </div>
            <p className="text-xs text-slate-600">No SMTP configured? Emails are stored in the Email Logs tab so you can still grab verification links during development.</p>
          </div>
        </Card>
      )}

      {tab === "oauth" && (
        <Card title="OAuth login" subtitle="Discord & Google sign-in — configure from the provider console">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-200">Discord</p>
                <Toggle checked={!!settings.oauth_discord_enabled} onChange={(v) => set("oauth_discord_enabled", v)} />
              </div>
              <Input label="Client ID" value={settings.oauth_discord_client_id || ""} onChange={(e) => set("oauth_discord_client_id", e.target.value)} />
              <Input label="Client Secret" type="password" value={settings.oauth_discord_client_secret || ""} onChange={(e) => set("oauth_discord_client_secret", e.target.value)} />
              <Input label="Redirect URI" value={settings.oauth_discord_redirect || ""} onChange={(e) => set("oauth_discord_redirect", e.target.value)} placeholder="http://localhost:3000/auth/callback/discord" />
            </div>
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-200">Google</p>
                <Toggle checked={!!settings.oauth_google_enabled} onChange={(v) => set("oauth_google_enabled", v)} />
              </div>
              <Input label="Client ID" value={settings.oauth_google_client_id || ""} onChange={(e) => set("oauth_google_client_id", e.target.value)} />
              <Input label="Client Secret" type="password" value={settings.oauth_google_client_secret || ""} onChange={(e) => set("oauth_google_client_secret", e.target.value)} />
              <Input label="Redirect URI" value={settings.oauth_google_redirect || ""} onChange={(e) => set("oauth_google_redirect", e.target.value)} placeholder="http://localhost:3000/auth/callback/google" />
            </div>
          </div>
        </Card>
      )}

      {tab === "payments" && (
        <Card title="Payment gateways" subtitle="Without live credentials, gateway payments are created as pending and approved manually">
          <div className="grid gap-4 md:grid-cols-2">
            <GatewayCard title="Stripe" enabled={!!settings.pay_stripe_enabled} onChange={(v) => set("pay_stripe_enabled", v)}>
              <Input label="Publishable key" value={settings.pay_stripe_pk || ""} onChange={(e) => set("pay_stripe_pk", e.target.value)} />
              <Input label="Secret key" type="password" value={settings.pay_stripe_sk || ""} onChange={(e) => set("pay_stripe_sk", e.target.value)} />
            </GatewayCard>
            <GatewayCard title="PayPal" enabled={!!settings.pay_paypal_enabled} onChange={(v) => set("pay_paypal_enabled", v)}>
              <Input label="Client ID" value={settings.pay_paypal_client_id || ""} onChange={(e) => set("pay_paypal_client_id", e.target.value)} />
              <Input label="Secret" type="password" value={settings.pay_paypal_secret || ""} onChange={(e) => set("pay_paypal_secret", e.target.value)} />
              <select value={settings.pay_paypal_mode || "sandbox"} onChange={(e) => set("pay_paypal_mode", e.target.value)} className="input-base">
                <option value="sandbox">Sandbox</option>
                <option value="live">Live</option>
              </select>
            </GatewayCard>
            <GatewayCard title="Razorpay" enabled={!!settings.pay_razorpay_enabled} onChange={(v) => set("pay_razorpay_enabled", v)}>
              <Input label="Key ID" value={settings.pay_razorpay_key_id || ""} onChange={(e) => set("pay_razorpay_key_id", e.target.value)} />
              <Input label="Key Secret" type="password" value={settings.pay_razorpay_key_secret || ""} onChange={(e) => set("pay_razorpay_key_secret", e.target.value)} />
            </GatewayCard>
            <GatewayCard title="UPI" enabled={!!settings.pay_upi_enabled} onChange={(v) => set("pay_upi_enabled", v)}>
              <Input label="UPI ID" value={settings.pay_upi_id || ""} onChange={(e) => set("pay_upi_id", e.target.value)} placeholder="you@upi" />
            </GatewayCard>
            <GatewayCard title="Crypto" enabled={!!settings.pay_crypto_enabled} onChange={(v) => set("pay_crypto_enabled", v)}>
              <Input label="Wallet addresses (JSON)" value={typeof settings.pay_crypto_addresses === "string" ? settings.pay_crypto_addresses : JSON.stringify(settings.pay_crypto_addresses || {})} onChange={(e) => set("pay_crypto_addresses", e.target.value)} hint='{"BTC": "bc1...", "ETH": "0x..."}' />
            </GatewayCard>
            <GatewayCard title="Manual / Bank transfer" enabled={!!settings.pay_manual_enabled} onChange={(v) => set("pay_manual_enabled", v)}>
              <p className="text-xs text-slate-500">Admins approve manual payments from the Payments page.</p>
            </GatewayCard>
          </div>
        </Card>
      )}

      {tab === "security" && (
        <Card title="Security & general">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-200">Security</p>
              <Toggle checked={settings.security_registration !== false} onChange={(v) => set("security_registration", v)} label="Allow registration" />
              <Toggle checked={!!settings.security_email_verify} onChange={(v) => set("security_email_verify", v)} label="Require email verification" />
              <Toggle checked={!!settings.security_2fa_required} onChange={(v) => set("security_2fa_required", v)} label="Require 2FA (admins)" />
              <Input label="Min password length" type="number" value={settings.security_min_password ?? 8} onChange={(e) => set("security_min_password", Number(e.target.value))} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-200">General</p>
              <Input label="Site name" value={settings.site_name || ""} onChange={(e) => set("site_name", e.target.value)} />
              <Toggle checked={settings.demo_banner !== false} onChange={(v) => set("demo_banner", v)} label="Show demo-mode banner" />
              <Toggle checked={!!settings.wallet_enabled} onChange={(v) => set("wallet_enabled", v)} label="Enable wallet balance" />
              <Toggle checked={!!settings.coins_enabled} onChange={(v) => set("coins_enabled", v)} label="Enable AKF coins" />
            </div>
          </div>
        </Card>
      )}

      {tab === "outbox" && (
        <Card title="Email log" subtitle="All outgoing emails (verification, reset links) — useful without SMTP">
          <div className="space-y-2.5">
            {!outbox?.items?.length && <p className="py-8 text-center text-sm text-slate-500">No emails sent yet.</p>}
            {outbox?.items?.map((e: any) => (
              <div key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={e.status === "sent" ? "green" : e.status === "logged" ? "amber" : "red"}>{e.status}</Badge>
                  <p className="text-sm font-semibold text-slate-200">{e.subject}</p>
                  <span className="ml-auto text-[11px] text-slate-600">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">To: {e.to}</p>
                {e.status === "logged" && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-violet-400">Show content</summary>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-[#04050c] p-3 text-[10px] text-slate-400">{e.body}</div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function GatewayCard({ title, enabled, onChange, children }: { title: string; enabled: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-200">{title}</p>
        <Toggle checked={enabled} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}
