"use client";

import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/format";

// ---------- Button ----------
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...props }: ButtonProps) {
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary: "btn-gradient",
    secondary: "bg-white/[0.06] border border-white/10 text-slate-100 hover:bg-white/[0.12] hover:border-white/20 transition",
    ghost: "text-slate-300 hover:bg-white/[0.06] transition",
    danger: "bg-gradient-to-r from-rose-600 to-red-600 text-white font-semibold hover:brightness-110 transition",
    outline: "border border-violet-400/40 text-violet-300 hover:bg-violet-500/10 transition",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none select-none",
        sizes[size],
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------- Card ----------
export function Card({ title, subtitle, actions, children, className, bodyClassName }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={cn("glass", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

// ---------- Badge ----------
const badgeColors: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
  red: "bg-rose-500/15 text-rose-300 border-rose-400/20",
  amber: "bg-amber-500/15 text-amber-300 border-amber-400/20",
  blue: "bg-blue-500/15 text-blue-300 border-blue-400/20",
  violet: "bg-violet-500/15 text-violet-300 border-violet-400/20",
  slate: "bg-slate-500/15 text-slate-300 border-slate-400/20",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-400/20",
};

export function Badge({ color = "slate", children, className, dot }: { color?: string; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", badgeColors[color] || badgeColors.slate, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    RUNNING: { color: "green", label: "Running" },
    OFFLINE: { color: "slate", label: "Offline" },
    SUSPENDED: { color: "red", label: "Suspended" },
    CREATING: { color: "amber", label: "Creating" },
    ERROR: { color: "red", label: "Error" },
    DELETED: { color: "slate", label: "Deleted" },
    active: { color: "green", label: "Active" },
    banned: { color: "red", label: "Banned" },
    paid: { color: "green", label: "Paid" },
    pending: { color: "amber", label: "Pending" },
    refunded: { color: "cyan", label: "Refunded" },
    cancelled: { color: "slate", label: "Cancelled" },
    failed: { color: "red", label: "Failed" },
    draft: { color: "slate", label: "Draft" },
    open: { color: "blue", label: "Open" },
    answered: { color: "violet", label: "Answered" },
    closed: { color: "slate", label: "Closed" },
  };
  const s = map[status] || { color: "slate", label: status };
  return <Badge color={s.color} dot>{s.label}</Badge>;
}

// ---------- Inputs ----------
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  mono?: boolean;
}

export function Input({ label, error, hint, icon, mono, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-xs font-medium text-slate-400">{label}</label>}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>}
        <input id={inputId} className={cn("input-base", mono ? "font-mono text-xs" : undefined, icon ? "pl-9" : undefined, error ? "border-rose-400/60" : undefined, className)} {...props} />
      </div>
      {error ? <p className="text-xs text-rose-400">{error}</p> : hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-400">{label}</label>}
      <textarea className={cn("input-base min-h-[90px] resize-y", error && "border-rose-400/60", className)} {...props} />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}
export function Select({ label, error, children, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-400">{label}</label>}
      <select className={cn("input-base appearance-none bg-no-repeat pr-8", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 6l3.5 4 3.5-4z'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.75rem center" }} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ---------- Toggle ----------
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("flex items-center gap-3 disabled:opacity-50", label && "w-full")}
    >
      <span className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", checked ? "bg-gradient-to-r from-violet-600 to-blue-600" : "bg-white/10")}>
        <motion.span layout className={cn("inline-block h-4 w-4 rounded-full bg-white shadow", checked ? "translate-x-[22px]" : "translate-x-1")} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
      </span>
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </button>
  );
}

// ---------- Spinner / Skeleton ----------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-violet-400", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/[0.06]", className)} />;
}

export function FullPageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-400" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-500">{icon || <Inbox className="h-6 w-6" />}</div>
      <div>
        <p className="font-medium text-slate-300">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cn("relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f21] shadow-2xl", wide ? "max-w-3xl" : "max-w-md")}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <h3 className="font-display text-sm font-semibold text-slate-100">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-5 scrollbar-thin">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Confirm dialog ----------
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmText = "Confirm", danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: string; confirmText?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-400">{description || "Are you sure you want to continue?"}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </div>
    </Modal>
  );
}

// ---------- Pagination ----------
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<ChevronLeft className="h-3.5 w-3.5" />}>Prev</Button>
      <span className="text-xs text-slate-500">Page {page} of {pages}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next<ChevronRight className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

// ---------- Stat card ----------
export function StatCard({ label, value, sub, icon, gradient = "from-violet-500/20 to-blue-500/20", onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; gradient?: string; onClick?: () => void }) {
  return (
    <motion.div whileHover={{ y: -3 }} className={cn("glass glass-hover cursor-pointer p-5", onClick ? "cursor-pointer" : "cursor-default")} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-100">{value}</p>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        {icon && <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br", gradient)}>{icon}</div>}
      </div>
    </motion.div>
  );
}

// ---------- Tabs ----------
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: ReactNode }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 scrollbar-thin">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition",
            active === t.id ? "text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          {active === t.id && (
            <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-600/80 to-blue-600/80" transition={{ type: "spring", damping: 30, stiffness: 350 }} />
          )}
          <span className="relative z-10">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Progress bar ----------
export function ProgressBar({ value, max = 100, color = "from-violet-500 to-blue-500", className }: { value: number; max?: number; color?: string; className?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <motion.div className={cn("h-full rounded-full bg-gradient-to-r", color)} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
    </div>
  );
}
