"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Search, ShieldBan, ShieldCheck, Coins, CircleDollarSign, Crown, User as UserIcon, Mail } from "lucide-react";
import { get, post, patch } from "@/lib/api";
import { Card, Button, Badge, Modal, Input, Select, Pagination, EmptyState, StatusBadge } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { formatCoins, formatCurrency, timeAgo, cn } from "@/lib/format";

interface AdminUser {
  id: string; username: string; email: string; avatar: string | null; role: string; status: string;
  coins: number; balance: number; emailVerifiedAt: string | null; createdAt: string; _count: { servers: number };
}

const roleColors: Record<string, string> = { USER: "slate", MODERATOR: "blue", ADMIN: "violet", SUPER_ADMIN: "amber" };

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [granting, setGranting] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, mutate } = useSWR<{ items: AdminUser[]; pages: number; page: number }>(`/admin/users?page=${page}&search=${encodeURIComponent(search)}`, (url: string) => get(url));

  const changeRole = async (role: string, status?: string) => {
    if (!editing) return;
    setBusy(true);
    try {
      await patch(`/admin/users/${editing.id}/role`, { role, status });
      toast.success("User updated");
      setEditing(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBan = async (u: AdminUser) => {
    try {
      await post(`/admin/users/${u.id}/ban`, { ban: u.status !== "banned" });
      toast.success(u.status === "banned" ? "User unbanned" : "User banned");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const grant = async (currency: "AKF" | "balance", amount: number, reason: string) => {
    if (!granting) return;
    if (amount <= 0 || !reason) return toast.error("Enter a positive amount and reason");
    setBusy(true);
    try {
      await post(`/admin/users/${granting.id}/grant`, { currency, amount, reason });
      toast.success(`${amount} ${currency} granted`);
      setGranting(null);
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search users..." className="input-base pl-9" />
        </div>
        <Badge color="slate">{data?.items?.length ?? 0} shown</Badge>
      </div>

      <Card bodyClassName="p-0">
        {!data?.items?.length ? (
          <EmptyState title="No users found" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="px-5 py-3">User</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">AKF</th>
                  <th className="px-3 py-3">Wallet</th>
                  <th className="px-3 py-3">Servers</th>
                  <th className="px-3 py-3">Joined</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar} name={u.username} size={34} />
                        <div>
                          <p className="font-semibold text-slate-200">{u.username}</p>
                          <p className="text-[11px] text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Badge color={roleColors[u.role]}>{u.role}</Badge></td>
                    <td className="px-3 py-3 font-mono text-amber-300">{formatCoins(u.coins)}</td>
                    <td className="px-3 py-3 font-mono text-emerald-300">{formatCurrency(u.balance)}</td>
                    <td className="px-3 py-3 text-slate-300">{u._count.servers}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{timeAgo(u.createdAt)}</td>
                    <td className="px-3 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(u)}><Crown className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setGranting(u)}><Coins className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleBan(u)}>
                          {u.status === "banned" ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> : <ShieldBan className="h-3.5 w-3.5 text-rose-400" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="p-3"><Pagination page={data.page} pages={data.pages} onChange={setPage} /></div>}
      </Card>

      {/* Role modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Manage ${editing?.username}`}>
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <Avatar src={editing.avatar} name={editing.username} size={40} />
              <div>
                <p className="text-sm font-semibold text-slate-200">{editing.username}</p>
                <p className="text-xs text-slate-500">{editing.email}</p>
              </div>
            </div>
            <Select label="Role" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
              <option value="USER">User</option>
              <option value="MODERATOR">Moderator</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </Select>
            <Select label="Account status" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </Select>
            <Button onClick={() => changeRole(editing.role, editing.status)} loading={busy} className="w-full">Save changes</Button>
          </div>
        )}
      </Modal>

      {/* Grant modal */}
      <Modal open={!!granting} onClose={() => setGranting(null)} title={`Grant to ${granting?.username}`}>
        <GrantForm onSubmit={grant} busy={busy} />
      </Modal>
    </div>
  );
}

function GrantForm({ onSubmit, busy }: { onSubmit: (currency: "AKF" | "balance", amount: number, reason: string) => void; busy: boolean }) {
  const [currency, setCurrency] = useState<"AKF" | "balance">("AKF");
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-4">
      <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as "AKF" | "balance")}>
        <option value="AKF">AKF Coins</option>
        <option value="balance">Wallet Balance</option>
      </Select>
      <Input type="number" label="Amount" value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={1} />
      <Input label="Reason" placeholder="Welcome bonus, compensation..." value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button onClick={() => onSubmit(currency, amount, reason)} loading={busy} className="w-full" icon={<Coins className="h-4 w-4" />}>Grant</Button>
    </div>
  );
}
