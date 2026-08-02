"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Rocket, Server as ServerIcon, Check, Egg as EggIcon, Layers, HardDrive, Cpu, MemoryStick, Database, Archive, Network } from "lucide-react";
import { get, post } from "@/lib/api";
import { Button, Input, Select, Toggle, Badge } from "@/components/ui";
import type { NestInfo, EggInfo } from "@/lib/types";
import { cn } from "@/lib/format";

interface WizardData {
  nests: NestInfo[];
  nodes: any[];
  locations: any[];
  shop: any[];
  slots: { used: number; max: number };
  connected: boolean;
  defaults: Record<string, string>;
}

const steps = ["Nest", "Egg", "Version", "Location", "Resources", "Variables", "Review"];

export function ServerCreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [wizard, setWizard] = useState<WizardData | null>(null);
  const [eggs, setEggs] = useState<any[]>([]);
  const [eggDetail, setEggDetail] = useState<EggInfo | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    nestId: "",
    eggId: "",
    dockerImage: "",
    locationId: "",
    nodeId: "",
    ram: 1024,
    cpu: 100,
    disk: 10240,
    databases: 1,
    backups: 1,
    allocations: 1,
    startup: "",
    environment: {} as Record<string, string>,
  });

  useEffect(() => {
    get<WizardData>("/servers/wizard-data")
      .then((d) => {
        setWizard(d);
        if (d.defaults.nest) setForm((f) => ({ ...f, nestId: String(d.defaults.nest) }));
        if (d.defaults.location) setForm((f) => ({ ...f, locationId: String(d.defaults.location) }));
        if (d.defaults.node) setForm((f) => ({ ...f, nodeId: String(d.defaults.node) }));
      })
      .catch((e) => toast.error(e.message));
  }, []);

  // Load eggs when nest changes
  useEffect(() => {
    if (!form.nestId) return;
    setEggDetail(null);
    setForm((f) => ({ ...f, eggId: "" }));
    get<any[]>(`/servers/eggs/${form.nestId}`)
      .then(setEggs)
      .catch((e) => toast.error(e.message));
  }, [form.nestId]);

  // Load egg detail when egg changes
  useEffect(() => {
    if (!form.nestId || !form.eggId) return;
    get<EggInfo>(`/servers/eggs/${form.nestId}/${form.eggId}`)
      .then((detail) => {
        setEggDetail(detail);
        setForm((f) => ({
          ...f,
          dockerImage: f.dockerImage || detail.docker_images[0] || "",
          startup: detail.startup,
          environment: Object.fromEntries(
            detail.variables.filter((v) => v.user_editable).map((v) => [v.env_variable, v.default_value])
          ),
        }));
      })
      .catch((e) => toast.error(e.message));
  }, [form.eggId]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const canNext = () => {
    if (step === 0) return !!form.nestId;
    if (step === 1) return !!form.eggId;
    if (step === 2) return !!form.dockerImage;
    if (step === 3) return !!form.locationId;
    if (step === 4) return form.name.trim().length >= 1 && form.ram >= 64 && form.disk >= 256;
    if (step === 5) return true;
    return true;
  };

  const create = async () => {
    setCreating(true);
    try {
      const server = await post<{ id: string; uuid: string }>("/servers", {
        name: form.name.trim(),
        nestId: form.nestId,
        eggId: form.eggId,
        dockerImage: form.dockerImage,
        locationId: form.locationId,
        nodeId: form.nodeId || undefined,
        limits: { ram: form.ram, swap: 0, disk: form.disk, io: 500, cpu: form.cpu },
        featureLimits: { databases: form.databases, allocations: form.allocations, backups: form.backups },
        startup: form.startup,
        environment: form.environment,
      });
      toast.success(`${form.name} is being deployed!`);
      router.push(`/servers/${server.uuid}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (!wizard) {
    return <div className="glass space-y-3 p-6">{[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.05]" />)}</div>;
  }

  const maxRam = 65536;

  return (
    <div className="glass overflow-hidden">
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] p-3 scrollbar-thin">
        {steps.map((label, i) => (
          <button key={label} onClick={() => i < step && setStep(i)} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold", i < step ? "bg-emerald-500 text-white" : i === step ? "bg-gradient-to-r from-violet-500 to-blue-500 text-white" : "bg-white/[0.08] text-slate-500")}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cn("font-medium", i === step ? "text-slate-200" : "text-slate-500")}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-white/10" />}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            {step === 0 && (
              <StepWrap title="Choose a nest" desc="Nests group server types together — select the software family you want to deploy.">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {wizard.nests.map((n) => (
                    <OptionCard key={n.id} selected={form.nestId === n.id} onClick={() => set("nestId", n.id)} icon={<Layers className="h-5 w-5" />} title={n.name} desc={n.description} />
                  ))}
                </div>
              </StepWrap>
            )}

            {step === 1 && (
              <StepWrap title="Choose an egg" desc="The egg defines how your server runs. Every egg from your panel is available automatically.">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {eggs.map((e) => (
                    <OptionCard key={e.id} selected={form.eggId === String(e.id)} onClick={() => set("eggId", String(e.id))} icon={<EggIcon className="h-5 w-5" />} title={e.name} desc={e.description} badge={`${e.docker_images?.length || 0} images`} />
                  ))}
                </div>
              </StepWrap>
            )}

            {step === 2 && (
              <StepWrap title="Select version" desc="Choose the Docker image / version your server will run on.">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(eggDetail?.docker_images || eggs.find((e) => String(e.id) === form.eggId)?.docker_images || []).map((img: string) => (
                    <button key={img} onClick={() => set("dockerImage", img)} className={cn("rounded-xl border p-4 text-left transition", form.dockerImage === img ? "border-violet-400/60 bg-violet-500/10" : "border-white/[0.08] bg-white/[0.02] hover:border-violet-400/30")}>
                      <p className="break-all font-mono text-xs text-slate-300">{img.split("/").pop()}</p>
                      <p className="mt-1 text-[10px] text-slate-600">{img}</p>
                    </button>
                  ))}
                </div>
              </StepWrap>
            )}

            {step === 3 && (
              <StepWrap title="Choose a location" desc="Where should your server be hosted?">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {wizard.locations.map((l) => (
                    <OptionCard key={l.id} selected={form.locationId === String(l.id)} onClick={() => set("locationId", String(l.id))} icon={<ServerIcon className="h-5 w-5" />} title={l.long || l.short} desc={`Location ${l.id}`} />
                  ))}
                </div>
              </StepWrap>
            )}

            {step === 4 && (
              <StepWrap title="Configure resources" desc={`You can deploy up to ${wizard.slots.max} servers (${wizard.slots.used} used).`}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Server name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="My Awesome Server" />
                  <Select label="Node" value={form.nodeId} onChange={(e) => set("nodeId", e.target.value)}>
                    <option value="">Auto (default node)</option>
                    {wizard.nodes.map((n) => <option key={n.id} value={String(n.id)}>{n.name}</option>)}
                  </Select>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <SliderField label="RAM" icon={<MemoryStick className="h-4 w-4" />} value={form.ram} min={64} max={Math.min(maxRam, 65536)} step={256} suffix=" MB" onChange={(v) => set("ram", v)} />
                  <SliderField label="CPU" icon={<Cpu className="h-4 w-4" />} value={form.cpu} min={10} max={400} step={10} suffix="%" onChange={(v) => set("cpu", v)} />
                  <SliderField label="Disk" icon={<HardDrive className="h-4 w-4" />} value={form.disk} min={256} max={65536} step={512} suffix=" MB" onChange={(v) => set("disk", v)} />
                  <SliderField label="Databases" icon={<Database className="h-4 w-4" />} value={form.databases} min={0} max={10} step={1} onChange={(v) => set("databases", v)} />
                  <SliderField label="Backups" icon={<Archive className="h-4 w-4" />} value={form.backups} min={0} max={10} step={1} onChange={(v) => set("backups", v)} />
                  <SliderField label="Allocations" icon={<Network className="h-4 w-4" />} value={form.allocations} min={1} max={5} step={1} onChange={(v) => set("allocations", v)} />
                </div>
              </StepWrap>
            )}

            {step === 5 && (
              <StepWrap title="Startup variables" desc="Configure the startup environment for this egg.">
                {eggDetail?.variables?.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {eggDetail.variables.filter((v) => v.user_editable).map((v) => (
                      <Input
                        key={v.env_variable}
                        label={`${v.name} (${v.env_variable})`}
                        value={form.environment[v.env_variable] ?? ""}
                        onChange={(e) => set("environment", { ...form.environment, [v.env_variable]: e.target.value })}
                        hint={v.description}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">This egg has no configurable startup variables.</p>
                )}
              </StepWrap>
            )}

            {step === 6 && (
              <StepWrap title="Review & deploy" desc="Double-check everything before deploying.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewRow label="Name" value={form.name} />
                  <ReviewRow label="Nest" value={wizard.nests.find((n) => n.id === form.nestId)?.name || "—"} />
                  <ReviewRow label="Egg" value={eggDetail?.name || "—"} />
                  <ReviewRow label="Image" value={form.dockerImage.split("/").pop() || "—"} mono />
                  <ReviewRow label="Location" value={wizard.locations.find((l) => String(l.id) === form.locationId)?.long || "—"} />
                  <ReviewRow label="Node" value={wizard.nodes.find((n) => String(n.id) === form.nodeId)?.name || "Default"} />
                  <ReviewRow label="RAM" value={`${form.ram} MB`} />
                  <ReviewRow label="CPU" value={`${form.cpu}%`} />
                  <ReviewRow label="Disk" value={`${form.disk} MB`} />
                  <ReviewRow label="Databases / Backups / Allocations" value={`${form.databases} / ${form.backups} / ${form.allocations}`} />
                </div>
                {form.startup && (
                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#04050c] p-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Startup command</p>
                    <code className="font-mono text-xs text-violet-300">{form.startup}</code>
                  </div>
                )}
                <Button size="lg" className="mt-6 w-full" loading={creating} onClick={create} icon={<Rocket className="h-4 w-4" />}>
                  Deploy {form.name || "server"}
                </Button>
              </StepWrap>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)} icon={<ChevronLeft className="h-4 w-4" />}>Back</Button>
          <div className="text-xs text-slate-600">Step {step + 1} of {steps.length}</div>
          {step < steps.length - 1 ? (
            <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>Continue<ChevronRight className="h-4 w-4" /></Button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}

function StepWrap({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-slate-100">{title}</h2>
      <p className="mb-5 mt-1 text-sm text-slate-500">{desc}</p>
      {children}
    </div>
  );
}

function OptionCard({ selected, onClick, icon, title, desc, badge }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc?: string; badge?: string }) {
  return (
    <button onClick={onClick} className={cn("group relative rounded-xl border p-4 text-left transition-all", selected ? "border-violet-400/60 bg-violet-500/10 shadow-glow" : "border-white/[0.08] bg-white/[0.02] hover:border-violet-400/30 hover:bg-white/[0.04]")}>
      {selected && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-blue-500"><Check className="h-3 w-3 text-white" /></span>}
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition", selected ? "bg-violet-500/25 text-violet-200" : "bg-white/[0.06] text-slate-400 group-hover:text-violet-300")}>{icon}</div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {desc && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{desc}</p>}
      {badge && <span className="mt-2 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">{badge}</span>}
    </button>
  );
}

function SliderField({ label, icon, value, min, max, step, suffix, onChange }: { label: string; icon: React.ReactNode; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-300">{icon}{label}</span>
        <span className="font-mono text-sm font-bold text-violet-300">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-violet-500" />
      <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>{min}</span><span>{max}{suffix}</span></div>
    </div>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn("text-sm font-semibold text-slate-200", mono && "font-mono")}>{value}</span>
    </div>
  );
}
