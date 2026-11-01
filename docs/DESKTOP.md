# USB DJ Bridge: Windows desktop build

Converts a Rekordbox-exported USB stick into playlists for Traktor Pro 4, VirtualDJ, Serato, Engine DJ, Algoriddim djay, Mixxx, and M3U8. Audio stays on the stick: every
`LOCATION` points at the drive letter, for example `VOLUME="E:" DIR="/:Contents/:Artist/:Album/:" FILE="Track.mp3"`.

## What is read

| File | Data |
| --- | --- |
| `PIONEER/rekordbox/export.pdb` | Tracks, artists, albums, genres, keys, playlist tree, and playlist entries (DeviceSQL) |
| `PIONEER/USBANLZ/**/ANLZ0000.DAT` | Beatgrid (`PQTZ`), plus basic hot and memory cues (`PCOB`) |
| `PIONEER/USBANLZ/**/ANLZ0000.EXT` | Extended cues with colors and comments (`PCO2`) |
| `rekordbox.xml` (optional) | Fallback when there is no PDB |

## Easiest: download the pre-built app

Every push to GitHub runs `.github/workflows/build-windows-exe.yml`, which builds the app on Windows.

1. Open the repository on GitHub and go to the **Actions** tab.
2. Open the latest **Build Windows EXE** run and download the **USB-DJ-Bridge-Setup** artifact (GitHub wraps it in a zip containing the single `USB-DJ-Bridge-Setup.exe`).
3. Run `USB-DJ-Bridge-Setup.exe`. It installs the app and its support files into `%LOCALAPPDATA%\Programs\USB DJ Bridge`, adds Start menu and desktop shortcuts, and registers an uninstaller. No admin rights needed.

You can also start a build by hand with **Run workflow** on the Actions tab. When you push a tag (for example `v1.0.0`), the setup file is attached to a GitHub Release as well.
Pushing a new package version to `main` also publishes its release after packaging succeeds; pushes with an already released version build artifacts without replacing that release. The installer build checks that the offline logo is embedded before publishing.

## Build it yourself (on Windows)

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
- `npm run electron:package`: writes `electron-release/USB-NML-win32-x64/USB-NML.exe`. To make the single setup file locally, install Inno Setup and run `ISCC electron\\installer.iss`; it writes `electron-release/USB-DJ-Bridge-Setup.exe`.

## Using it

1. Plug in the USB stick, then click **Open USB drive** and pick its root (for example `E:\`). The drive letter fills in automatically.
2. Browse playlists, tracks, and cues. Tick playlists, or use **Export all**.
3. For multiple playlists, choose a destination folder (the desktop picker defaults to the connected USB). Each playlist is saved as its own named file, without a ZIP, and existing files are preserved. All-software exports use separate software folders; Serato crates use `Subcrates`. Import the files into the target software; keep the stick on the same drive letter. Writing files to a USB does not automatically register them in the target software's library.
4. Supporting browsers also offer a destination folder; other browsers download each file separately and may ask permission for multiple downloads. Serato users must place downloaded crates in `Subcrates` when no folder picker is available.

The desktop build embeds the supplied logo during packaging, so it displays offline. Packaging needs internet access to retrieve that logo; using the installed converter does not.

## Notes on mapping

- Hot cues A–H map to Traktor hotcues 1–8. Extra hot cues and memory cues become non-hotcue cue points.
- Loops become Traktor `TYPE="5"` cues with `LEN` in milliseconds.
- The first beatgrid marker becomes the `AutoGrid` cue (`TYPE="4"`) and sets `TEMPO BPM`.
- Traktor NML has no per-cue color field, so colors are shown in the preview but are not written to the file.
- The browser version (web preview) cannot detect the drive letter, so enter it manually.

## Tests

`npm test` runs Vitest suites in `src/lib/rekordbox/*.test.ts`, which cover path translation, key mapping, NML generation, cue mapping, and the PDB/ANLZ/XML parsers.
