# Rekordbox To Traktor Bridge

Build a desktop-ready application tailored for Windows that allows DJs to plug in a friend's Rekordbox-exported USB stick and immediately generate an importable Traktor Pro 4 playlist (NML) without transferring or copying any audio files to the local PC.

Key features and requirements:

1. USB Drive Detection & Directory Picker:
   - Provide drive selector / directory picker targeting mounted USB sticks on Windows (e.g. E:\, F:\) or folders containing PIONEER / rekordbox exports.
   - Detect Rekordbox USB library structures (e.g., PIONEER/rekordbox/export.pdb, DeviceSQL database, or rekordbox XML/PDB structures) and Contents/ audio folder.

2. Parser & Conversion Engine:
   - Read Rekordbox metadata from the USB: track titles, artists, albums, BPM, musical key, beatgrids, and cue points (hot cues and memory cues with colors and millisecond offsets).
   - Convert metadata into Traktor Pro 4 Collection/Playlist NML schema (<COLLECTION>, <ENTRY>, <CUE_V2>, <PLAYLISTS>, <NODE>).
   - Crucial path handling: keep audio file paths mapped directly to the mounted drive letter and relative path (e.g., "E:/Contents/Artist/Album/Track.mp3" formatted to Traktor's volume/directory NML format `VOLUME="E:" DIR="/:Contents/:Artist/:Album/:" FILE="Track.mp3"`), so no audio files are copied.

3. Playlist Management & Preview:
   - Display the USB's playlist hierarchy, tracklist, cue markers, and track metadata in a DJ-styled dark mode UI.
   - Allow selecting individual playlists or exporting all playlists.
   - Generate and download the resulting `.nml` file ready to be dragged directly into Traktor Pro 4's browser.

4. Architecture & Packaging:
   - Include clear scripts, configuration, and documentation for Electron desktop packaging on Windows.
   - Ensure a clean, comprehensive test suite (unit tests with Vitest) covering the NML XML generation, path translation, and cue point mapping.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rekordbox-to-traktor-bridge.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8395f477-7b26-4a5f-9a24-19e72e4e33c1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
