import { describe, expect, it } from "vitest";
import { normalizeDrive, toTraktorLocation, traktorPrimaryKey } from "./path";
import { toTraktorKeyValue } from "./keys";
import { buildNml, cueElements, escapeXml } from "./nml";
import { parseRekordboxXml } from "./xml";
import { parseAnlz } from "./anlz";
import { parsePdb, readDeviceSqlString, TABLE } from "./pdb";
import type { Library, Track } from "./types";

const track = (over: Partial<Track> = {}): Track => ({
  id: 1, title: "Song", artist: "DJ", album: "LP", genre: "House", bpm: 124, key: "Am",
  durationSec: 300, bitrate: 320, filePath: "/Contents/DJ/LP/Song.mp3", beatgrid: [], cues: [], ...over,
});

describe("path translation", () => {
  it("maps a USB path to Traktor VOLUME/DIR/FILE", () => {
    expect(toTraktorLocation("E:", "/Contents/Artist/Album/Track.mp3")).toMatchObject({
      VOLUME: "E:", DIR: "/:Contents/:Artist/:Album/:", FILE: "Track.mp3",
    });
  });
  it("accepts Windows paths and file URLs", () => {
    expect(toTraktorLocation("f", "F:\\Contents\\A\\x.wav").DIR).toBe("/:Contents/:A/:");
    expect(toTraktorLocation("E:", "file://localhost/E:/Contents/My%20Artist/t.mp3")).toMatchObject({
      DIR: "/:Contents/:My Artist/:", FILE: "t.mp3",
    });
  });
  it("builds the playlist primary key", () => {
    expect(traktorPrimaryKey(toTraktorLocation("E:", "/Contents/a.mp3"))).toBe("E:/:Contents/:a.mp3");
  });
  it("normalises drive letters", () => {
    expect(normalizeDrive("e:\\")).toBe("E:");
    expect(() => normalizeDrive("1")).toThrow();
  });
});

describe("key mapping", () => {
  it.each([["C", 0], ["Am", 21], ["F#m", 18], ["Db", 1], ["8A", 21], ["8B", 0], ["Bbm", 22]])("%s -> %i", (k, v) => {
    expect(toTraktorKeyValue(k)).toBe(v);
  });
  it("returns null for unknown", () => expect(toTraktorKeyValue("")).toBeNull());
});

describe("cue mapping", () => {
  it("maps hot cues, memory cues, loops, and grid", () => {
    const els = cueElements(track({
      beatgrid: [{ startMs: 52.5, bpm: 124 }],
      cues: [
        { kind: "hot", slot: 0, startMs: 1000, loopMs: 0, name: "Drop", color: "#ff0000" },
        { kind: "memory", slot: -1, startMs: 2000, loopMs: 0, name: "", color: null },
        { kind: "hot", slot: 2, startMs: 3000, loopMs: 4000, name: "", color: null },
        { kind: "hot", slot: 9, startMs: 5000, loopMs: 0, name: "J", color: null },
      ],
    }));
    expect(els[0]).toContain('TYPE="4"');
    expect(els[0]).toContain('START="52.500000"');
    expect(els[1]).toMatch(/NAME="Drop".*TYPE="0".*START="1000.000000".*HOTCUE="0"/);
    expect(els[2]).toMatch(/TYPE="0".*HOTCUE="-1"/);
    expect(els[3]).toMatch(/NAME="Hot Cue C".*TYPE="5".*LEN="4000.000000".*HOTCUE="2"/);
    expect(els[4]).toContain('HOTCUE="-1"');
  });
});

describe("NML generation", () => {
  const lib: Library = {
    source: "pdb",
    tracks: new Map([[1, track()], [2, track({ id: 2, title: 'A & "B"', filePath: "/Contents/x/y.mp3" })]]),
    root: {
      id: 0, name: "ROOT", isFolder: true, trackIds: [],
      children: [
        { id: 10, name: "Folder", isFolder: true, trackIds: [], children: [
          { id: 11, name: "Peak", isFolder: false, children: [], trackIds: [2, 1] },
        ] },
        { id: 12, name: "Warmup", isFolder: false, children: [], trackIds: [1] },
      ],
    },
  };

  it("produces well-formed XML with collection and playlists", () => {
    const xml = buildNml(lib, { drive: "E:" });
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
    expect(doc.querySelector("COLLECTION")?.getAttribute("ENTRIES")).toBe("2");
    const loc = doc.querySelector('COLLECTION ENTRY[TITLE="Song"] LOCATION')!;
    expect(loc.getAttribute("VOLUME")).toBe("E:");
    expect(loc.getAttribute("DIR")).toBe("/:Contents/:DJ/:LP/:");
    const peak = [...doc.querySelectorAll('NODE[TYPE="PLAYLIST"]')].find((n) => n.getAttribute("NAME") === "Peak")!;
    const keys = [...peak.querySelectorAll("PRIMARYKEY")].map((k) => k.getAttribute("KEY"));
    expect(keys).toEqual(["E:/:Contents/:x/:y.mp3", "E:/:Contents/:DJ/:LP/:Song.mp3"]);
    expect(doc.querySelector('ENTRY[TITLE]')?.querySelector("MUSICAL_KEY")?.getAttribute("VALUE")).toBe("21");
  });

  it("exports only selected playlists", () => {
    const xml = buildNml(lib, { drive: "F:", nodes: [lib.root.children[1]!] });
    expect(xml).toContain('COLLECTION ENTRIES="1"');
    expect(xml).not.toContain("Peak");
    expect(xml).toContain('VOLUME="F:"');
  });

  it("escapes XML characters", () => {
    expect(escapeXml(`<a & "b">`)).toBe("&lt;a &amp; &quot;b&quot;&gt;");
  });
});

describe("rekordbox.xml parser", () => {
  it("reads tracks, cues, grid, and playlists", () => {
    const lib = parseRekordboxXml(`<?xml version="1.0"?><DJ_PLAYLISTS><COLLECTION Entries="1">
      <TRACK TrackID="5" Name="T" Artist="A" AverageBpm="128.00" Tonality="Fm" TotalTime="200"
        Location="file://localhost/E:/Contents/A/T.mp3">
        <TEMPO Inizio="0.050" Bpm="128.00"/>
        <POSITION_MARK Name="Intro" Type="0" Start="1.5" Num="1" Red="255" Green="0" Blue="16"/>
        <POSITION_MARK Name="" Type="4" Start="10" End="12" Num="-1"/>
      </TRACK></COLLECTION>
      <PLAYLISTS><NODE Type="0" Name="ROOT"><NODE Type="0" Name="F"><NODE Type="1" Name="P"><TRACK Key="5"/></NODE></NODE></NODE></PLAYLISTS>
      </DJ_PLAYLISTS>`);
    const t = lib.tracks.get(5)!;
    expect(t.filePath).toBe("/Contents/A/T.mp3");
    expect(t.beatgrid[0]).toEqual({ startMs: 50, bpm: 128 });
    expect(t.cues[0]).toMatchObject({ kind: "hot", slot: 1, startMs: 1500, color: "#ff0010" });
    expect(t.cues[1]).toMatchObject({ kind: "memory", loopMs: 2000 });
    expect(lib.root.children[0]!.children[0]).toMatchObject({ name: "P", trackIds: [5] });
  });
});

// ---- binary fixtures ----
function anlzFixture(): Uint8Array {
  const b = new Uint8Array(512);
  const v = new DataView(b.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  tag(0, "PMAI"); v.setUint32(4, 28);
  let o = 28;
  // PQTZ with 1 beat
  tag(o, "PQTZ"); v.setUint32(o + 4, 24); v.setUint32(o + 8, 32); v.setUint32(o + 20, 1);
  v.setUint16(o + 24, 1); v.setUint16(o + 26, 12450); v.setUint32(o + 28, 87);
  o += 32;
  // PCO2 with 1 hot cue (B), comment "Hi", rgb
  const comment = 6; // "Hi\0" utf16
  const entryLen = 44 + comment + 4;
  tag(o, "PCO2"); v.setUint32(o + 4, 20); v.setUint32(o + 8, 20 + entryLen); v.setUint32(o + 12, 1); v.setUint16(o + 16, 1);
  const e = o + 20;
  tag(e, "PCP2"); v.setUint32(e + 4, 16); v.setUint32(e + 8, entryLen); v.setUint32(e + 12, 2);
  v.setUint8(e + 16, 2); v.setUint32(e + 20, 1000); v.setUint32(e + 24, 3000); v.setUint8(e + 28, 3);
  v.setUint32(e + 40, comment); v.setUint16(e + 44, 72); v.setUint16(e + 46, 105);
  v.setUint8(e + 50, 1); v.setUint8(e + 51, 0x12); v.setUint8(e + 52, 0x34); v.setUint8(e + 53, 0x56);
  v.setUint32(8, o + 20 + entryLen);
  return b.slice(0, o + 20 + entryLen);
}

describe("ANLZ parser", () => {
  it("reads beatgrid and extended cues", () => {
    const r = parseAnlz(anlzFixture());
    expect(r.beatgrid[0]).toEqual({ bpm: 124.5, startMs: 87 });
    expect(r.extended).toBe(true);
    expect(r.cues[0]).toEqual({ kind: "hot", slot: 1, startMs: 1000, loopMs: 2000, name: "Hi", color: "#123456" });
  });
});

const PAGE = 4096;
function shortStr(s: string): number[] {
  return [((s.length + 1) << 1) | 1, ...[...s].map((c) => c.charCodeAt(0))];
}
function pdbFixture(): Uint8Array {
  const tables: [number, number[][]][] = [];
  // artist row: subtype 0x60, index, id, 0x03, ofs_name=10
  tables.push([TABLE.ARTISTS, [[0x60, 0, 0, 0, 7, 0, 0, 0, 3, 10, ...shortStr("Artist")]]]);
  // track row: 94 + 21*2 = 136 bytes header, then strings
  const tr = new Array(136).fill(0);
  const dv = new DataView(new ArrayBuffer(136));
  dv.setUint32(56, 12600, true); dv.setUint32(68, 7, true); dv.setUint32(72, 42, true); dv.setUint16(84, 240, true);
  const title = shortStr("Title"), path = shortStr("/Contents/A/t.mp3"), empty = shortStr("");
  for (let i = 0; i < 21; i++) dv.setUint16(94 + i * 2, 136 + title.length + path.length, true);
  dv.setUint16(94 + 17 * 2, 136, true);
  dv.setUint16(94 + 20 * 2, 136 + title.length, true);
  for (let i = 0; i < 136; i++) tr[i] = dv.getUint8(i);
  tables.push([TABLE.TRACKS, [[...tr, ...title, ...path, ...empty]]]);
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  tables.push([TABLE.PLAYLIST_TREE, [
    [...u32(0), ...u32(0), ...u32(0), ...u32(1), ...u32(1), ...shortStr("Folder")],
    [...u32(1), ...u32(0), ...u32(0), ...u32(2), ...u32(0), ...shortStr("Set")],
  ]]);
  tables.push([TABLE.PLAYLIST_ENTRIES, [[...u32(1), ...u32(42), ...u32(2)]]]);

  const buf = new Uint8Array(PAGE * (tables.length + 1));
  const v = new DataView(buf.buffer);
  v.setUint32(4, PAGE, true); v.setUint32(8, tables.length, true);
  tables.forEach(([type, rows], i) => {
    const page = i + 1;
    const t = 0x1c + i * 16;
    v.setUint32(t, type, true); v.setUint32(t + 8, page, true); v.setUint32(t + 12, page, true);
    const base = page * PAGE;
    v.setUint32(base + 4, page, true); v.setUint32(base + 8, type, true);
    v.setUint8(base + 24, rows.length);
    let heap = 0;
    let present = 0;
    rows.forEach((r, j) => {
      buf.set(r, base + 0x28 + heap);
      v.setUint16(base + PAGE - 6 - 2 * j, heap, true);
      present |= 1 << j;
      heap += r.length + (r.length % 4 ? 4 - (r.length % 4) : 0);
    });
    v.setUint16(base + PAGE - 4, present, true);
  });
  return buf;
}

describe("PDB parser", () => {
  it("decodes DeviceSQL short strings", () => {
    const b = new Uint8Array(shortStr("abc"));
    expect(readDeviceSqlString(new DataView(b.buffer), 0)).toBe("abc");
  });
  it("reads tracks, artists, and playlist tree", () => {
    const lib = parsePdb(pdbFixture());
    const t = lib.tracks.get(42)!;
    expect(t).toMatchObject({ title: "Title", artist: "Artist", bpm: 126, durationSec: 240, filePath: "/Contents/A/t.mp3" });
    expect(lib.root.children[0]).toMatchObject({ name: "Folder", isFolder: true });
    expect(lib.root.children[0]!.children[0]).toMatchObject({ name: "Set", trackIds: [42] });
  });
});
