const NOTES: Record<string, number> = {
  C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5, "F#": 6, GB: 6,
  G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11,
};

// Camelot -> [note index, minor]
const CAMELOT_MAJOR = [11, 6, 1, 8, 3, 10, 5, 0, 7, 2, 9, 4]; // 1B..12B
const CAMELOT_MINOR = [8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1]; // 1A..12A

/**
 * Convert a key string (e.g. "Am", "F#m", "Dbmaj", "8A") to Traktor's MUSICAL_KEY value:
 * 0..11 = C..B major, 12..23 = Cm..Bm. Returns null when unknown.
 */
export function toTraktorKeyValue(key: string): number | null {
  const k = key.trim();
  if (!k) return null;
  const cam = k.match(/^(\d{1,2})\s*([AaBb])$/);
  if (cam) {
    const n = parseInt(cam[1], 10);
    if (n < 1 || n > 12) return null;
    return cam[2].toUpperCase() === "A" ? CAMELOT_MINOR[n - 1] + 12 : CAMELOT_MAJOR[n - 1];
  }
  const m = k.match(/^([A-Ga-g])([#b♯♭]?)\s*(m|min|minor|maj|major)?$/);
  if (!m) return null;
  const acc = m[2] === "♯" ? "#" : m[2] === "♭" ? "B" : m[2] === "b" ? "B" : m[2];
  const note = NOTES[(m[1].toUpperCase() + acc).toUpperCase()];
  if (note === undefined) return null;
  const minor = m[3] ? /^m(in(or)?)?$/i.test(m[3]) : false;
  return minor ? note + 12 : note;
}
