import { prisma } from "../db";
import { settings } from "./settings";
import { ApiError } from "../lib/errors";
import { notifyUser } from "./notify.service";

export interface TicketInput {
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  body: string;
  attachments?: { name: string; url: string }[];
}

export async function createTicket(userId: string, input: TicketInput): Promise<{ id: string }> {
  const categories = (await settings.get("ticket_categories")) as string[];
  if (categories && categories.length && !categories.includes(input.category)) {
    throw ApiError.badRequest("Invalid ticket category");
  }
  const ticket = await prisma.ticket.create({
    data: { userId, subject: input.subject, category: input.category, priority: input.priority },
  });
  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      userId,
      body: input.body,
      attachments: JSON.stringify(input.attachments ?? []),
    },
  });
  return { id: ticket.id };
}

export async function listTickets(userId: string, page = 1, limit = 10, status?: string) {
  const where = { userId, ...(status && status !== "all" ? { status } : {}) };
  const [items, total] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { messages: { take: 1, orderBy: { createdAt: "desc" } } } }),
    prisma.ticket.count({ where }),
  ]);
  return { items, total, pages: Math.ceil(total / limit), page };
}

export async function getTicket(userId: string, ticketId: string, staff = false) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!ticket) throw ApiError.notFound("Ticket not found");
  if (ticket.userId !== userId && !staff) throw ApiError.forbidden();
  return ticket;
}

export async function replyToTicket(user: { id: string; username: string; role: string }, ticketId: string, body: string, attachments: { name: string; url: string }[] = [], isInternal = false) {
  const isStaff = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR";
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw ApiError.notFound("Ticket not found");
  if (ticket.userId !== user.id && !isStaff) throw ApiError.forbidden();
  if (ticket.status === "closed" && !isStaff) throw ApiError.badRequest("Ticket is closed");

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId,
      userId: user.id,
      body,
      attachments: JSON.stringify(attachments ?? []),
      isStaff,
      isInternal: isInternal && isStaff,
    },
  });

  const newStatus = isStaff ? "answered" : ticket.status === "closed" ? "open" : "open";
  await prisma.ticket.update({ where: { id: ticketId }, data: { status: newStatus } });

  // Notify the other side
  const targetId = isStaff ? ticket.userId : await firstStaffId();
  if (targetId && targetId !== user.id) {
    await notifyUser(targetId, {
      type: "ticket_reply",
      title: `New reply on #${ticket.subject}`,
      body: `${user.username} replied to your ticket.`,
      data: { ticketId },
    });
  }
  return message;
}

async function firstStaffId(): Promise<string | null> {
  const staff = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN", "MODERATOR"] }, status: "active" },
    select: { id: true },
  });
  return staff?.id ?? null;
}

export async function setTicketStatus(user: { id: string; role: string }, ticketId: string, status: string) {
  const isStaff = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR";
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw ApiError.notFound("Ticket not found");
  if (ticket.userId !== user.id && !isStaff) throw ApiError.forbidden();
  if (!["open", "answered", "closed"].includes(status)) throw ApiError.badRequest("Invalid status");
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status, closedAt: status === "closed" ? new Date() : null, closedById: status === "closed" ? user.id : null },
  });
}

export async function setInternalNote(user: { id: string; role: string }, ticketId: string, note: string) {
  const isStaff = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR";
  if (!isStaff) throw ApiError.forbidden();
  return prisma.ticket.update({ where: { id: ticketId }, data: { internalNote: note } });
}
