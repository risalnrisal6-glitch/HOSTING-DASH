"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { FullPageLoader } from "@/components/ui";
import { AfkEarner } from "@/components/afk-earner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isLoading && !user) {
      router.replace("/login");
    }
  }, [isReady, isLoading, user, router]);

  if (!isReady || isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="nova-aurora" />
        <FullPageLoader label="Authenticating..." />
      </div>
    );
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      <AfkEarner />
    </>
  );
}
