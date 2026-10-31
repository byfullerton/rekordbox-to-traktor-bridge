export type CueKind = "hot" | "memory";

export interface Cue {
  kind: CueKind;
  /** Hot cue slot: 0 = A, 1 = B, ... ; -1 for memory cues */
  slot: number;
  startMs: number;
  /** Loop length in ms (0 = plain cue) */
  loopMs: number;
  name: string;
  /** Hex color like #ff0000, or null */
  color: string | null;
}

export interface BeatMarker {
  startMs: number;
  bpm: number;
}

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  bpm: number;
  /** Musical key text, e.g. "Am", "F#", "8A" */
  key: string;
  durationSec: number;
  bitrate: number;
  /** Path relative to the USB root, forward slashes, e.g. /Contents/Artist/Album/Track.mp3 */
  filePath: string;
  analyzePath?: string;
  beatgrid: BeatMarker[];
  cues: Cue[];
}

export interface PlaylistNode {
  id: number;
  name: string;
  isFolder: boolean;
  children: PlaylistNode[];
  trackIds: number[];
}

export interface Library {
  source: "pdb" | "xml";
  tracks: Map<number, Track>;
  /** Root folder node (name "ROOT") */
  root: PlaylistNode;
}

/** Abstract file reader rooted at the USB drive. Paths use forward slashes, starting with "/". */
export interface FileSource {
  read(path: string): Promise<Uint8Array | null>;
}
