"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Save, Settings2, KeyRound, Tag } from "lucide-react";
import { get, post, patch } from "@/lib/api";
import { ServerLayout } from "@/components/server-layout";
import { Card, Button, Input, Textarea, Toggle } from "@/components/ui";
import { useAuth } from "@/lib/auth";

interface StartupData {
  startup: string;
  environment: Record<string, string>;
  egg: {
    id: string;
    name: string;
    docker_images: string[];
    variables: { env_variable: string; name: string; description: string; default_value: string; user_editable: boolean }[];
  } | null;
}

export default function ServerSettingsPage() {
  const params = useParams<{ id: string }>();
  const uuid = params.id;
  const { user } = useAuth();
  const { data, mutate } = useSWR(`/servers/${uuid}`, (url: string) => get(url));
  const { data: startup } = useSWR<StartupData>(`/servers/${uuid}/startup`, (url: string) => get(url));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [env, setEnv] = useState<Record<string, string>>({});
  const [startupCmd, setStartupCmd] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingStartup, setSavingStartup] = useState(false);

  const server = (data as any)?.server;

  useEffect(() => {
    if (server) {
      setName(server.name);
      setDescription(server.description || "");
    }
  }, [server]);

  useEffect(() => {
    if (startup) {
      setEnv(startup.environment || {});
      setStartupCmd(startup.startup || "");
    }
  }, [startup]);

  const saveInfo = async () => {
    setSaving(true);
    try {
      await patch(`/servers/${uuid}`, { name, description });
      toast.success("Server details saved");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveStartup = async () => {
    setSavingStartup(true);
    try {
      await post(`/servers/${uuid}/startup`, { startup: startupCmd, environment: env });
      toast.success("Startup configuration saved");
      mutate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingStartup(false);
    }
  };

  const setEnvVar = (key: string, value: string) => setEnv((e) => ({ ...e, [key]: value }));

  const vars = startup?.egg?.variables ?? [];
  const editableVars = vars.filter((v) => v.user_editable);
  const extraKeys = Object.keys(env).filter((k) => !vars.some((v) => v.env_variable === k));

  return (
    <ServerLayout>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* General */}
        <Card title="General settings" subtitle="Rename your server or update its description">
          <div className="space-y-4">
            <Input label="Server name" value={name} onChange={(e) => setName(e.target.value)} icon={<Tag className="h-4 w-4" />} />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this server for?" />
            <Button onClick={saveInfo} loading={saving} icon={<Save className="h-4 w-4" />}>Save changes</Button>
          </div>
        </Card>

        {/* SFTP */}
        <Card title="SFTP access" subtitle="Connect with FileZilla, WinSCP or any SFTP client">
          <SftpPanel uuid={uuid} />
        </Card>

        {/* Startup */}
        <Card title="Startup command" subtitle={`Egg: ${startup?.egg?.name || "Custom"}`} className="lg:col-span-2">
          <div className="space-y-4">
            <Input label="Startup command" value={startupCmd} onChange={(e) => setStartupCmd(e.target.value)} mono hint="Variables like ${MEMORY} are substituted automatically" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {editableVars.map((v) => (
                <Input
                  key={v.env_variable}
                  label={`${v.name} (${v.env_variable})`}
                  value={env[v.env_variable] ?? ""}
                  onChange={(e) => setEnvVar(v.env_variable, e.target.value)}
                  hint={v.description}
                />
              ))}
              {extraKeys.map((k) => (
                <Input key={k} label={`${k}`} value={env[k] ?? ""} onChange={(e) => setEnvVar(k, e.target.value)} hint="Custom environment variable" />
              ))}
            </div>
            <Button onClick={saveStartup} loading={savingStartup} icon={<Save className="h-4 w-4" />}>Save startup configuration</Button>
          </div>
        </Card>
      </div>
    </ServerLayout>
  );
}

function SftpPanel({ uuid }: { uuid: string }) {
  const { data } = useSWR(`/servers/${uuid}/sftp`, (url: string) => get(url));
  if (!data) return <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">Connection string</p>
        <p className="mt-1 font-mono text-sm text-emerald-300">sftp://{data.username}@{data.ip}:{data.port}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-slate-600">Host</p>
          <p className="mt-0.5 font-mono text-xs text-slate-300">{data.ip}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-slate-600">Port</p>
          <p className="mt-0.5 font-mono text-xs text-slate-300">{data.port}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-slate-600">User</p>
          <p className="mt-0.5 truncate font-mono text-xs text-slate-300">{data.username}</p>
        </div>
      </div>
    </div>
  );
}
