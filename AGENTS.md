<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Rekordbox parsing and NML generation live in pure modules under `src/lib/rekordbox/` reading through a `FileSource` abstraction — keeps them testable and shared by web and Electron.
- The Electron desktop build uses a separate plain-Vite SPA entry (`electron/renderer`, `vite.electron.config.ts`) rendering the same `ConverterApp` — TanStack Start SSR output cannot load over `file://`.
- Electron renderer accesses the disk only via the `window.usbBridge` preload API (read-only metadata reads plus file/folder save dialogs); folder exports validate playlist paths and never overwrite existing files — audio files are never opened or copied.
- NML playlist identities use fixed-width ID and counter fields — variable-width concatenation can collide and cause importers to treat distinct playlists as one.
- All targets live in `src/lib/rekordbox/exporters.ts`, writing one importer-facing file per leaf playlist with collision-safe names; batch exports save directly to folders through Electron IPC or browser directory handles, falling back to individual browser downloads — no unzip step or merged playlists.
- The desktop Vite build embeds the CDN logo pointer as a data URL at build time and fails if the asset is unavailable — the supplied logo renders offline without duplicating binary assets in source.
