import { createApp } from "./app";
import { config } from "./config";
import { settings } from "./services/settings";
import { closeCache } from "./lib/cache";
import { prisma } from "./db";

async function main() {
  await settings.init();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`\n🚀 NOVA PANEL API listening on http://localhost:${config.port}`);
    console.log(`   Health: http://localhost:${config.port}/api/health\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close();
    await closeCache();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("Failed to start API:", e);
  process.exit(1);
});
