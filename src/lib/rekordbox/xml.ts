import type { Cue, Library, PlaylistNode, Track } from "./types";
import { pathSegments } from "./path";

const hex = (n: number) => n.toString(16).padStart(2, "0");

/** Parse a rekordbox.xml (DJ_PLAYLISTS) export. */
export function parseRekordboxXml(xml: string): Library {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid rekordbox XML");
  const tracks = new Map<number, Track>();
  const num = (el: Element, a: string) => parseFloat(el.getAttribute(a) ?? "") || 0;
  const str = (el: Element, a: string) => el.getAttribute(a) ?? "";

  const coll = doc.getElementsByTagName("COLLECTION")[0];
  for (const t of Array.from(coll?.getElementsByTagName("TRACK") ?? [])) {
    const id = parseInt(str(t, "TrackID"), 10);
    if (!Number.isFinite(id)) continue;
    const segs = pathSegments(str(t, "Location"));
    const cues: Cue[] = Array.from(t.getElementsByTagName("POSITION_MARK")).map((p) => {
      const slot = parseInt(str(p, "Num") || "-1", 10);
      const start = num(p, "Start") * 1000;
      const end = p.hasAttribute("End") ? num(p, "End") * 1000 : 0;
      const hasColor = p.hasAttribute("Red");
      return {
        kind: slot >= 0 ? "hot" : "memory",
        slot,
        startMs: start,
        loopMs: str(p, "Type") === "4" && end > start ? end - start : 0,
        name: str(p, "Name"),
        color: hasColor ? `#${hex(num(p, "Red"))}${hex(num(p, "Green"))}${hex(num(p, "Blue"))}` : null,
      };
    });
    tracks.set(id, {
      id,
      title: str(t, "Name"),
      artist: str(t, "Artist"),
      album: str(t, "Album"),
      genre: str(t, "Genre"),
      comment: str(t, "Comments"),
      bpm: num(t, "AverageBpm"),
      key: str(t, "Tonality"),
      durationSec: num(t, "TotalTime"),
      bitrate: num(t, "BitRate"),
      filePath: segs.length ? "/" + segs.join("/") : "",
      beatgrid: Array.from(t.getElementsByTagName("TEMPO")).map((g) => ({
        startMs: num(g, "Inizio") * 1000,
        bpm: num(g, "Bpm"),
      })),
      cues,
    });
  }

  let nextId = 1;
  const walk = (el: Element): PlaylistNode => {
    const isFolder = str(el, "Type") === "0";
    const node: PlaylistNode = { id: nextId++, name: str(el, "Name"), isFolder, children: [], trackIds: [] };
    for (const c of Array.from(el.children)) {
      if (c.tagName === "NODE") node.children.push(walk(c));
      else if (c.tagName === "TRACK") node.trackIds.push(parseInt(str(c, "Key"), 10));
    }
    return node;
  };
  const rootEl = doc.querySelector("PLAYLISTS > NODE");
  const root = rootEl ? walk(rootEl) : { id: 0, name: "ROOT", isFolder: true, children: [], trackIds: [] };
  root.name = "ROOT";
  return { source: "xml", tracks, root };
}
