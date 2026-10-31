# USB→NML: Windows desktop build

Converts a Rekordbox-exported USB stick into a Traktor Pro 4 `.nml` file. Audio stays on the stick: every
`LOCATION` points at the drive letter, for example `VOLUME="E:" DIR="/:Contents/:Artist/:Album/:" FILE="Track.mp3"`.

## What is read

| File | Data |
| --- | --- |
| `PIONEER/rekordbox/export.pdb` | Tracks, artists, albums, genres, keys, playlist tree, and playlist entries (DeviceSQL) |
| `PIONEER/USBANLZ/**/ANLZ0000.DAT` | Beatgrid (`PQTZ`), plus basic hot and memory cues (`PCOB`) |
| `PIONEER/USBANLZ/**/ANLZ0000.EXT` | Extended cues with colors and comments (`PCO2`) |
| `rekordbox.xml` (optional) | Fallback when there is no PDB |

## Setup (on Windows)

```powershell
npm install
npm install --save-dev electron @electron/packager
```

These scripts are already in `package.json`:

```json
"main": "electron/main.cjs",
"scripts": {
  "electron:build-ui": "vite build --config vite.electron.config.ts",
  "electron:start": "npm run electron:build-ui && electron .",
  "electron:package": "npm run electron:build-ui && electron-packager . USB-NML --platform=win32 --arch=x64 --out=electron-release --overwrite --ignore=^/src --ignore=^/public --ignore=^/electron-release --ignore=^/node_modules"
}
```

- `npm run electron:start`: runs the desktop app.
- `npm run electron:package`: writes `electron-release/USB-NML-win32-x64/USB-NML.exe`. Zip that folder to share it.

## Using it

1. Plug in the USB stick, then click **Open USB drive** and pick its root (for example `E:\`). The drive letter fills in automatically.
2. Browse playlists, tracks, and cues. Tick playlists, or use **Export all**.
3. Save the `.nml` file and drag it into Traktor's browser (or use *Import Collection*). Keep the stick on the same drive letter.

## Notes on mapping

- Hot cues A–H map to Traktor hotcues 1–8. Extra hot cues and memory cues become non-hotcue cue points.
- Loops become Traktor `TYPE="5"` cues with `LEN` in milliseconds.
- The first beatgrid marker becomes the `AutoGrid` cue (`TYPE="4"`) and sets `TEMPO BPM`.
- Traktor NML has no per-cue color field, so colors are shown in the preview but are not written to the file.
- The browser version (web preview) cannot detect the drive letter, so enter it manually.

## Tests

`npm test` runs Vitest suites in `src/lib/rekordbox/*.test.ts`, which cover path translation, key mapping, NML generation, cue mapping, and the PDB/ANLZ/XML parsers.
