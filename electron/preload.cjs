const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronApi", {
  notifyReady: (themeData) => {
    try {
      ipcRenderer.send("app-first-paint", themeData);
    } catch {}
  },
  saveTheme: (themeData) => {
    try {
      ipcRenderer.send("app-theme-update", themeData);
    } catch {}
  }
});
