import type { FileSource, Library } from "./types";
import { parsePdb } from "./pdb";
import { parseAnlz } from "./anlz";
import { parseRekordboxXml } from "./xml";

export const PDB_PATH = "/PIONEER/rekordbox/export.pdb";

/** Detect and load a rekordbox USB library from a file source rooted at the drive. */
export async function loadUsbLibrary(
  src: FileSource,
  onProgress?: (done: number, total: number) => void,
): Promise<Library> {
  const pdb = await src.read(PDB_PATH);
  if (!pdb) {
    const xml = (await src.read("/rekordbox.xml")) ?? (await src.read("/PIONEER/rekordbox.xml"));
    if (xml) return parseRekordboxXml(new TextDecoder().decode(xml));
    throw new Error("No rekordbox export found (expected PIONEER/rekordbox/export.pdb).");
  }
  const lib = parsePdb(pdb);
  const tracks = [...lib.tracks.values()];
  let done = 0;
  for (const t of tracks) {
    if (t.analyzePath) {
      const ext = await src.read(t.analyzePath.replace(/\.DAT$/i, ".EXT"));
      const dat = await src.read(t.analyzePath);
      const a = ext ? parseAnlz(ext) : null;
      const b = dat ? parseAnlz(dat) : null;
      t.beatgrid = a?.beatgrid.length ? a.beatgrid : (b?.beatgrid ?? []);
      t.cues = a?.extended ? a.cues : (b?.cues.length ? b.cues : (a?.cues ?? []));
    }
    onProgress?.(++done, tracks.length);
  }
  return lib;
}

/** FileSource backed by a browser FileList from <input webkitdirectory>. */
export function fileListSource(files: FileList | File[]): { source: FileSource; rootName: string } {
  const map = new Map<string, File>();
  let rootName = "";
  for (const f of Array.from(files)) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const parts = rel.split("/");
    rootName ||= parts.length > 1 ? parts[0]! : "";
    const path = "/" + (parts.length > 1 ? parts.slice(1) : parts).join("/");
    map.set(path.toLowerCase(), f);
  }
  return {
    rootName,
    source: {
      async read(path) {
        const f = map.get(path.toLowerCase());
        return f ? new Uint8Array(await f.arrayBuffer()) : null;
      },
    },
  };
}

/** FileSource backed by the File System Access API directory handle. */
export function dirHandleSource(root: FileSystemDirectoryHandle): FileSource {
  return {
    async read(path) {
      try {
        const parts = path.split("/").filter(Boolean);
        let dir = root;
        for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
        const fh = await dir.getFileHandle(parts[parts.length - 1]!);
        return new Uint8Array(await (await fh.getFile()).arrayBuffer());
      } catch {
        return null;
      }
    },
  };
}
