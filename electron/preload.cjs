const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("usbBridge", {
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  readFile: (absPath) => ipcRenderer.invoke("read-file", absPath),
  saveFile: (name, contents) => ipcRenderer.invoke("save-file", name, contents),
  saveFiles: (files) => ipcRenderer.invoke("save-files", files),
  getVersion: () => ipcRenderer.invoke("app-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
});
