import { prisma } from "../db";
import { settings } from "./settings";
import { wallet } from "./wallet.service";
import { ApiError } from "../lib/errors";
import { notifyUser } from "./notify.service";
import { materializePlanInvoice, materializeCustomInvoice } from "./store.service";

function currencySymbol(currency: string): string {
  return currency === "INR" ? "₹" : "$";
}

// ============================================================
// Billing — invoices, gateways, payment history, refunds.
// Gateways: AKF coins, wallet balance, UPI, Stripe, PayPal,
// Razorpay, Crypto, Manual. Gateways without live credentials
// produce a pending payment the admin can approve.
// ============================================================

export interface GatewayInfo {
  id: string;
  name: string;
  enabled: boolean;
  hint?: string;
}

export async function getGateways(): Promise<GatewayInfo[]> {
  const s = await settings.getAll();
  return [
    { id: "akf", name: "AKF Coins", enabled: true },
    { id: "wallet", name: "Wallet Balance", enabled: !!s.wallet_enabled },
    { id: "manual", name: "Bank Transfer / Manual", enabled: !!s.pay_manual_enabled },
    { id: "upi", name: "UPI", enabled: !!s.pay_upi_enabled, hint: String(s.pay_upi_id || "") },
    { id: "stripe", name: "Stripe", enabled: !!s.pay_stripe_enabled },
    { id: "paypal", name: "PayPal", enabled: !!s.pay_paypal_enabled },
    { id: "razorpay", name: "Razorpay", enabled: !!s.pay_razorpay_enabled },
    { id: "crypto", name: "Crypto", enabled: !!s.pay_crypto_enabled },
  ];
}

export async function listInvoices(userId: string, page = 1, limit = 10) {
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { promoCode: true } }),
    prisma.invoice.count({ where: { userId } }),
  ]);
  return { items, total, pages: Math.ceil(total / limit), page };
}

export async function getInvoice(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { promoCode: true } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.userId !== userId) throw ApiError.forbidden();
  return invoice;
}

/**
 * Pays an invoice using the given gateway. Returns the updated invoice.
 * - akf / wallet: instant payment
 * - manual / other gateways: pending (admin approves in Payments)
 */
export async function payInvoice(userId: string, invoiceId: string, gateway: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.userId !== userId) throw ApiError.forbidden();
  if (invoice.status === "paid") throw ApiError.badRequest("Invoice already paid");
  if (invoice.status === "refunded" || invoice.status === "cancelled") throw ApiError.badRequest("Invoice cannot be paid");

  const gateways = await getGateways();
  const gw = gateways.find((g) => g.id === gateway);
  if (!gw || !gw.enabled) throw ApiError.badRequest("Payment method unavailable");

  if (gateway === "akf") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.coins < invoice.amount) throw ApiError.badRequest(`Insufficient AKF coins (need ${invoice.amount})`);
    await wallet.debitCoins(userId, invoice.amount, `Paid invoice ${invoice.number}`, "invoice", invoice.id, { gateway: "akf" });
    return markPaid(invoice.id, "akf");
  }

  if (gateway === "wallet") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < invoice.amount) throw ApiError.badRequest(`Insufficient wallet balance (need ${currencySymbol(invoice.currency)}${invoice.amount.toFixed(2)})`);
    await wallet.debitBalance(userId, invoice.amount, `Paid invoice ${invoice.number}`, "invoice", invoice.id, { gateway: "wallet" });
    return markPaid(invoice.id, "wallet");
  }

  // External / manual gateways → pending approval (admin confirms in Payments)
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { gateway, status: "pending", meta: JSON.stringify({ ...safeObj(invoice.meta), awaiting: "admin_approval", gatewayNote: gw.name }) },
  });
  return updated;
}

/** Internal: mark an invoice paid and apply its items. */
export async function markPaid(invoiceId: string, gateway: string, opts: { byUserId?: string } = {}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status === "paid") return invoice;

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "paid", gateway, paidAt: new Date(), meta: JSON.stringify({ ...safeObj(invoice.meta), approvedBy: opts.byUserId ?? "system" }) },
  });

  const items = JSON.parse(invoice.items || "[]") as any[];
  // Apply plan purchases (creates the server) or balance top-ups.
  // If provisioning fails, refund what was charged (for akf/wallet) and put the
  // invoice back to pending so the user (or admin) can retry instead of losing money.
  try {
    if (items.some((i) => i.type === "plan")) {
      await materializePlanInvoice(invoice.userId, invoiceId, items);
    } else if (items.some((i) => i.type === "custom_server")) {
      await materializeCustomInvoice(invoice.userId, invoiceId, items);
    } else if (items.some((i) => i.type === "balance")) {
      const balanceItem = items.find((i) => i.type === "balance");
      await wallet.creditBalance(invoice.userId, balanceItem.amount, `Balance top-up ${invoice.number}`, "invoice", invoice.id);
    }
  } catch (e) {
    console.error("[billing] plan materialization failed", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    try {
      if (gateway === "akf") await wallet.creditCoins(invoice.userId, invoice.amount, `Refund — ${invoice.number} failed to provision`, "invoice", invoice.id);
      else if (gateway === "wallet") await wallet.creditBalance(invoice.userId, invoice.amount, `Refund — ${invoice.number} failed to provision`, "invoice", invoice.id);
    } catch {
      /* refund must never mask the original error */
    }
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "pending", meta: JSON.stringify({ ...safeObj(invoice.meta), materializeError: errMsg }) },
    });
    throw e;
  }

  await notifyUser(invoice.userId, {
    type: "payment_received",
    title: "Payment received ✅",
    body: `Invoice ${invoice.number} for ${currencySymbol(invoice.currency)}${invoice.amount.toFixed(2)} was paid via ${gateway.toUpperCase()}.`,
    data: { invoiceId: invoice.id },
  });
  return updated;
}

export async function cancelInvoice(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.userId !== userId) throw ApiError.forbidden();
  if (invoice.status !== "pending" && invoice.status !== "draft") throw ApiError.badRequest("Invoice cannot be cancelled");
  return prisma.invoice.update({ where: { id: invoiceId }, data: { status: "cancelled" } });
}

// ---------- Balance top-up ----------

export async function createTopupInvoice(userId: string, amount: number, description = "Wallet top-up") {
  if (amount < 1 || amount > 5000) throw ApiError.badRequest("Top-up between $1 and $5000");
  const currency = String((await settings.get("currency")) || "USD");
  const count = await prisma.invoice.count();
  return prisma.invoice.create({
    data: {
      number: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
      userId,
      amount,
      currency,
      description,
      items: JSON.stringify([{ type: "balance", label: description, amount }]),
    },
  });
}

// ---------- Refunds ----------

export async function requestRefund(userId: string, invoiceId: string, reason: string) {
  const invoice = await getInvoice(userId, invoiceId);
  if (invoice.status !== "paid") throw ApiError.badRequest("Only paid invoices can be refunded");
  const existing = await prisma.refundRequest.findFirst({ where: { invoiceId, userId, status: "pending" } });
  if (existing) throw ApiError.badRequest("Refund request already pending");
  return prisma.refundRequest.create({ data: { invoiceId, userId, reason } });
}

export async function listTransactions(userId: string, page = 1, limit = 20) {
  return wallet.getTransactions(userId, page, limit);
}

function safeObj(raw: string | null): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
