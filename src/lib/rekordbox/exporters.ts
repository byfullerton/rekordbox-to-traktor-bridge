import { zipSync, strToU8 } from "fflate";
import type { Library, PlaylistNode, Track } from "./types";
import { buildNml, escapeXml } from "./nml";
import { normalizeDrive, pathSegments } from "./path";

export type TargetId = "traktor" | "virtualdj" | "serato" | "engine" | "djay" | "mixxx" | "m3u8";

export interface ExportFile {
  /** Relative path inside the output (may contain folders). */
  path: string;
  data: string | Uint8Array;
}

export interface ExportOptions {
  drive: string;
  nodes: PlaylistNode[];
  folderName: string;
}

export const TARGETS: { id: TargetId; label: string; ext: string }[] = [
  { id: "traktor", label: "Traktor Pro 4", ext: ".nml" },
  { id: "virtualdj", label: "VirtualDJ", ext: ".vdjfolder" },
  { id: "serato", label: "Serato DJ", ext: ".crate" },
  { id: "engine", label: "Engine DJ", ext: ".m3u8" },
  { id: "djay", label: "Algoriddim djay", ext: ".m3u8" },
  { id: "mixxx", label: "Mixxx", ext: ".m3u8" },
  { id: "m3u8", label: "Universal M3U8", ext: ".m3u8" },
];

/** Absolute Windows path on the mounted stick, e.g. E:\Contents\a.mp3 */
export function windowsPath(drive: string, relPath: string): string {
  return `${normalizeDrive(drive)}\\${pathSegments(relPath).join("\\")}`;
}

/** Strip characters Windows forbids in file names. */
export function safeName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || "Playlist";
}

/** Flatten selection into leaf playlists, keeping folder names as a path prefix. Each stays distinct. */
export function flattenPlaylists(nodes: PlaylistNode[], prefix: string[] = []): { names: string[]; node: PlaylistNode }[] {
  const out: { names: string[]; node: PlaylistNode }[] = [];
  for (const n of nodes) {
    if (n.isFolder) out.push(...flattenPlaylists(n.children, [...prefix, n.name]));
    else out.push({ names: [...prefix, n.name], node: n });
  }
  return out;
}

function tracksOf(lib: Library, node: PlaylistNode): Track[] {
  return node.trackIds.map((id) => lib.tracks.get(id)).filter((t): t is Track => !!t && !!t.filePath);
}

/** Give every playlist a unique file name so two same-named playlists never overwrite each other. */
function uniqueNames(items: { names: string[] }[], sep: string): string[] {
  const seen = new Map<string, number>();
  return items.map(({ names }) => {
    const base = names.map(safeName).join(sep);
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1;
    seen.set(base.toLowerCase(), n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

export function buildM3u8(tracks: Track[], drive: string, title?: string): string {
  const lines = ["#EXTM3U"];
  if (title) lines.push(`#PLAYLIST:${title}`);
  for (const t of tracks) {
    const dur = t.durationSec ? Math.round(t.durationSec) : -1;
    const who = t.artist ? `${t.artist} - ${t.title}` : t.title;
    lines.push(`#EXTINF:${dur},${who}`, windowsPath(drive, t.filePath));
  }
  return lines.join("\r\n") + "\r\n";
}

export function buildVdjFolder(tracks: Track[], drive: string): string {
  const songs = tracks.map((t, i) => {
    const a = [
      `path="${escapeXml(windowsPath(drive, t.filePath))}"`,
      t.durationSec ? `songlength="${t.durationSec.toFixed(1)}"` : "",
      `artist="${escapeXml(t.artist)}"`,
      `title="${escapeXml(t.title)}"`,
      `idx="${i}"`,
    ].filter(Boolean);
    return ` <song ${a.join(" ")} />`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\r\n<VirtualFolder noDuplicates="no">\r\n${songs.join("\r\n")}\r\n</VirtualFolder>\r\n`;
}

function utf16be(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = c >> 8;
    out[i * 2 + 1] = c & 0xff;
  }
  return out;
}

function tag(name: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length);
  for (let i = 0; i < 4; i++) out[i] = name.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, body.length);
  out.set(body, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Serato crate: "vrsn" header then one "otrk"/"ptrk" per track; paths are relative to the drive root. */
export function buildSeratoCrate(tracks: Track[]): Uint8Array {
  const parts = [tag("vrsn", utf16be("1.0/Serato ScratchLive Crate"))];
  for (const t of tracks) parts.push(tag("otrk", tag("ptrk", utf16be(pathSegments(t.filePath).join("/")))));
  return concat(parts);
}

export function buildTarget(lib: Library, target: TargetId, opts: ExportOptions): ExportFile[] {
  const drive = normalizeDrive(opts.drive);
  if (target === "traktor") {
    return [{ path: `rekordbox-usb-${drive[0]}.nml`, data: buildNml(lib, { drive, nodes: opts.nodes, folderName: opts.folderName }) }];
  }
  const items = flattenPlaylists(opts.nodes);
  // Serato encodes folder nesting with "%%" in crate file names.
  const names = uniqueNames(items, target === "serato" ? "%%" : " - ");
  return items.map(({ node }, i) => {
    const tracks = tracksOf(lib, node);
    const name = names[i]!;
    switch (target) {
      case "virtualdj":
        return { path: `${name}.vdjfolder`, data: buildVdjFolder(tracks, drive) };
      case "serato":
        return { path: `Subcrates/${name}.crate`, data: buildSeratoCrate(tracks) };
      default:
        return { path: `${name}.m3u8`, data: buildM3u8(tracks, drive, node.name) };
    }
  });
}

/** Zip one or more targets; each target gets its own folder and every playlist its own file. */
export function buildZip(lib: Library, targets: TargetId[], opts: ExportOptions): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const id of targets) {
    const label = TARGETS.find((t) => t.id === id)!.label;
    for (const f of buildTarget(lib, id, opts)) {
      entries[`${label}/${f.path}`] = typeof f.data === "string" ? strToU8(f.data) : f.data;
    }
  }
  return zipSync(entries);
}
