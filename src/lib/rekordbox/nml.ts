import type { Library, PlaylistNode, Track } from "./types";
import { toTraktorLocation, traktorPrimaryKey } from "./path";
import { toTraktorKeyValue } from "./keys";

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // strip control chars invalid in XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function attrs(obj: Record<string, string | number | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
    .join(" ");
}

const ms = (n: number) => n.toFixed(6);

/** Traktor CUE_V2 types */
export const CUE_TYPE = { CUE: 0, FADE_IN: 1, FADE_OUT: 2, LOAD: 3, GRID: 4, LOOP: 5 } as const;

export function cueElements(track: Track): string[] {
  const out: string[] = [];
  const grid = track.beatgrid[0];
  if (grid) {
    out.push(
      `<CUE_V2 ${attrs({ NAME: "AutoGrid", DISPL_ORDER: 0, TYPE: CUE_TYPE.GRID, START: ms(grid.startMs), LEN: ms(0), REPEATS: -1, HOTCUE: -1 })}></CUE_V2>`,
    );
  }
  for (const c of track.cues) {
    const isLoop = c.loopMs > 0;
    // Traktor has 8 hotcue slots (0-7); extra rekordbox hot cues become memory cues.
    const hot = c.kind === "hot" && c.slot >= 0 && c.slot < 8 ? c.slot : -1;
    const name = c.name || (hot >= 0 ? `Hot Cue ${String.fromCharCode(65 + hot)}` : "n.n.");
    out.push(
      `<CUE_V2 ${attrs({ NAME: name, DISPL_ORDER: 0, TYPE: isLoop ? CUE_TYPE.LOOP : CUE_TYPE.CUE, START: ms(c.startMs), LEN: ms(isLoop ? c.loopMs : 0), REPEATS: -1, HOTCUE: hot })}></CUE_V2>`,
    );
  }
  return out;
}

export function entryElement(track: Track, drive: string): string {
  const loc = toTraktorLocation(drive, track.filePath);
  const keyVal = toTraktorKeyValue(track.key);
  const parts = [
    `<ENTRY ${attrs({ TITLE: track.title, ARTIST: track.artist })}>`,
    `<LOCATION ${attrs({ DIR: loc.DIR, FILE: loc.FILE, VOLUME: loc.VOLUME, VOLUMEID: loc.VOLUMEID })}></LOCATION>`,
  ];
  if (track.album) parts.push(`<ALBUM ${attrs({ TITLE: track.album })}></ALBUM>`);
  parts.push(
    `<INFO ${attrs({
      BITRATE: track.bitrate ? track.bitrate * 1000 : undefined,
      GENRE: track.genre,
      KEY: track.key,
      PLAYTIME: track.durationSec ? Math.round(track.durationSec) : undefined,
      PLAYTIME_FLOAT: track.durationSec ? track.durationSec.toFixed(6) : undefined,
    })}></INFO>`,
  );
  const bpm = track.beatgrid[0]?.bpm || track.bpm;
  if (bpm > 0) parts.push(`<TEMPO ${attrs({ BPM: bpm.toFixed(6), BPM_QUALITY: "100.000000" })}></TEMPO>`);
  if (keyVal !== null) parts.push(`<MUSICAL_KEY ${attrs({ VALUE: keyVal })}></MUSICAL_KEY>`);
  parts.push(...cueElements(track));
  parts.push(`</ENTRY>`);
  return parts.join("\n");
}

/** Collect every track id referenced by a node (recursively). */
export function collectTrackIds(node: PlaylistNode, acc = new Set<number>()): Set<number> {
  node.trackIds.forEach((id) => acc.add(id));
  node.children.forEach((c) => collectTrackIds(c, acc));
  return acc;
}

let uuidCounter = 0;
function uuid(seed: number): string {
  uuidCounter++;
  // Fixed-width fields prevent different ID/counter pairs from sharing an identity.
  return seed.toString(16).padStart(8, "0") + uuidCounter.toString(16).padStart(24, "0");
}

function nodeElement(node: PlaylistNode, lib: Library, drive: string): string {
  if (node.isFolder) {
    const kids = node.children.map((c) => nodeElement(c, lib, drive));
    return `<NODE ${attrs({ TYPE: "FOLDER", NAME: node.name })}>\n<SUBNODES COUNT="${kids.length}">\n${kids.join("\n")}\n</SUBNODES>\n</NODE>`;
  }
  const keys = node.trackIds
    .map((id) => lib.tracks.get(id))
    .filter((t): t is Track => !!t && !!t.filePath)
    .map((t) => traktorPrimaryKey(toTraktorLocation(drive, t.filePath)));
  const entries = keys.map((k) => `<ENTRY>\n<PRIMARYKEY ${attrs({ TYPE: "TRACK", KEY: k })}></PRIMARYKEY>\n</ENTRY>`);
  return `<NODE ${attrs({ TYPE: "PLAYLIST", NAME: node.name })}>\n<PLAYLIST ${attrs({ ENTRIES: entries.length, TYPE: "LIST", UUID: uuid(node.id) })}>\n${entries.join("\n")}\n</PLAYLIST>\n</NODE>`;
}

export interface NmlOptions {
  drive: string;
  /** Nodes to export. Defaults to the whole tree. */
  nodes?: PlaylistNode[];
  /** Folder name wrapping exported playlists in Traktor */
  folderName?: string;
}

export function buildNml(lib: Library, opts: NmlOptions): string {
  const nodes = opts.nodes ?? lib.root.children;
  const ids = new Set<number>();
  nodes.forEach((n) => collectTrackIds(n, ids));
  const tracks = [...ids].map((id) => lib.tracks.get(id)).filter((t): t is Track => !!t && !!t.filePath);
  const collection = tracks.map((t) => entryElement(t, opts.drive));
  const wrapper: PlaylistNode = {
    id: 0,
    name: opts.folderName ?? "Rekordbox USB",
    isFolder: true,
    children: nodes,
    trackIds: [],
  };
  const inner = nodeElement(wrapper, lib, opts.drive);
  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>`,
    `<NML VERSION="19"><HEAD COMPANY="www.native-instruments.com" PROGRAM="Traktor Pro 4"></HEAD>`,
    `<MUSICFOLDERS></MUSICFOLDERS>`,
    `<COLLECTION ENTRIES="${collection.length}">`,
    ...collection,
    `</COLLECTION>`,
    `<SETS ENTRIES="0"></SETS>`,
    `<PLAYLISTS>`,
    `<NODE TYPE="FOLDER" NAME="$ROOT">`,
    `<SUBNODES COUNT="1">`,
    inner,
    `</SUBNODES>`,
    `</NODE>`,
    `</PLAYLISTS>`,
    `</NML>`,
  ].join("\n");
}
