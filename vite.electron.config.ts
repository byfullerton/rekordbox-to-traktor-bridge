// Builds the desktop renderer as a static SPA loaded via file:// by Electron.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import logoAsset from "./src/assets/logo.png.asset.json";

export default defineConfig({
  root: path.resolve(__dirname, "electron/renderer"),
  base: "./",
  plugins: [
    {
      name: "bundle-offline-logo",
      enforce: "pre",
      async transform(_code, id) {
        const norm = (p: string) => p.split("?")[0]!.replace(/\\/g, "/").toLowerCase();
        if (norm(id) !== norm(path.resolve(__dirname, "src/assets/logo.png.asset.json"))) return;
        const response = await fetch(new URL(logoAsset.url, "https://rekordbox-to-traktor-bridge.lovable.app"));
        if (!response.ok) throw new Error(`Cannot bundle desktop logo (${response.status})`);
        const bytes = Buffer.from(await response.arrayBuffer());
        return { code: JSON.stringify({ ...logoAsset, url: `data:${logoAsset.content_type};base64,${bytes.toString("base64")}` }), map: null };
      },
    },
    react(), tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: path.resolve(__dirname, "dist-electron"), emptyOutDir: true },
});
