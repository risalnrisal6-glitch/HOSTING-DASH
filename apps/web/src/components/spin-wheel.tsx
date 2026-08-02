"use client";

import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { toast } from "sonner";
import type { WheelConfig } from "@/lib/types";
import { post } from "@/lib/api";
import { Button } from "@/components/ui";
import { cn } from "@/lib/format";

export function SpinWheel({ config }: { config: WheelConfig }) {
  const controls = useAnimation();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinsToday, setSpinsToday] = useState(0);

  const segments = config.segments;
  const segAngle = 360 / segments.length;

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      const result = await post<{ segmentIndex: number; coins: number; result: string }>("/wallet/spin", {});
      // Land the winning segment at the top pointer
      const targetIndex = result.segmentIndex;
      const extra = 5 * 360;
      const targetRotation = rotation + extra - (targetIndex * segAngle) - (segAngle / 2);
      setRotation(targetRotation);
      await controls.start({ rotate: targetRotation, transition: { duration: 4.5, ease: [0.12, 0.8, 0.15, 1] } });
      toast.success(`You won ${result.result} AKF coins! 🎉`);
      setSpinsToday((s) => s + 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        {/* Pointer */}
        <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2">
          <div className="h-0 w-0 border-l-8 border-r-8 border-t-[14px] border-l-transparent border-r-transparent border-t-violet-400 drop-shadow-lg" />
        </div>
        <div className="relative h-64 w-64 overflow-hidden rounded-full border-4 border-white/10 shadow-glow sm:h-72 sm:w-72" style={{ background: "#0b0d1c" }}>
          <motion.div animate={controls} style={{ width: "100%", height: "100%", position: "relative" }} className="will-change-transform">
            {segments.map((seg, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 flex items-center justify-center"
                style={{
                  width: "50%",
                  height: "50%",
                  transformOrigin: "0 0",
                  transform: `translate(0, 0) rotate(${i * segAngle}deg)`,
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  background: seg.color,
                  opacity: 0.85,
                }}
              >
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-0 text-[11px] font-bold text-white drop-shadow" style={{ transform: `rotate(${90}deg) translateY(-34px)` }}>
                  {seg.label}
                </span>
              </div>
            ))}
          </motion.div>
          <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
          <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)" }} />
        </div>
      </div>
      <Button size="lg" onClick={spin} loading={spinning} disabled={!config.enabled || (config.dailyLimit > 0 && spinsToday >= config.dailyLimit)} className="min-w-44">
        {config.cost > 0 ? `Spin (${config.cost} AKF)` : "Spin the wheel"}
      </Button>
      {config.dailyLimit > 0 && (
        <p className="text-xs text-slate-500">{Math.max(0, config.dailyLimit - spinsToday)} spins left today</p>
      )}
    </div>
  );
}
