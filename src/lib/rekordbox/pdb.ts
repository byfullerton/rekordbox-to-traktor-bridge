/**
 * Minimal DeviceSQL (export.pdb) reader, following the Deep Symmetry format analysis
 * (https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/exports.html).
 */
import type { Library, PlaylistNode, Track } from "./types";

export const TABLE = {
  TRACKS: 0, GENRES: 1, ARTISTS: 2, ALBUMS: 3, LABELS: 4, KEYS: 5, COLORS: 6,
  PLAYLIST_TREE: 7, PLAYLIST_ENTRIES: 8,
} as const;

const HEAP = 0x28;

export function readDeviceSqlString(v: DataView, off: number): string {
  const k = v.getUint8(off);
  if (k & 1) {
    const len = (k >> 1) - 1;
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(v.getUint8(off + 1 + i));
    return s;
  }
  const len = v.getUint16(off + 1, true) - 4;
  if (k === 0x40) {
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(v.getUint8(off + 4 + i));
    return s;
  }
  if (k === 0x90) {
    let s = "";
    for (let i = 0; i + 1 < len; i += 2) s += String.fromCharCode(v.getUint16(off + 4 + i, true));
    return s.replace(/\0+$/, "");
  }
  return "";
}

/** Yield the absolute byte offset of every present row in a table. */
export function* tableRows(v: DataView, tableType: number): Generator<number> {
  const pageLen = v.getUint32(4, true);
  const numTables = v.getUint32(8, true);
  for (let t = 0; t < numTables; t++) {
    const p = 0x1c + t * 16;
    if (v.getUint32(p, true) !== tableType) continue;
    let page = v.getUint32(p + 8, true);
    const last = v.getUint32(p + 12, true);
    const seen = new Set<number>();
    while (!seen.has(page) && (page + 1) * pageLen <= v.byteLength) {
      seen.add(page);
      const base = page * pageLen;
      const type = v.getUint32(base + 8, true);
      const flags = v.getUint8(base + 27);
      if (type === tableType && (flags & 0x40) === 0) {
        const small = v.getUint8(base + 24);
        const large = v.getUint16(base + 34, true);
        const numRows = large > small && large !== 0x1fff ? large : small;
        const groups = Math.ceil(numRows / 16);
        for (let g = 0; g < groups; g++) {
          const gEnd = base + pageLen - g * 0x24;
          const present = v.getUint16(gEnd - 4, true);
          const count = Math.min(16, numRows - g * 16);
          for (let r = 0; r < count; r++) {
            if ((present >> r) & 1) yield base + HEAP + v.getUint16(gEnd - 6 - 2 * r, true);
          }
        }
      }
      if (page === last) break;
      page = v.getUint32(base + 12, true);
    }
  }
}

export function parsePdb(buf: Uint8Array): Library {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const s = (off: number) => readDeviceSqlString(v, off);

  const artists = new Map<number, string>();
  for (const r of tableRows(v, TABLE.ARTISTS)) {
    const sub = v.getUint16(r, true);
    const ofs = sub === 0x64 ? v.getUint16(r + 10, true) : v.getUint8(r + 9);
    artists.set(v.getUint32(r + 4, true), s(r + ofs));
  }
  const albums = new Map<number, string>();
  for (const r of tableRows(v, TABLE.ALBUMS)) {
    const sub = v.getUint16(r, true);
    const ofs = sub === 0x84 ? v.getUint16(r + 22, true) : v.getUint8(r + 21);
    albums.set(v.getUint32(r + 12, true), s(r + ofs));
  }
  const genres = new Map<number, string>();
  for (const r of tableRows(v, TABLE.GENRES)) genres.set(v.getUint32(r, true), s(r + 4));
  const keys = new Map<number, string>();
  for (const r of tableRows(v, TABLE.KEYS)) keys.set(v.getUint32(r, true), s(r + 8));

  const tracks = new Map<number, Track>();
  for (const r of tableRows(v, TABLE.TRACKS)) {
    const str = (i: number) => s(r + v.getUint16(r + 94 + i * 2, true));
    const id = v.getUint32(r + 72, true);
    tracks.set(id, {
      id,
      title: str(17),
      artist: artists.get(v.getUint32(r + 68, true)) ?? "",
      album: albums.get(v.getUint32(r + 64, true)) ?? "",
      genre: genres.get(v.getUint32(r + 60, true)) ?? "",
      bpm: v.getUint32(r + 56, true) / 100,
      key: keys.get(v.getUint32(r + 32, true)) ?? "",
      durationSec: v.getUint16(r + 84, true),
      bitrate: v.getUint32(r + 48, true),
      filePath: str(20),
      analyzePath: str(14),
      beatgrid: [],
      cues: [],
    });
  }

  type Raw = { node: PlaylistNode; parent: number; sort: number };
  const raw = new Map<number, Raw>();
  for (const r of tableRows(v, TABLE.PLAYLIST_TREE)) {
    const id = v.getUint32(r + 12, true);
    raw.set(id, {
      parent: v.getUint32(r, true),
      sort: v.getUint32(r + 8, true),
      node: { id, name: s(r + 20), isFolder: v.getUint32(r + 16, true) !== 0, children: [], trackIds: [] },
    });
  }
  const entries: { idx: number; track: number; pl: number }[] = [];
  for (const r of tableRows(v, TABLE.PLAYLIST_ENTRIES)) {
    entries.push({ idx: v.getUint32(r, true), track: v.getUint32(r + 4, true), pl: v.getUint32(r + 8, true) });
  }
  entries.sort((a, b) => a.idx - b.idx);
  for (const e of entries) raw.get(e.pl)?.node.trackIds.push(e.track);

  const root: PlaylistNode = { id: 0, name: "ROOT", isFolder: true, children: [], trackIds: [] };
  const sorted = [...raw.values()].sort((a, b) => a.sort - b.sort);
  for (const x of sorted) (raw.get(x.parent)?.node ?? root).children.push(x.node);
  return { source: "pdb", tracks, root };
}
