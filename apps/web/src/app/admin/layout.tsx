"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck, Users, Server, Package, ShoppingCart, Coins, Ticket, CreditCard, Egg, Megaphone, UserCog, ScrollText, Settings as SettingsIcon, Gift, Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/format";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: ShieldCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/servers", label: "Servers", icon: Server },
  { href: "/admin/plans", label: "Plans", icon: Package },
  { href: "/admin/shop", label: "Shop", icon: ShoppingCart },
  { href: "/admin/rewards", label: "Coins & Rewards", icon: Coins },
  { href: "/admin/coupons", label: "Coupons", icon: Gift },
  { href: "/admin/tickets", label: "Tickets", icon: Ticket },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/panel", label: "Eggs & Nests", icon: Egg },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/roles", label: "Roles", icon: UserCog },
  { href: "/admin/logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isStaff = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR");

  useEffect(() => {
    if (isReady && !isLoading && !user) router.replace("/login");
    if (isReady && !isLoading && user && !isStaff) router.replace("/");
  }, [isReady, isLoading, user, isStaff, router]);

  if (!isReady || isLoading || !user || !isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="nova-aurora" />
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
          <p className="text-sm text-slate-500">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-slate-100">
            <ShieldCheck className="h-6 w-6 text-violet-400" /> Administration
          </h1>
          <p className="mt-1 text-sm text-slate-500">Manage your entire hosting platform.</p>
        </div>

        {/* Admin nav */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-violet-400/20 bg-white/[0.03] p-1 scrollbar-thin">
          {adminNav.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition", active ? "text-white" : "text-slate-400 hover:text-slate-200")}>
                {active && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-600/80 to-blue-600/80" transition={{ type: "spring", damping: 30, stiffness: 350 }} />}
                <n.icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{n.label}</span>
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </AppShell>
  );
}
