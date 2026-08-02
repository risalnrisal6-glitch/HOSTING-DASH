"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Folder, File as FileIcon, FileCode2, ChevronRight, ChevronLeft, Upload, Download, Trash2, Pencil, Copy, Archive, FileArchive, FolderPlus, RefreshCw, X, Save, FileText,
} from "lucide-react";
import { get, post, del, uploadFile } from "@/lib/api";
import { Button, Input, Modal, EmptyState, ConfirmDialog } from "@/components/ui";
import type { FileEntry } from "@/lib/types";
import { formatBytes, timeAgo, cn } from "@/lib/format";

export function FileManager({ uuid }: { uuid: string }) {
  const [directory, setDirectory] = useState("/");
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ name: string; path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ from: string; to: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (dir: string) => {
    setLoading(true);
    try {
      const data = await get<{ directory: string; files: FileEntry[] }>(`/servers/${uuid}/files?directory=${encodeURIComponent(dir)}`);
      setFiles(data.files);
      setDirectory(data.directory);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    load("/");
  }, [load]);

  const crumbs = (() => {
    const parts = directory.split("/").filter(Boolean);
    const out = [{ name: "root", path: "/" }];
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      out.push({ name: p, path: acc });
    }
    return out;
  })();

  const open = (f: FileEntry) => {
    if (!f.is_file) {
      load(directory === "/" ? "/" + f.name : directory + "/" + f.name);
    } else {
      const path = (directory === "/" ? "/" : directory + "/") + f.name;
      get<{ content: string }>(`/servers/${uuid}/files/content?file=${encodeURIComponent(path)}`)
        .then((d) => setEditing({ name: f.name, path, content: d.content }))
        .catch((e) => toast.error(e.message));
    }
  };

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("directory", directory);
      await uploadFile(`/servers/${uuid}/files/upload`, form);
      toast.success(`${file.name} uploaded`);
      load(directory);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const download = async (name: string) => {
    const path = (directory === "/" ? "/" : directory + "/") + name;
    window.location.href = `/api/servers/${uuid}/files/download?file=${encodeURIComponent(path)}`;
  };

  const doDelete = async () => {
    const list = Array.from(selected);
    try {
      await post(`/servers/${uuid}/files/delete`, { root: directory, files: list });
      toast.success(`Deleted ${list.length} item${list.length > 1 ? "s" : ""}`);
      setConfirmDelete(false);
      load(directory);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const createFolder = async () => {
    if (!newFolder.trim()) return;
    try {
      await post(`/servers/${uuid}/files/mkdir`, { root: directory, name: newFolder.trim() });
      setNewFolder("");
      setShowNewFolder(false);
      load(directory);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const saveFile = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await post(`/servers/${uuid}/files/write`, { file: editing.path, content: editing.content });
      toast.success("File saved");
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const compressSelected = async () => {
    if (selected.size === 0) return;
    try {
      await post(`/servers/${uuid}/files/compress`, { root: directory, files: Array.from(selected) });
      toast.success("Archive created");
      load(directory);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const extract = async (name: string) => {
    try {
      await post(`/servers/${uuid}/files/decompress`, { root: directory, file: name });
      toast.success("Archive extracted");
      load(directory);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const copy = async (name: string) => {
    try {
      await post(`/servers/${uuid}/files/copy`, { location: directory, name });
      toast.success(`Copied ${name}`);
      load(directory);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doRename = async () => {
    if (!renameTarget) return;
    try {
      await post(`/servers/${uuid}/files/rename`, { root: directory, files: [{ from: renameTarget.from, to: renameTarget.to }] });
      toast.success("Renamed");
      setRenameTarget(null);
      load(directory);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass flex flex-wrap items-center gap-2 p-3">
        <button onClick={() => load("/")} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.08]" title="Root"><FolderPlus className="hidden" /><FileIcon className="h-4 w-4" /></button>
        <button onClick={() => load("/")} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.08]"><ChevronLeft className="h-4 w-4" /></button>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-thin">
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
              <button onClick={() => load(c.path)} className={cn("rounded px-1.5 py-0.5 font-mono", c.path === directory ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:text-slate-200")}>{c.name}</button>
            </span>
          ))}
        </div>
        <button onClick={() => load(directory)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.08]" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
        <label className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.12]">
          <Upload className="mr-1.5 inline h-3.5 w-3.5" />{uploading ? "Uploading..." : "Upload"}
          <input type="file" className="hidden" onChange={upload} disabled={uploading} />
        </label>
        <Button variant="secondary" size="sm" onClick={() => setShowNewFolder(true)} icon={<FolderPlus className="h-3.5 w-3.5" />}>Folder</Button>
        <Button variant="secondary" size="sm" disabled={selected.size === 0} onClick={compressSelected} icon={<Archive className="h-3.5 w-3.5" />}>Archive ({selected.size})</Button>
        <Button variant="danger" size="sm" disabled={selected.size === 0} onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
      </div>

      {/* New folder */}
      {showNewFolder && (
        <div className="glass flex items-center gap-2 p-3">
          <Input placeholder="Folder name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()} autoFocus className="max-w-xs" />
          <Button size="sm" onClick={createFolder}>Create</Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowNewFolder(false); setNewFolder(""); }}><X className="h-4 w-4" /></Button>
        </div>
      )}

      {/* File list */}
      <div className="glass overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-white/[0.06] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          <span className="w-5" /><span>Name</span><span>Size</span><span>Modified</span><span className="w-24 text-right">Actions</span>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">{[...Array(8)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />)}</div>
        ) : files && files.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="This folder is empty" description="Upload files or create a folder to get started." />
        ) : (
          <div className="max-h-[480px] overflow-y-auto scrollbar-thin">
            {files?.map((f) => {
              const isZip = f.name.endsWith(".zip") || f.name.endsWith(".tar.gz");
              return (
                <div key={f.name} className={cn("group grid cursor-pointer grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-white/[0.03] px-4 py-2.5 transition hover:bg-white/[0.04]", selected.has(f.name) && "bg-violet-500/[0.08]")}>
                  <input type="checkbox" checked={selected.has(f.name)} onChange={() => toggleSelect(f.name)} className="h-3.5 w-3.5 accent-violet-500" />
                  <button onClick={() => open(f)} className="flex min-w-0 items-center gap-2.5 text-left">
                    {f.is_file ? (isZip ? <FileArchive className="h-4.5 w-4.5 shrink-0 text-amber-400" /> : <FileCode2 className="h-4.5 w-4.5 shrink-0 text-blue-400" />) : <Folder className="h-4.5 w-4.5 shrink-0 fill-violet-500/20 text-violet-400" />}
                    <span className="truncate font-mono text-xs text-slate-300 group-hover:text-white">{f.name}</span>
                  </button>
                  <span className="text-right font-mono text-xs text-slate-500">{f.is_file ? formatBytes(f.size) : "—"}</span>
                  <span className="text-xs text-slate-500">{timeAgo(f.modified_at)}</span>
                  <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    {f.is_file && <IconBtn title="Download" onClick={() => download(f.name)}><Download className="h-3.5 w-3.5" /></IconBtn>}
                    {f.is_file && <IconBtn title="Edit" onClick={() => open(f)}><Pencil className="h-3.5 w-3.5" /></IconBtn>}
                    {isZip && <IconBtn title="Extract" onClick={() => extract(f.name)}><FileArchive className="h-3.5 w-3.5" /></IconBtn>}
                    <IconBtn title="Duplicate" onClick={() => copy(f.name)}><Copy className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Rename" onClick={() => setRenameTarget({ from: f.name, to: f.name })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Delete" danger onClick={() => { setSelected(new Set([f.name])); setConfirmDelete(true); }}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit file modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={<span className="flex items-center gap-2"><FileCode2 className="h-4 w-4 text-violet-400" />{editing?.name}</span>} wide>
        <textarea
          value={editing?.content || ""}
          onChange={(e) => setEditing((ed) => (ed ? { ...ed, content: e.target.value } : ed))}
          className="input-base h-96 min-h-0 font-mono text-xs"
          spellCheck={false}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={saveFile} loading={saving} icon={<Save className="h-4 w-4" />}>Save file</Button>
        </div>
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename">
        <Input label="New name" value={renameTarget?.to || ""} onChange={(e) => setRenameTarget((r) => (r ? { ...r, to: e.target.value } : r))} autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button onClick={doRename}>Rename</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        danger
        title="Delete files?"
        description={`This will permanently delete ${selected.size} item(s). This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={cn("rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.1]", danger ? "hover:text-rose-400" : "hover:text-slate-200")}>
      {children}
    </button>
  );
}
