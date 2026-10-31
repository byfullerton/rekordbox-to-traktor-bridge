// Electron main process for USB→NML (Windows desktop build).
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#16181f",
    title: "USB→NML",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (process.env.ELECTRON_DEV_URL) win.loadURL(process.env.ELECTRON_DEV_URL);
  else win.loadFile(path.join(__dirname, "..", "dist-electron", "index.html"));
}

ipcMain.handle("pick-folder", async () => {
  const r = await dialog.showOpenDialog({ title: "Select the Rekordbox USB drive (e.g. E:\\)", properties: ["openDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});

// Read-only access: only metadata files are read; audio is never opened or copied.
ipcMain.handle("read-file", async (_e, absPath) => {
  try {
    return new Uint8Array(await fs.readFile(absPath));
  } catch {
    return null;
  }
});

ipcMain.handle("save-file", async (_e, name, contents) => {
  const r = await dialog.showSaveDialog({ defaultPath: name, filters: [{ name: "Traktor NML", extensions: ["nml"] }] });
  if (r.canceled || !r.filePath) return false;
  await fs.writeFile(r.filePath, contents, "utf8");
  return true;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
