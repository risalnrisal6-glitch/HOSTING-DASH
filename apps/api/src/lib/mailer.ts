import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";
import { prisma } from "../db";
import { settings } from "../services/settings";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const smtp = { ...config.smtp };
  if (!smtp.host) return null;
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  return transporter;
}

/**
 * Sends an email. Mail settings are read from the admin panel settings first
 * (SMTP_HOST etc.), falling back to env. When no SMTP is configured the email
 * is stored in the EmailOutbox table with status "logged" so admins can still
 * inspect it during development.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<{ status: string; id?: string }> {
  const s = await settings.getAll();
  const host = String(s.mail_host || "") || config.smtp.host;
  const from = String(s.mail_from || "") || config.smtp.from;

  const outbox = await prisma.emailOutbox.create({ data: { to, subject, body: html, status: "pending" } });

  if (!host) {
    await prisma.emailOutbox.update({ where: { id: outbox.id }, data: { status: "logged" } });
    console.log(`\n[MAIL:LOGGED] to=${to} subject="${subject}" (no SMTP configured — see outbox ${outbox.id})\n`);
    return { status: "logged", id: outbox.id };
  }

  try {
    const tr = getTransporter();
    if (!tr) throw new Error("transporter unavailable");
    await tr.sendMail({
      from,
      to,
      subject,
      html,
    });
    await prisma.emailOutbox.update({ where: { id: outbox.id }, data: { status: "sent" } });
    return { status: "sent", id: outbox.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.emailOutbox.update({ where: { id: outbox.id }, data: { status: "failed", error: message } });
    return { status: "failed", id: outbox.id };
  }
}

export function renderLayout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b0d1a;font-family:Arial,sans-serif;padding:32px">
  <div style="max-width:560px;margin:auto;background:linear-gradient(135deg,#131733,#0d1027);border:1px solid rgba(139,92,246,.25);border-radius:16px;padding:32px">
    <div style="font-size:20px;font-weight:700;background:linear-gradient(90deg,#a78bfa,#60a5fa);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:20px">NOVA&nbsp;PANEL</div>
    <div style="color:#e2e8f0;font-size:15px;line-height:1.6">${body}</div>
    <div style="color:#64748b;font-size:12px;margin-top:28px">© ${new Date().getFullYear()} NOVA PANEL — Premium Hosting</div>
  </div></body></html>`;
}
