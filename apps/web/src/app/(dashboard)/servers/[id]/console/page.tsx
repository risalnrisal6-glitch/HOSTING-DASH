"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { get } from "@/lib/api";
import { ServerLayout } from "@/components/server-layout";
import { ServerConsole } from "@/components/server-console";
import type { Server } from "@/lib/types";

export default function ConsolePage() {
  const params = useParams<{ id: string }>();
  const { data } = useSWR<{ server: Server }>(`/servers/${params.id}`, (url: string) => get(url));

  return (
    <ServerLayout>
      <ServerConsole uuid={params.id} status={data?.server.status || "OFFLINE"} />
    </ServerLayout>
  );
}
