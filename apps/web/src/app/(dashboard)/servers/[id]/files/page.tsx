"use client";

import { useParams } from "next/navigation";
import { ServerLayout } from "@/components/server-layout";
import { FileManager } from "@/components/file-manager";

export default function FilesPage() {
  const params = useParams<{ id: string }>();
  return (
    <ServerLayout>
      <FileManager uuid={params.id} />
    </ServerLayout>
  );
}
