"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Timer, Coins } from "lucide-react";
import { get, post } from "@/lib/api";

interface PublicConfig {
  settings: Record<string, any>;
}

/**
 * Passive AFK earner — while the user keeps the panel open, coins are granted
 * every configured interval (server-side enforced with a daily cap). Shows a
 * small live indicator bottom-right and a toast on every grant.
 */
export function AfkEarner() {
  const { data } = useSWR<PublicConfig>("/public/config", (url: string) => get(url));
  const [earned, setEarned] = useState(0);
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enabled = data?.settings?.afk_enabled === true;
  const perMin = Number(data?.settings?.afk_coins_per_min ?? 30) || 0;
  const intervalMin = Math.max(1, Number(data?.settings?.afk_interval_minutes ?? 1) || 1);
  const coinName = String(data?.settings?.coin_name || "AKF");

  useEffect(() => {
    if (!enabled || perMin <= 0) return;

    const tick = async () => {
      // Don't earn while the tab is hidden (keeps it fair & battery-friendly)
      if (document.hidden) {
        setActive(false);
        return;
      }
      try {
        const res = await post<{ reward: number; nextIn: number }>("/users/afk", {});
        if (res.reward > 0) {
          setEarned((e) => e + res.reward);
          setActive(true);
          toast.success(`+${res.reward} ${coinName} — AFK reward`);
        } else {
          setActive(false);
        }
      } catch {
        setActive(false);
      }
    };

    tick();
    timerRef.current = setInterval(tick, intervalMin * 60000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, perMin, intervalMin, coinName]);

  if (!enabled || perMin <= 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 select-none">
      <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#0b0d17]/90 px-4 py-2 shadow-glow backdrop-blur">
        <Timer className={active ? "h-4 w-4 animate-pulse text-emerald-400" : "h-4 w-4 text-slate-500"} />
        <span className="text-xs text-slate-300">
          AFK earning <span className="font-semibold text-emerald-400">+{perMin} {coinName}/min</span>
        </span>
        {earned > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <Coins className="h-3 w-3" /> +{earned} this session
          </span>
        )}
      </div>
    </div>
  );
}
