"use client";

import Image from "next/image";
import { cn } from "@/lib/format";

export function Avatar({ src, name, size = 32, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-white/10", className)}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 font-semibold text-white ring-1 ring-white/10", className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
