"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, Server, Coins } from "lucide-react";

const features = [
  { icon: Server, title: "Instant deployments", desc: "Deploy game servers & apps in seconds via Pterodactyl" },
  { icon: Coins, title: "Earn AKF coins", desc: "Daily check-ins, ads, referrals, giveaways & the lucky spin" },
  { icon: ShieldCheck, title: "Bank-grade security", desc: "2FA, encrypted secrets, role-based access & audit logs" },
];

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      {/* Brand panel */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="hidden lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-glow">
            <Zap className="h-6 w-6 text-white" fill="currentColor" />
          </div>
          <div>
            <p className="font-display text-2xl font-bold tracking-tight text-gradient">NOVA PANEL</p>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Premium Hosting Platform</p>
          </div>
        </div>
        <h1 className="font-display text-4xl font-bold leading-tight text-slate-100">
          Power your servers with <span className="text-gradient">NOVA</span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          A premium cloud-grade control panel for Pterodactyl — deploy Minecraft, bots, websites and more with a beautiful glass interface.
        </p>
        <div className="mt-8 space-y-4">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 text-violet-300">
                <f.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                <p className="text-xs text-slate-500">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Form card */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        <div className="glass p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600">
              <Zap className="h-5 w-5 text-white" fill="currentColor" />
            </div>
            <p className="font-display text-lg font-bold text-gradient">NOVA PANEL</p>
          </div>
          <h2 className="font-display text-xl font-bold text-slate-100">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-white/[0.06] pt-4 text-center text-sm text-slate-500">{footer}</div>}
        </div>
        <p className="mt-4 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} NOVA PANEL · <Link href="/" className="text-slate-500 hover:text-slate-300">Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
}
