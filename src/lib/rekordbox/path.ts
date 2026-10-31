export interface TraktorLocation {
  VOLUME: string;
  DIR: string;
  FILE: string;
  VOLUMEID: string;
}

/** Normalise a drive letter input ("e", "E:", "E:\\") to "E:". */
export function normalizeDrive(drive: string): string {
  const m = drive.trim().match(/^([a-zA-Z])/);
  if (!m) throw new Error(`Invalid drive letter: "${drive}"`);
  return `${m[1].toUpperCase()}:`;
}

/** Split any path flavour into clean segments ("E:\\Contents\\a.mp3", "/Contents/a.mp3", "file://localhost/E:/..."). */
export function pathSegments(path: string): string[] {
  let p = path.replace(/^file:\/\/localhost\//i, "").replace(/^file:\/\/\//i, "");
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  p = p.replace(/\\/g, "/").replace(/^[a-zA-Z]:/, "");
  return p.split("/").filter((s) => s.length > 0);
}

/**
 * Map a USB-relative audio path onto Traktor's NML LOCATION format, pointing at the
 * mounted drive so audio is never copied. "/Contents/A/B/x.mp3" on E: becomes
 * VOLUME="E:" DIR="/:Contents/:A/:B/:" FILE="x.mp3".
 */
export function toTraktorLocation(drive: string, relPath: string): TraktorLocation {
  const vol = normalizeDrive(drive);
  const segs = pathSegments(relPath);
  if (segs.length === 0) throw new Error(`Empty path`);
  const file = segs[segs.length - 1];
  const dirs = segs.slice(0, -1);
  const DIR = "/:" + dirs.map((d) => `${d}/:`).join("");
  return { VOLUME: vol, DIR, FILE: file, VOLUMEID: vol };
}

/** Traktor's PRIMARYKEY for playlist entries: VOLUME + DIR + FILE. */
export function traktorPrimaryKey(loc: TraktorLocation): string {
  return `${loc.VOLUME}${loc.DIR}${loc.FILE}`;
}
