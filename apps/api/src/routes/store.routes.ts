import { Router } from "express";
import { asyncH } from "../lib/errors";
import { requireAuth, AuthedRequest } from "../lib/rbac";
import { z } from "zod";
import { validateBody } from "../lib/validate";
import * as store from "../services/store.service";
import { audit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

router.get(
  "/plans",
  asyncH(async (_req, res) => {
    res.json({ ok: true, data: await store.listPlans() });
  })
);

router.get(
  "/shop",
  asyncH(async (_req, res) => {
    res.json({ ok: true, data: await store.listShopItems() });
  })
);

router.post(
  "/shop/purchase",
  asyncH(async (req, res) => {
    const data = validateBody(
      z.object({
        type: z.enum(["ram", "cpu", "disk", "databases", "backups", "allocations", "slots"]),
        units: z.number().int().min(1).max(500),
        serverId: z.string().optional(),
      }),
      req
    );
    const result = await store.purchaseResource((req as AuthedRequest).user.id, data.type, data.units, data.serverId);
    await audit(req, "store.purchase", "shopItem", data.type, { units: data.units, serverId: data.serverId });
    res.json({ ok: true, data: result });
  })
);

router.get(
  "/pricing",
  asyncH(async (_req, res) => {
    res.json({ ok: true, data: await store.getPricingConfig() });
  })
);

router.post(
  "/custom/invoice",
  asyncH(async (req, res) => {
    const data = validateBody(
      z.object({
        ramGb: z.number().min(1).max(1024),
        diskGb: z.number().min(1).max(10000),
        cores: z.number().min(1).max(128),
        cycle: z.enum(["one_time", "monthly", "yearly", "lifetime"]),
      }),
      req
    );
    const invoice = await store.createCustomInvoice((req as AuthedRequest).user.id, data);
    await audit(req, "store.custom_invoice", "invoice", invoice.id, { ramGb: data.ramGb, diskGb: data.diskGb, cores: data.cores, cycle: data.cycle });
    res.status(201).json({ ok: true, data: invoice });
  })
);

router.post(
  "/plan/invoice",
  asyncH(async (req, res) => {
    const data = validateBody(
      z.object({
        planId: z.string().min(1),
        cycle: z.enum(["one_time", "monthly", "yearly", "lifetime"]),
        promoCode: z.string().optional(),
      }),
      req
    );
    const invoice = await store.createPlanInvoice((req as AuthedRequest).user.id, data.planId, data.cycle, data.promoCode);
    await audit(req, "store.plan_invoice", "plan", data.planId, { cycle: data.cycle });
    res.status(201).json({ ok: true, data: invoice });
  })
);

export default router;
