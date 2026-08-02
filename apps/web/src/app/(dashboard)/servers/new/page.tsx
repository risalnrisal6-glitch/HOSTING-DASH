"use client";

import { motion } from "framer-motion";
import { ServerCreateWizard } from "@/components/server-create-wizard";

export default function NewServerPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">Deploy a new server</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick a nest and egg — everything is discovered automatically from your connected Pterodactyl panel.
        </p>
      </div>
      <ServerCreateWizard />
    </motion.div>
  );
}
