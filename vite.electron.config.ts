// Builds the desktop renderer as a static SPA loaded via file:// by Electron.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "electron/renderer"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: path.resolve(__dirname, "dist-electron"), emptyOutDir: true },
});
