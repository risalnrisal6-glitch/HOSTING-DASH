import { prisma } from "../db";
import { encrypt, decrypt, isEncrypted } from "../lib/crypto";
import { config } from "../config";

// ============================================================
// Settings service
// Secrets (panel keys, oauth secrets, smtp password, payment keys)
// are AES-256-GCM encrypted at rest. Everything is configurable from
// the Admin Panel → Settings page, no code changes required.
// ============================================================

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  site_name: "NOVA PANEL",
  site_logo: "",
  site_favicon: "", // empty = default NOVA icon
  site_description: "Premium Pterodactyl hosting dashboard",
  currency: "INR",
  coin_name: "AKF",
  wallet_enabled: true,
  coins_enabled: true,

  // Pricing — per-resource build-your-own rates (admin configurable)
  pricing_enabled: true,
  pricing_ram_per_gb: 40, // INR per 1GB RAM
  pricing_disk_per_gb: 15, // INR per 1GB NVMe SSD
  pricing_cpu_per_core: 60, // INR per 1 CPU core
  pricing_cycle: "monthly",
  pricing_storage_label: "NVMe SSD",
  pricing_min_ram: 1,
  pricing_max_ram: 128,
  pricing_min_disk: 1,
  pricing_max_disk: 2000,
  pricing_min_cores: 1,
  pricing_max_cores: 32,

  // Rewards — welcome bonus + AFK earning (admin configurable)
  welcome_bonus_enabled: true,
  welcome_bonus_coins: 100,
  afk_enabled: true,
  afk_coins_per_min: 30,
  afk_interval_minutes: 1,
  afk_daily_limit: 500,
  // Pterodactyl connection (secrets encrypted)
  panel_enabled: false,
  panel_url: "",
  panel_app_key: "",
  panel_client_key: "",
  default_node: "",
  default_location: "",
  default_nest: "",
  default_egg: "",
  default_docker_image: "",

  // Mail
  mail_enabled: false,
  mail_from: "NOVA PANEL <no-reply@nova.panel>",
  mail_host: "",
  mail_port: 587,
  mail_user: "",
  mail_pass: "",
  mail_secure: false,

  // OAuth (secrets encrypted)
  oauth_discord_enabled: false,
  oauth_discord_client_id: "",
  oauth_discord_client_secret: "",
  oauth_discord_redirect: "",
  oauth_google_enabled: false,
  oauth_google_client_id: "",
  oauth_google_client_secret: "",
  oauth_google_redirect: "",

  // Payments (secrets encrypted)
  pay_stripe_enabled: false,
  pay_stripe_pk: "",
  pay_stripe_sk: "",
  pay_stripe_webhook_secret: "",
  pay_paypal_enabled: false,
  pay_paypal_client_id: "",
  pay_paypal_secret: "",
  pay_paypal_mode: "sandbox",
  pay_razorpay_enabled: false,
  pay_razorpay_key_id: "",
  pay_razorpay_key_secret: "",
  pay_upi_enabled: false,
  pay_upi_id: "",
  pay_crypto_enabled: false,
  pay_crypto_addresses: {},
  pay_manual_enabled: true,

  // Security
  security_registration: true,
  security_email_verify: false,
  security_2fa_required: false,
  security_min_password: 8,
  security_suspicious_lockout: true,

  // Tickets
  ticket_categories: ["General", "Billing", "Technical Support", "Server Issue", "Abuse Report"],
  ticket_attachments: true,

  // Store
  store_auto_create: true,
  max_servers_per_user: 10,
  trial_enabled: false,
  trial_hours: 24,
};

const SENSITIVE_KEY_HINT = /(secret|key|pass|token|sk_|_sk$)/i;

function isSensitive(key: string): boolean {
  if (key === "mail_port" || key === "security_min_password") return false;
  return SENSITIVE_KEY_HINT.test(key) && !key.endsWith("_id") && !key.endsWith("_pk");
}

let cache: Record<string, unknown> | null = null;

async function load(): Promise<Record<string, unknown>> {
  const rows = await prisma.settings.findMany();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.value);
      if (typeof parsed === "string" && isEncrypted(parsed) && isSensitive(row.key)) {
        out[row.key] = decrypt(parsed);
      } else {
        out[row.key] = parsed;
      }
    } catch {
      /* ignore corrupt rows */
    }
  }
  return out;
}

async function getAll(): Promise<Record<string, unknown>> {
  if (!cache) cache = await load();
  return cache;
}

async function invalidate(): Promise<void> {
  cache = null;
  await load();
}

async function set(key: string, value: unknown): Promise<void> {
  let stored: unknown = value;
  if (isSensitive(key) && typeof value === "string" && value !== "") {
    stored = encrypt(value);
  }
  await prisma.settings.upsert({
    where: { key },
    create: { key, value: JSON.stringify(stored) },
    update: { value: JSON.stringify(stored) },
  });
  await invalidate();
}

async function setMany(values: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    let stored: unknown = value;
    if (isSensitive(key) && typeof value === "string" && value !== "") stored = encrypt(value);
    await prisma.settings.upsert({
      where: { key },
      create: { key, value: JSON.stringify(stored) },
      update: { value: JSON.stringify(stored) },
    });
  }
  await invalidate();
}

/** Keys that may be returned to the client (no secrets). */
const PUBLIC_KEYS = [
  "site_name",
  "site_logo",
  "site_favicon",
  "site_description",
  "currency",
  "coin_name",
  "wallet_enabled",
  "coins_enabled",
  "pricing_enabled",
  "pricing_ram_per_gb",
  "pricing_disk_per_gb",
  "pricing_cpu_per_core",
  "pricing_cycle",
  "pricing_storage_label",
  "pricing_min_ram",
  "pricing_max_ram",
  "pricing_min_disk",
  "pricing_max_disk",
  "pricing_min_cores",
  "pricing_max_cores",
  "welcome_bonus_enabled",
  "welcome_bonus_coins",
  "afk_enabled",
  "afk_coins_per_min",
  "afk_interval_minutes",
  "panel_enabled",
  "security_registration",
  "security_email_verify",
  "security_2fa_required",
  "oauth_discord_enabled",
  "oauth_google_enabled",
  "pay_stripe_enabled",
  "pay_paypal_enabled",
  "pay_razorpay_enabled",
  "pay_upi_enabled",
  "pay_crypto_enabled",
  "pay_manual_enabled",
  "ticket_categories",
  "ticket_attachments",
  "store_auto_create",
  "max_servers_per_user",
  "trial_enabled",
  "trial_hours",
];

async function getPublic(): Promise<Record<string, unknown>> {
  const all = await getAll();
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_KEYS) out[key] = all[key];
  return out;
}

export const settings = {
  getAll,
  getPublic,
  set,
  setMany,
  invalidate,
  isPanelConfigured: async (): Promise<boolean> => {
    const s = await getAll();
    return !!(s.panel_enabled && s.panel_url && s.panel_app_key);
  },
  panelConfig: async (): Promise<{ url: string; appKey: string; clientKey: string }> => {
    const s = await getAll();
    return {
      url: String(s.panel_url || "").replace(/\/+$/, ""),
      appKey: String(s.panel_app_key || ""),
      clientKey: String(s.panel_client_key || ""),
    };
  },
  get: async (key: string): Promise<unknown> => {
    const all = await getAll();
    return all[key];
  },
  /** Warm the cache on boot. */
  init: async () => {
    await getAll();
  },
};

export function isSensitiveKey(key: string): boolean {
  return isSensitive(key);
}
