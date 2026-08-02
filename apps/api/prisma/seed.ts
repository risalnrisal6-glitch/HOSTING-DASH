import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../src/services/settings";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding NOVA PANEL database...");

  // ---- Settings ----
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.settings.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: {} });
  }

  // Reward defaults
  const rewardDefaults: Record<string, unknown> = {
    daily_checkin: { amount: 25, streakBonus: 5, enabled: true },
    weekly_checkin: { amount: 150, enabled: true },
    monthly_checkin: { amount: 500, enabled: true },
    ad_watch: { amount: 5, cooldownMinutes: 3, dailyLimit: 10, enabled: true },
    referral: { referrer: 50, referred: 25, enabled: true },
    vote: { amount: 15, cooldownHours: 12, url: "https://top.gg", enabled: true },
    spin_wheel: {
      enabled: true,
      cost: 0,
      dailyLimit: 5,
      segments: [
        { label: "+5", coins: 5, weight: 30, color: "#818cf8" },
        { label: "+10", coins: 10, weight: 25, color: "#a78bfa" },
        { label: "+25", coins: 25, weight: 18, color: "#60a5fa" },
        { label: "+50", coins: 50, weight: 12, color: "#c084fc" },
        { label: "+100", coins: 100, weight: 8, color: "#f472b6" },
        { label: "+250", coins: 250, weight: 4, color: "#fbbf24" },
        { label: "+500", coins: 500, weight: 2, color: "#34d399" },
        { label: "+1000", coins: 1000, weight: 1, color: "#f87171" },
      ],
    },
  };
  for (const [key, value] of Object.entries(rewardDefaults)) {
    await prisma.settings.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: {} });
  }

  // ---- Users ----
  const adminHash = await bcrypt.hash("Admin@12345", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@nova.dev" },
    create: {
      email: "admin@nova.dev",
      username: "NovaAdmin",
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
      balance: 250,
      coins: 100000,
      referralCode: "NOVAADMIN",
      avatar: "https://api.dicebear.com/9.x/initials/svg?seed=NovaAdmin&backgroundColor=8b5cf6",
    },
    update: {},
  });



  // ---- Plans ----
  const plans = [
    { name: "Starter", slug: "starter", price: 2.99, cycle: "monthly", ram: 1024, cpu: 100, disk: 10240, databases: 1, backups: 1, allocations: 1, nestId: "3", eggId: "13", dockerImage: "ghcr.io/pterodactyl/yolks:node_20", locationId: "2", sort: 1, description: "Perfect for small bots, websites and APIs." },
    { name: "Gaming", slug: "gaming", price: 5.99, cycle: "monthly", ram: 4096, cpu: 200, disk: 20480, databases: 2, backups: 2, allocations: 1, nestId: "1", eggId: "2", dockerImage: "ghcr.io/pterodactyl/yolks:java_21", locationId: "1", sort: 2, description: "Minecraft, Terraria & more — up to 20 players." },
    { name: "Pro", slug: "pro", price: 12.99, cycle: "monthly", ram: 8192, cpu: 300, disk: 40960, databases: 3, backups: 4, allocations: 2, nestId: "1", eggId: "1", dockerImage: "ghcr.io/pterodactyl/yolks:java_21", locationId: "1", sort: 3, description: "Heavy Minecraft, modpacks and resource-hungry games." },
    { name: "Ultimate", slug: "ultimate", price: 24.99, cycle: "monthly", ram: 16384, cpu: 400, disk: 81920, databases: 5, backups: 6, allocations: 3, nestId: "1", eggId: "2", dockerImage: "ghcr.io/pterodactyl/yolks:java_21", locationId: "1", sort: 4, description: "Top-tier hardware for large networks and studios." },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      create: { ...p, environment: "{}", active: true },
      update: {},
    });
  }

  // ---- Shop items ----
  const shop = [
    { type: "ram", name: "RAM", unit: "256 MB", price: 15, minUnits: 1, maxPerUser: 100, sort: 1 },
    { type: "cpu", name: "CPU", unit: "10%", price: 12, minUnits: 1, maxPerUser: 30, sort: 2 },
    { type: "disk", name: "Disk", unit: "1 GB", price: 8, minUnits: 1, maxPerUser: 200, sort: 3 },
    { type: "databases", name: "Database", unit: "DB", price: 10, minUnits: 1, maxPerUser: 25, sort: 4 },
    { type: "backups", name: "Backup Slot", unit: "BK", price: 6, minUnits: 1, maxPerUser: 50, sort: 5 },
    { type: "allocations", name: "Allocation", unit: "AL", price: 5, minUnits: 1, maxPerUser: 25, sort: 6 },
    { type: "slots", name: "Server Slot", unit: "slot", price: 50, minUnits: 1, maxPerUser: 10, sort: 7 },
  ];
  for (const s of shop) {
    await prisma.shopItem.upsert({ where: { type: s.type }, create: { ...s, price: s.price, discount: 0, stock: -1, enabled: true }, update: {} });
  }

  // ---- Tasks ----
  const tasks = [
    { title: "Join our Discord", description: "Join the NOVA community on Discord", type: "join_discord", url: "https://discord.gg/nova", reward: 100 },
    { title: "Follow us on X", description: "Follow @novapanel on X", type: "link", url: "https://x.com/novapanel", reward: 50 },
    { title: "Vote for us", description: "Vote for NOVA on our server list", type: "vote", url: "https://top.gg", reward: 75 },
    { title: "Share your referral link", description: "Invite 1 friend and earn 50 AKF", type: "link", url: "", reward: 25 },
  ];
  for (const [i, t] of tasks.entries()) {
    const existing = await prisma.task.findFirst({ where: { title: t.title } });
    if (!existing) await prisma.task.create({ data: { ...t, cooldownHours: 24, sort: i, enabled: true } });
  }


  // ---- Announcement ----
  const annCount = await prisma.announcement.count();
  if (annCount === 0) {
    await prisma.announcement.create({
      data: {
        title: "Welcome to NOVA PANEL 🚀",
        body: "Your hosting dashboard is ready. Configure your Pterodactyl panel in Admin → Settings to start deploying servers.",
        type: "promo",
        active: true,
      },
    });
  }

  // ---- Giveaway ----
  const gwCount = await prisma.giveaway.count();
  if (gwCount === 0) {
    await prisma.giveaway.create({
      data: {
        title: "Grand Opening Giveaway",
        description: "Win 500 AKF coins to kickstart your hosting journey!",
        prize: "500 AKF Coins",
        coins: 500,
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 7 * 86400000),
        status: "running",
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log("   Admin login:  admin@nova.dev / Admin@12345");
  console.log(`   Admin user id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
