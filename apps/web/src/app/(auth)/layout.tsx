"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isLoading && user) {
      router.replace("/");
    }
  }, [isReady, isLoading, user, router]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="nova-aurora" />
      <div className="nova-grid" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">{children}</div>
    </div>
  );
}
