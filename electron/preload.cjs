const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("usbBridge", {
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  readFile: (absPath) => ipcRenderer.invoke("read-file", absPath),
  saveFile: (name, contents) => ipcRenderer.invoke("save-file", name, contents),
});
