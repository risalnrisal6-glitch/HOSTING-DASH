"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { get } from "@/lib/api";
import type { PublicConfig } from "@/lib/types";

/**
 * Client component that updates the <title> and favicon <link> at runtime
 * using the site_name / site_favicon settings from the backend.
 * Renders nothing — it's a side-effect-only script.
 */
export function DynamicBranding() {
  const { data: config } = useSWR<PublicConfig>("/public/config", (url: string) => get<PublicConfig>(url), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
  const set = useRef(false);

  useEffect(() => {
    if (!config?.settings || set.current) return;
    set.current = true;

    const s = config.settings;

    // Update page title
    const siteName = s.site_name || "NOVA PANEL";
    const desc = s.site_description || "Premium Pterodactyl hosting dashboard";
    document.title = `${siteName} — Premium Hosting`;
    document.querySelector("meta[name='description']")?.setAttribute("content", desc);

    // Update favicon if a custom one is configured
    const favicon = s.site_favicon as string | undefined;
    if (favicon && favicon.trim()) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon.trim();
    }
  }, [config]);

  return null;
}