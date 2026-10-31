/** Rekordbox ANLZ (.DAT / .EXT) analysis file reader: beatgrid (PQTZ) and cues (PCOB / PCO2). */
import type { BeatMarker, Cue } from "./types";

/** Rekordbox's fixed hot cue palette (color_id 1..8) used when no RGB is stored. */
export const RB_COLORS: Record<number, string> = {
  1: "#ff0099", 2: "#ff0000", 3: "#ff8800", 4: "#ffee00", 5: "#00ff00", 6: "#00ffff", 7: "#0000ff", 8: "#aa00ff",
};

const fourcc = (v: DataView, o: number) =>
  String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

export interface AnlzResult {
  beatgrid: BeatMarker[];
  cues: Cue[];
  /** true when the cues came from an extended PCO2 tag (with colors / comments) */
  extended: boolean;
}

const hex = (n: number) => n.toString(16).padStart(2, "0");

export function parseAnlz(buf: Uint8Array): AnlzResult {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const res: AnlzResult = { beatgrid: [], cues: [], extended: false };
  if (buf.byteLength < 12 || fourcc(v, 0) !== "PMAI") return res;
  const basic: Cue[] = [];
  const ext: Cue[] = [];
  let off = v.getUint32(4);
  while (off + 12 <= buf.byteLength) {
    const tag = fourcc(v, off);
    const lenTag = v.getUint32(off + 8);
    if (lenTag < 12) break;
    if (tag === "PQTZ") {
      const n = v.getUint32(off + 20);
      const first = off + 24;
      if (n > 0) {
        res.beatgrid.push({ bpm: v.getUint16(first + 2) / 100, startMs: v.getUint32(first + 4) });
      }
    } else if (tag === "PCOB") {
      const kind = v.getUint32(off + 12) === 1 ? "hot" : "memory";
      let e = off + v.getUint32(off + 4);
      const end = off + lenTag;
      while (e + 40 <= end && fourcc(v, e) === "PCPT") {
        const lenEntry = v.getUint32(e + 8);
        const hot = v.getUint32(e + 12);
        const type = v.getUint8(e + 28);
        const time = v.getUint32(e + 32);
        const loop = v.getUint32(e + 36);
        basic.push({
          kind: hot > 0 ? "hot" : kind === "hot" ? "hot" : "memory",
          slot: hot > 0 ? hot - 1 : -1,
          startMs: time,
          loopMs: type === 2 && loop !== 0xffffffff && loop > time ? loop - time : 0,
          name: "",
          color: null,
        });
        if (lenEntry < 40) break;
        e += lenEntry;
      }
    } else if (tag === "PCO2") {
      const count = v.getUint16(off + 16);
      let e = off + v.getUint32(off + 4);
      for (let i = 0; i < count && e + 44 <= off + lenTag && fourcc(v, e) === "PCP2"; i++) {
        const lenEntry = v.getUint32(e + 8);
        const hot = v.getUint32(e + 12);
        const type = v.getUint8(e + 16);
        const time = v.getUint32(e + 20);
        const loop = v.getUint32(e + 24);
        const colorId = v.getUint8(e + 28);
        const lenComment = v.getUint32(e + 40);
        let name = "";
        for (let j = 0; j + 1 < lenComment; j += 2) {
          const c = v.getUint16(e + 44 + j);
          if (c === 0) break;
          name += String.fromCharCode(c);
        }
        let color: string | null = RB_COLORS[colorId] ?? null;
        const cOff = e + 44 + lenComment;
        if (cOff + 4 <= e + lenEntry) {
          const r = v.getUint8(cOff + 1), g = v.getUint8(cOff + 2), b = v.getUint8(cOff + 3);
          if (v.getUint8(cOff) !== 0 || r || g || b) color = `#${hex(r)}${hex(g)}${hex(b)}`;
        }
        ext.push({
          kind: hot > 0 ? "hot" : "memory",
          slot: hot > 0 ? hot - 1 : -1,
          startMs: time,
          loopMs: type === 2 && loop !== 0xffffffff && loop > time ? loop - time : 0,
          name,
          color,
        });
        if (lenEntry < 44) break;
        e += lenEntry;
      }
    }
    off += lenTag;
  }
  if (ext.length) {
    res.cues = ext;
    res.extended = true;
  } else res.cues = basic;
  res.cues.sort((a, b) => a.startMs - b.startMs);
  return res;
}
