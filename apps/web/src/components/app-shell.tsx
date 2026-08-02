"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  LayoutDashboard, Server, ShoppingBag, Package, Wallet, Receipt, Ticket, Gift, Bell, Settings as SettingsIcon,
  ShieldCheck, Menu, X, LogOut, ChevronDown, Sparkles, Coins, User as UserIcon, Zap, Network, Database, Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn, formatCoins, formatCurrency, timeAgo } from "@/lib/format";
import useSWR from "swr";
import { get, post } from "@/lib/api";
import type { PublicConfig, Notification as NotificationType } from "@/lib/types";
import { Avatar } from "./avatar";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/store", label: "Store", icon: ShoppingBag },
  { href: "/store/resources", label: "Resource Shop", icon: Package },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/tickets", label: "Support", icon: Ticket },
  { href: "/referrals", label: "Referrals", icon: Gift },
];

const miscNav = [
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isStaff = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR");

  const { data: config } = useSWR<PublicConfig>("/public/config", (url: string) => get<PublicConfig>(url));
  const { data: notifs, mutate: mutateNotifs } = useSWR<{ items: NotificationType[]; unread: number }>("/notifications?limit=8", (url: string) => get(url));

  // Real-time notification stream
  useEffect(() => {
    if (!user) return;
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("message", (e) => {
      try {
        const n = JSON.parse((e as MessageEvent).data) as NotificationType;
        toast(n.title, { description: n.body });
        mutateNotifs();
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, [user, mutateNotifs]);

  // Close overlays on navigation
  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
          active ? "text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
        )}
      >
        {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600/25 to-blue-600/25 border border-violet-400/20" transition={{ type: "spring", damping: 30, stiffness: 350 }} />}
        <Icon className="relative z-10 h-[18px] w-[18px]" />
        <span className="relative z-10">{label}</span>
      </Link>
    );
  };

  const siteName = config?.settings?.site_name || "NOVA PANEL";
  const siteDesc = config?.settings?.site_description || "Premium Hosting";

  const sidebar = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6 scrollbar-thin">
      <Link href="/" className="flex items-center gap-3 px-2">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-glow">
          <Zap className="h-5 w-5 text-white" fill="currentColor" />
        </div>
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-gradient">{siteName}</p>
          <p className="-mt-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-500">{siteDesc}</p>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Overview</p>
        {mainNav.map((n) => <NavItem key={n.href} {...n} />)}
      </nav>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Account</p>
        {miscNav.map((n) => <NavItem key={n.href} {...n} />)}
      </nav>

      {isStaff && (
        <nav className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">Administration</p>
          {[{ href: "/admin", label: "Admin Panel", icon: ShieldCheck }, { href: "/admin/settings", label: "API Settings", icon: Globe }].map((n) => <NavItem key={n.href} {...n} />)}
        </nav>
      )}

      <div className="mt-auto space-y-3">
        <div className="glass p-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-300" />
            <span className="text-xs text-slate-400">AKF Coins</span>
            <span className="ml-auto font-display font-bold text-amber-300">{formatCoins(user?.coins || 0)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-300" />
            <span className="text-xs text-slate-400">Balance</span>
            <span className="ml-auto font-display font-bold text-emerald-300">{formatCurrency(user?.balance || 0)}</span>
          </div>
        </div>
        <Link href="/wallet" className="btn-gradient flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" /> Earn free coins
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="nova-aurora" />
      <div className="nova-grid" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/[0.06] bg-[#07081a]/80 backdrop-blur-2xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-white/[0.06] bg-[#07081a]/95 backdrop-blur-2xl lg:hidden"
            >
              <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-white/10"><X className="h-4 w-4" /></button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#05060f]/70 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="hidden text-xs font-medium text-slate-500 sm:block">
                {config?.panelConnected ? "Connected to Pterodactyl Panel" : "Panel not connected"}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {/* Notifications */}
              <div className="relative">
                <button onClick={() => setNotifOpen((v) => !v)} className="relative rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 transition hover:bg-white/[0.1]">
                  <Bell className="h-4 w-4" />
                  {(notifs?.unread || 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-blue-500 px-1 text-[9px] font-bold text-white">
                      {notifs!.unread}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} className="absolute right-0 top-12 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f21] shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                        <p className="text-sm font-semibold text-slate-100">Notifications</p>
                        <button className="text-xs text-violet-400 hover:text-violet-300" onClick={async () => { await post("/notifications/read"); mutateNotifs(); }}>Mark all read</button>
                      </div>
                      <div className="max-h-80 overflow-y-auto scrollbar-thin">
                        {(notifs?.items?.length || 0) === 0 && <p className="p-6 text-center text-sm text-slate-500">No notifications yet</p>}
                        {notifs?.items?.map((n) => (
                          <div key={n.id} className={cn("border-b border-white/[0.04] px-4 py-3", !n.readAt && "bg-violet-500/[0.06]")}>
                            <p className="text-sm font-medium text-slate-200">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                            <p className="mt-1 text-[10px] text-slate-600">{timeAgo(n.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                      <Link href="/notifications" className="block border-t border-white/[0.06] px-4 py-2.5 text-center text-xs font-medium text-violet-400 hover:bg-white/[0.04]">View all</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User menu */}
              <div className="relative">
                <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/[0.08]">
                  <Avatar src={user?.avatar} name={user?.username || "U"} size={30} />
                  <div className="hidden text-left sm:block">
                    <p className="text-xs font-semibold text-slate-200">{user?.username}</p>
                    <p className="text-[10px] text-slate-500">{formatCoins(user?.coins || 0)} AKF</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f21] p-1.5 shadow-2xl">
                      <div className="px-3 py-2">
                        <p className="text-sm font-semibold text-slate-100">{user?.username}</p>
                        <p className="truncate text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <div className="my-1 border-t border-white/[0.06]" />
                      {[{ href: "/settings", label: "Account settings", icon: UserIcon }, { href: "/billing", label: "Billing", icon: Receipt }].map((i) => (
                        <Link key={i.href} href={i.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">
                          <i.icon className="h-4 w-4 text-slate-500" /> {i.label}
                        </Link>
                      ))}
                      {isStaff && (
                        <Link href="/admin" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-violet-300 hover:bg-white/[0.06]">
                          <ShieldCheck className="h-4 w-4" /> Admin Panel
                        </Link>
                      )}
                      <div className="my-1 border-t border-white/[0.06]" />
                      <button onClick={() => { logout(); router.push("/login"); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
