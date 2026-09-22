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
  },
  onNativeThemeChanged: (callback) => {
    try {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("native-theme-changed", listener);
      return () => ipcRenderer.removeListener("native-theme-changed", listener);
    } catch {
      return () => {};
    }
  }
});
