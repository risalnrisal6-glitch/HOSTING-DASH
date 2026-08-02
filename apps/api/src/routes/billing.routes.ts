import { Router } from "express";
import { asyncH } from "../lib/errors";
import { requireAuth, AuthedRequest } from "../lib/rbac";
import { z } from "zod";
import { validateBody } from "../lib/validate";
import * as billing from "../services/billing.service";
import { audit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

router.get(
  "/gateways",
  asyncH(async (_req, res) => {
    res.json({ ok: true, data: await billing.getGateways() });
  })
);

router.get(
  "/invoices",
  asyncH(async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 10), 50);
    res.json({ ok: true, data: await billing.listInvoices((req as AuthedRequest).user.id, page, limit) });
  })
);

router.get(
  "/invoices/:id",
  asyncH(async (req, res) => {
    res.json({ ok: true, data: await billing.getInvoice((req as AuthedRequest).user.id, req.params.id) });
  })
);

// ---- Top-up & pay ----
router.post(
  "/topup",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ amount: z.number().min(1).max(5000) }), req);
    const invoice = await billing.createTopupInvoice((req as AuthedRequest).user.id, data.amount);
    await audit(req, "billing.topup", "invoice", invoice.id, { amount: data.amount });
    res.status(201).json({ ok: true, data: invoice });
  })
);

router.post(
  "/invoices/:id/pay",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ gateway: z.string().min(1) }), req);
    const invoice = await billing.payInvoice((req as AuthedRequest).user.id, req.params.id, data.gateway);
    await audit(req, "billing.pay", "invoice", invoice.id, { gateway: data.gateway });
    res.json({ ok: true, data: invoice });
  })
);

router.post(
  "/invoices/:id/cancel",
  asyncH(async (req, res) => {
    const invoice = await billing.cancelInvoice((req as AuthedRequest).user.id, req.params.id);
    res.json({ ok: true, data: invoice });
  })
);

// ---- Refunds ----
router.post(
  "/refunds",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ invoiceId: z.string().min(1), reason: z.string().min(5).max(500) }), req);
    const refund = await billing.requestRefund((req as AuthedRequest).user.id, data.invoiceId, data.reason);
    await audit(req, "billing.refund_request", "invoice", data.invoiceId);
    res.status(201).json({ ok: true, data: refund });
  })
);

// ---- Transactions ----
router.get(
  "/transactions",
  asyncH(async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 50);
    res.json({ ok: true, data: await billing.listTransactions((req as AuthedRequest).user.id, page, limit) });
  })
);

export default router;
