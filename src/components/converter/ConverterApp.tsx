import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Disc3, Download, Folder, FolderOpen, HardDrive, ListMusic, Usb } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { UpdateButton, type UpdaterBridge } from "./UpdateButton";

export const WINDOWS_DOWNLOAD_URL =
  "https://github.com/byfullerton/rekordbox-to-traktor-bridge/releases/latest/download/USB-DJ-Bridge-Setup.exe";
import type { FileSource, Library, PlaylistNode, Track } from "@/lib/rekordbox/types";
import { dirHandleSource, fileListSource, loadUsbLibrary } from "@/lib/rekordbox/loader";
import { parseRekordboxXml } from "@/lib/rekordbox/xml";
import { collectTrackIds } from "@/lib/rekordbox/nml";
import { TARGETS, buildTarget, type ExportFile, type TargetId } from "@/lib/rekordbox/exporters";
import { saveFilesToDirectory } from "@/lib/rekordbox/save-files";
import { normalizeDrive, toTraktorLocation } from "@/lib/rekordbox/path";

interface UsbBridge {
  pickFolder(): Promise<string | null>;
  readFile(absPath: string): Promise<Uint8Array | null>;
  saveFile(name: string, contents: string | Uint8Array): Promise<boolean>;
  saveFiles?(files: ExportFile[]): Promise<boolean>;
  checkForUpdates?: UpdaterBridge["checkForUpdates"];
  installUpdate?: UpdaterBridge["installUpdate"];
}
declare global {
  interface Window {
    usbBridge?: UsbBridge;
  }
}

const fmtTime = (ms: number) => {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
};

export function ConverterApp() {
  const [lib, setLib] = useState<Library | null>(null);
  const [drive, setDrive] = useState("E:");
  const [label, setLabel] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [active, setActive] = useState<PlaylistNode | null>(null);
  const [target, setTarget] = useState<TargetId | "all">("traktor");
  const [track, setTrack] = useState<Track | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showSmartScreenHint, setShowSmartScreenHint] = useState(false);
  useEffect(() => setIsDesktop(!!window.usbBridge), []);
  const dirInput = useRef<HTMLInputElement>(null);
  const xmlInput = useRef<HTMLInputElement>(null);

  async function load(src: FileSource, name: string) {
    setError(null);
    setProgress(0);
    try {
      const l = await loadUsbLibrary(src, (d, t) => setProgress(Math.round((d / t) * 100)));
      setLib(l);
      setLabel(name);
      setChecked(new Set());
      setActive(l.root.children.find((c) => !c.isFolder) ?? null);
      setTrack(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  async function pickDrive() {
    const bridge = window.usbBridge;
    if (bridge) {
      const root = await bridge.pickFolder();
      if (!root) return;
      const m = root.match(/^([a-zA-Z]):/);
      if (m?.[1]) setDrive(`${m[1].toUpperCase()}:`);
      const base = root.replace(/[\\/]+$/, "");
      return load({ read: (p) => bridge.readFile(base + p.replace(/\//g, "\\")) }, root);
    }
    const w = window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
    if (w.showDirectoryPicker && window.self === window.top) {
      try {
        const h = await w.showDirectoryPicker();
        return load(dirHandleSource(h), h.name);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    dirInput.current?.click();
  }

  async function onXml(f: File) {
    try {
      const l = parseRekordboxXml(await f.text());
      setLib(l);
      setLabel(f.name);
      setChecked(new Set());
      setActive(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const playlistTracks = useMemo(
    () => (active && lib ? active.trackIds.map((id) => lib.tracks.get(id)).filter((t): t is Track => !!t) : []),
    [active, lib],
  );

  function selectedNodes(): PlaylistNode[] {
    if (!lib) return [];
    const out: PlaylistNode[] = [];
    const walk = (n: PlaylistNode) => {
      if (checked.has(n.id)) out.push(n);
      else n.children.forEach(walk);
    };
    lib.root.children.forEach(walk);
    return out;
  }

  function download(name: string, data: string | Uint8Array, type: string) {
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportNml(all: boolean) {
    if (!lib || exporting) return;
    let d: string;
    try {
      d = normalizeDrive(drive);
    } catch (e) {
      return setError((e as Error).message);
    }
    const nodes = all ? lib.root.children : selectedNodes();
    if (!nodes.length) return setError("Tick at least one playlist, or export all.");
    const opts = { drive: d, nodes, folderName: `USB ${d} ${label}`.trim() };
    setError(null);
    setExportStatus("");
    setExporting(true);
    try {
      const files = target === "all"
        ? TARGETS.flatMap((t) => buildTarget(lib, t.id, opts).map((file) => ({ ...file, path: `${t.label}/${file.path}` })))
        : buildTarget(lib, target, opts);
      if (!files.length) return setError("No playlists in the selection.");
      const bridge = window.usbBridge;
      if (bridge) {
        if (files.length === 1 && files[0] && !files[0].path.includes("/")) {
          if (!await bridge.saveFile(files[0].path, files[0].data)) return;
        } else {
          if (!bridge.saveFiles) throw new Error("Update the desktop app to save multiple playlists directly.");
          if (!await bridge.saveFiles(files)) return;
        }
      } else {
        const picker = (window as Window & { showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
        if (picker && window.self === window.top && (files.length > 1 || files[0]?.path.includes("/"))) {
          await saveFilesToDirectory(await picker.call(window, { mode: "readwrite" }), files);
        } else {
          for (const file of files) download(file.path.split("/").pop() ?? file.path, file.data, "application/octet-stream");
          setExportStatus(files.length > 1 ? "Playlist downloads started. Allow multiple downloads if your browser asks." : "Playlist download started.");
          return;
        }
      }
      setExportStatus(`${files.length} playlist file${files.length === 1 ? "" : "s"} saved.`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(`Export stopped: ${(e as Error).message}. Any files already saved remain in the destination folder.`);
    } finally {
      setExporting(false);
    }
  }

  const toggle = (n: PlaylistNode) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(n.id)) next.delete(n.id);
      else next.add(n.id);
      return next;
    });

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex w-full flex-wrap items-center gap-3 md:flex-nowrap">
        <img src={logoAsset.url} alt="USB DJ Bridge logo" className="h-8 w-8 shrink-0 rounded" />
        <h1 className="shrink-0 font-display text-lg font-bold tracking-tight">
          USB <span className="text-primary">DJ Bridge</span>
        </h1>
          <span className="w-full text-xs text-muted-foreground md:w-auto md:min-w-0 md:flex-1">Rekordbox USB Playlists to any DJ software, no file copying</span>
          {!isDesktop && (
            <Button asChild size="sm" className="ml-auto h-auto min-h-8 max-w-full whitespace-normal md:h-8 md:shrink-0 md:whitespace-nowrap">
              <a
                href={WINDOWS_DOWNLOAD_URL}
                onClick={(e) => {
                  e.preventDefault();
                  setShowSmartScreenHint(true);
                }}
              >
                <Download className="h-4 w-4" /> Want to use this tool offline? Download for Windows here
              </a>
            </Button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isDesktop && window.usbBridge?.checkForUpdates && <UpdateButton bridge={window.usbBridge as UpdaterBridge} />}
          <Button onClick={pickDrive} size="sm">
            <Usb className="h-4 w-4" /> Open USB drive
          </Button>
          <span className="text-xs text-muted-foreground">or</span>
          <Button variant="secondary" size="sm" onClick={() => xmlInput.current?.click()}>
            Load rekordbox.xml
          </Button>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <HardDrive className="h-4 w-4" /> Drive
            <Input value={drive} onChange={(e) => setDrive(e.target.value)} className="h-8 w-14 font-mono" aria-label="Drive letter" />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            For
            <select
              aria-label="Target software"
              value={target}
              onChange={(e) => setTarget(e.target.value as TargetId | "all")}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              {TARGETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.ext})
                </option>
              ))}
              <option value="all">All software</option>
            </select>
          </label>
          <Button size="sm" variant={lib && checked.size > 0 ? "exportReady" : "outline"} disabled={!lib || !checked.size || exporting} onClick={() => exportNml(false)}>
            <Download className="h-4 w-4" /> Export selected ({checked.size})
          </Button>
          <Button size="sm" disabled={!lib || exporting} onClick={() => exportNml(true)}>
            <Download className="h-4 w-4" /> Export all
          </Button>
        </div>
        <input
          ref={dirInput}
          type="file"
          className="hidden"
          // @ts-expect-error non-standard attribute
          webkitdirectory=""
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) return;
            const { source, rootName } = fileListSource(files);
            load(source, rootName);
          }}
        />
        <input ref={xmlInput} type="file" accept=".xml" className="hidden" onChange={(e) => e.target.files?.[0] && onXml(e.target.files[0])} />
      </header>

      {error && <div className="border-b border-destructive bg-destructive/15 px-4 py-2 text-sm text-destructive">{error}</div>}
      {exportStatus && <div role="status" className="border-b border-border px-4 py-2 text-sm text-primary">{exportStatus}</div>}
      {progress !== null && (
        <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
          Reading analysis files… <Progress value={progress} className="h-1.5 w-64" />
        </div>
      )}

      {!lib ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <Usb className="h-16 w-16 text-primary" />
          <h2 className="font-display text-2xl font-bold">Plug in a Rekordbox USB</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Choose the stick's root folder (e.g. <span className="font-mono">E:\</span>). We read{" "}
            <span className="font-mono">PIONEER/rekordbox/export.pdb</span> and the analysis files, then build playlists
            for Traktor, VirtualDJ, Serato, Engine DJ, djay, Mixxx, or M3U8 that point at the audio on the stick.
          </p>
          <Button onClick={pickDrive}>
            <Usb className="h-4 w-4" /> Open USB drive
          </Button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr_340px]">
          <aside className="overflow-auto border-r border-border bg-card/50 p-2">
            <div className="px-2 pb-2 text-xs uppercase tracking-widest text-muted-foreground">
              {label || "USB"} · {lib.tracks.size} tracks
            </div>
            {lib.root.children.map((n) => (
              <TreeNode key={n.id} node={n} depth={0} checked={checked} onToggle={toggle} active={active} onOpen={setActive} />
            ))}
          </aside>

          <main className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Artist</th>
                  <th className="px-3 py-2">BPM</th>
                  <th className="px-3 py-2">Key</th>
                  <th className="px-3 py-2">Cues</th>
                </tr>
              </thead>
              <tbody>
                {playlistTracks.map((t, i) => (
                  <tr
                    key={`${t.id}-${i}`}
                    onClick={() => setTrack(t)}
                    className={`cursor-pointer border-b border-border/50 hover:bg-accent ${track?.id === t.id ? "bg-accent" : ""}`}
                  >
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5">{t.title}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{t.artist}</td>
                    <td className="px-3 py-1.5 font-mono text-primary">{t.bpm.toFixed(2)}</td>
                    <td className="px-3 py-1.5 font-mono">{t.key}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-0.5">
                        {t.cues.slice(0, 10).map((c, j) => (
                          <span
                            key={j}
                            className={`h-2.5 w-2.5 ${c.kind === "hot" ? "rounded-sm" : "rounded-full border border-muted-foreground"}`}
                            style={{ background: c.color ?? (c.kind === "hot" ? "var(--primary)" : "transparent") }}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!playlistTracks.length && (
              <p className="p-6 text-sm text-muted-foreground">
                <ListMusic className="mr-2 inline h-4 w-4" />
                Pick a playlist on the left.
              </p>
            )}
          </main>

          <aside className="hidden overflow-auto border-l border-border bg-card/50 p-4 lg:block">
            {track ? <TrackDetail track={track} drive={drive} /> : <p className="text-sm text-muted-foreground">Select a track to see its cues and file location.</p>}
          </aside>
        </div>
      )}

      {showSmartScreenHint && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Windows download note"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="font-display text-lg font-bold">One quick note before you install</h2>
            <p className="text-sm text-muted-foreground">
              The first time you run the installer, Windows may show a blue <strong className="text-foreground">"Windows protected your PC"</strong>{" "}
              message. That's normal for a new app, and it's safe to continue:
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>
                Click <strong className="text-foreground">"More info"</strong> under the message.
              </li>
              <li>
                Click <strong className="text-foreground">"Run anyway"</strong>.
              </li>
            </ol>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowSmartScreenHint(false)}>
                Cancel
              </Button>
              <Button asChild size="sm">
                <a href={WINDOWS_DOWNLOAD_URL} onClick={() => setShowSmartScreenHint(false)}>
                  <Download className="h-4 w-4" /> Download now
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode(props: {
  node: PlaylistNode;
  depth: number;
  checked: Set<number>;
  onToggle: (n: PlaylistNode) => void;
  active: PlaylistNode | null;
  onOpen: (n: PlaylistNode) => void;
}) {
  const { node, depth, checked, onToggle, active, onOpen } = props;
  const [open, setOpen] = useState(true);
  const count = node.isFolder ? collectTrackIds(node).size : node.trackIds.length;
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 rounded px-1 py-1 text-sm hover:bg-accent ${active?.id === node.id ? "bg-accent text-primary" : ""}`}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <Checkbox checked={checked.has(node.id)} onCheckedChange={() => onToggle(node)} aria-label={`Select ${node.name}`} />
        {node.isFolder ? (
          <button className="flex flex-1 items-center gap-1 text-left" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {open ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-primary" />}
            <span className="truncate">{node.name}</span>
          </button>
        ) : (
          <button className="flex flex-1 items-center gap-1 truncate text-left" onClick={() => onOpen(node)}>
            <ListMusic className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{node.name}</span>
          </button>
        )}
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      </div>
      {node.isFolder && open && node.children.map((c) => <TreeNode key={c.id} {...props} node={c} depth={depth + 1} />)}
    </div>
  );
}

function TrackDetail({ track, drive }: { track: Track; drive: string }) {
  let loc: ReturnType<typeof toTraktorLocation> | null = null;
  try {
    loc = toTraktorLocation(drive, track.filePath);
  } catch {
    loc = null;
  }
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-display text-lg font-bold leading-tight">{track.title}</h3>
        <p className="text-muted-foreground">{track.artist}</p>
        <p className="text-xs text-muted-foreground">{track.album}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
        <dt className="text-muted-foreground">BPM</dt><dd className="text-primary">{track.bpm.toFixed(2)}</dd>
        <dt className="text-muted-foreground">Key</dt><dd>{track.key || "—"}</dd>
        <dt className="text-muted-foreground">Genre</dt><dd>{track.genre || "—"}</dd>
        <dt className="text-muted-foreground">Comment</dt><dd className="break-words">{track.comment || "—"}</dd>
        <dt className="text-muted-foreground">Length</dt><dd>{fmtTime(track.durationSec * 1000)}</dd>
        <dt className="text-muted-foreground">Grid start</dt><dd>{track.beatgrid[0] ? fmtTime(track.beatgrid[0].startMs) : "—"}</dd>
      </dl>
      {loc && (
        <div className="rounded border border-border bg-background p-2 font-mono text-[11px] break-all">
          VOLUME="{loc.VOLUME}" DIR="{loc.DIR}" FILE="{loc.FILE}"
        </div>
      )}
      <div>
        <h4 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Cues ({track.cues.length})</h4>
        <ul className="space-y-1">
          {track.cues.map((c, i) => (
            <li key={i} className="flex items-center gap-2 font-mono text-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-background" style={{ background: c.color ?? "var(--muted-foreground)" }}>
                {c.kind === "hot" ? String.fromCharCode(65 + c.slot) : "M"}
              </span>
              <span>{fmtTime(c.startMs)}</span>
              {c.loopMs > 0 && <span className="text-primary">loop {(c.loopMs / 1000).toFixed(2)}s</span>}
              <span className="truncate text-muted-foreground">{c.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
