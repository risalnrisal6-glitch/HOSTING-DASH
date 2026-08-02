import { prisma } from "../db";
import { settings } from "./settings";
import { ApiError } from "../lib/errors";

export async function getReferralStats(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { referredBy: { select: { username: true } } } });
  if (!user) throw ApiError.notFound();

  const [count, totalEarned, paid] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.referral.aggregate({ where: { referrerId: userId }, _sum: { rewardReferrer: true } }),
    prisma.referral.count({ where: { referrerId: userId, status: "paid" } }),
  ]);

  const recent = await prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { referred: { select: { username: true, avatar: true, createdAt: true } } },
  });

  return {
    code: user.referralCode,
    link: `${process.env.PUBLIC_URL || "http://localhost:3000"}/register?ref=${user.referralCode}`,
    invitedBy: user.referredBy?.username ?? null,
    count,
    paid,
    totalEarned: totalEarned._sum.rewardReferrer ?? 0,
    recent,
    config: await settings.get("referral"),
  };
}

export async function getLeaderboard(limit = 20) {
  const refs = await prisma.referral.groupBy({
    by: ["referrerId"],
    _count: { _all: true },
    _sum: { rewardReferrer: true },
    orderBy: { _count: { referrerId: "desc" } },
    take: limit,
  });
  const userIds = refs.map((r) => r.referrerId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, avatar: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return refs.map((r, i) => ({
    rank: i + 1,
    username: byId.get(r.referrerId)?.username ?? "unknown",
    avatar: byId.get(r.referrerId)?.avatar ?? null,
    count: r._count._all,
    totalEarned: r._sum.rewardReferrer ?? 0,
  }));
}
