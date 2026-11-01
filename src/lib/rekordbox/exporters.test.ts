import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import type { Library, PlaylistNode, Track } from "./types";
import { buildM3u8, buildSeratoCrate, buildTarget, buildVdjFolder, buildZip, TARGETS, windowsPath } from "./exporters";

const track = (id: number, path: string, title: string): Track => ({
  id, title, artist: "Art", album: "", genre: "", bpm: 124, key: "Am", durationSec: 300, bitrate: 320,
  filePath: path, beatgrid: [], cues: [],
});
const pl = (id: number, name: string, trackIds: number[]): PlaylistNode => ({ id, name, isFolder: false, children: [], trackIds });

const lib: Library = {
  source: "pdb",
  tracks: new Map([
    [1, track(1, "/Contents/A/one.mp3", "One")],
    [2, track(2, "/Contents/B/two & co.mp3", "Two")],
  ]),
  root: {
    id: 0, name: "ROOT", isFolder: true, trackIds: [],
    children: [pl(10, "Warmup", [1, 2]), { id: 20, name: "Club", isFolder: true, trackIds: [], children: [pl(21, "Peak", [2])] }, pl(30, "Warmup", [2])],
  },
};
const opts = { drive: "f", nodes: lib.root.children, folderName: "USB" };

describe("multi-software exporters", () => {
  it("builds absolute Windows paths on the stick", () => {
    expect(windowsPath("e", "/Contents/A/x.mp3")).toBe("E:\\Contents\\A\\x.mp3");
  });

  it("writes extended M3U8 with EXTINF and paths in order", () => {
    const m = buildM3u8([lib.tracks.get(2)!, lib.tracks.get(1)!], "F:", "P");
    expect(m.split("\r\n")).toEqual(["#EXTM3U", "#PLAYLIST:P", "#EXTINF:300,Art - Two", "F:\\Contents\\B\\two & co.mp3", "#EXTINF:300,Art - One", "F:\\Contents\\A\\one.mp3", ""]);
  });

  it("escapes VirtualDJ XML", () => {
    expect(buildVdjFolder([lib.tracks.get(2)!], "F:")).toContain('path="F:\\Contents\\B\\two &amp; co.mp3"');
  });

  it("encodes Serato crates as UTF-16BE tagged chunks", () => {
    const c = buildSeratoCrate([lib.tracks.get(1)!]);
    expect(String.fromCharCode(...c.slice(0, 4))).toBe("vrsn");
    const s = new TextDecoder("utf-16be").decode(c.slice(8 + new DataView(c.buffer).getUint32(4) + 16));
    expect(s).toBe("Contents/A/one.mp3");
  });

  it("keeps every playlist as its own file, even with duplicate names", () => {
    const files = buildTarget(lib, "m3u8", opts).map((f) => f.path);
    expect(files).toEqual(["Warmup - Rekordbox USB.m3u8", "Club - Peak - Rekordbox USB.m3u8", "Warmup (2) - Rekordbox USB.m3u8"]);
    expect(buildTarget(lib, "serato", opts).map((f) => f.path)).toContain("Subcrates/Club%%Peak - Rekordbox USB.crate");
  });

  it("bundles all software into separate folders", () => {
    const z = unzipSync(buildZip(lib, TARGETS.map((t) => t.id), opts));
    const names = Object.keys(z);
    expect(names).toContain("Traktor Pro 4/rekordbox-usb-F.nml");
    expect(names).toContain("Mixxx/Club - Peak - Rekordbox USB.m3u8");
    expect(names).toContain("VirtualDJ/Warmup (2) - Rekordbox USB.vdjfolder");
    expect(strFromU8(z["Engine DJ/Warmup (2) - Rekordbox USB.m3u8"]!)).not.toContain("one.mp3");
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { buildTarget as bt2 } from "./exporters";
import { buildNml as bn2 } from "./nml";
d2("playlist name suffix", () => {
  const lib = {
    tracks: new Map([[1, { id: 1, title: "T", artist: "A", album: "", genre: "", bpm: 120, key: "", durationSec: 60, bitrate: 320, filePath: "/Contents/t.mp3", cues: [], beatgrid: [] }]]),
    root: { id: 0, name: "root", isFolder: true, trackIds: [], children: [] },
  } as never;
  const nodes = [
    { id: 1, name: "Techno", isFolder: false, trackIds: [1], children: [] },
    { id: 2, name: "House", isFolder: false, trackIds: [1], children: [] },
  ];
  i2("appends ' - Rekordbox USB' to each separate playlist file", () => {
    const files = bt2(lib, "m3u8", { drive: "E", nodes, folderName: "x" });
    e2(files.map((f) => f.path)).toEqual(["Techno - Rekordbox USB.m3u8", "House - Rekordbox USB.m3u8"]);
    e2(bt2(lib, "serato", { drive: "E", nodes, folderName: "x" })[0]!.path).toBe("Subcrates/Techno - Rekordbox USB.crate");
  });
  i2("appends the suffix to Traktor playlist names", () => {
    const nml = bn2(lib, { drive: "E", nodes });
    e2(nml).toContain('NAME="Techno - Rekordbox USB"');
    e2(nml).toContain('NAME="House - Rekordbox USB"');
  });
});
