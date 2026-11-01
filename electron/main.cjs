// Electron main process for USB→NML (Windows desktop build).
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#16181f",
    title: "USB DJ Bridge",
    icon: path.join(__dirname, "icon.ico"),
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
  const extension = path.extname(name).slice(1);
  const r = await dialog.showSaveDialog({ defaultPath: path.basename(name), filters: [{ name: "DJ playlist export", extensions: [extension] }] });
  if (r.canceled || !r.filePath) return false;
  await fs.writeFile(r.filePath, typeof contents === "string" ? contents : Buffer.from(contents));
  return true;
});

// ---- Auto-update: checks GitHub Releases, downloads the new installer, and runs it silently.
const { spawn } = require("node:child_process");
const os = require("node:os");
const { LATEST_RELEASE_API, ASSET_NAME, evaluateRelease } = require("./update.cjs");
let pendingUpdate = null;

async function checkForUpdates() {
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "USB-DJ-Bridge" },
    });
    if (!res.ok) return { available: false, current: app.getVersion(), error: `Update server returned ${res.status}` };
    const result = evaluateRelease(await res.json(), app.getVersion());
    pendingUpdate = result.available ? result : null;
    return result;
  } catch (e) {
    return { available: false, current: app.getVersion(), error: String(e?.message || e) };
  }
}

ipcMain.handle("app-version", () => app.getVersion());
ipcMain.handle("check-updates", () => checkForUpdates());
ipcMain.handle("install-update", async () => {
  const update = pendingUpdate || (await checkForUpdates());
  if (!update?.available) return { ok: false, error: "No update available" };
  try {
    const res = await fetch(update.url, { headers: { "User-Agent": "USB-DJ-Bridge" } });
    if (!res.ok) return { ok: false, error: `Download failed (${res.status})` };
    const file = path.join(os.tmpdir(), `${update.latest}-${ASSET_NAME}`);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    // Silent install over the current version; the installer relaunches the app when done.
    spawn(file, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS"], {
      detached: true,
      stdio: "ignore",
    }).unref();
    setTimeout(() => app.quit(), 500);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
