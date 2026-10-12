const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronApi", {
  getAppInfo: () => ipcRenderer.invoke("desktop-info"),
  checkForUpdates: () => ipcRenderer.invoke("desktop-check-update"),
  showMoreMenu: () => ipcRenderer.invoke("desktop-more"),
  runMenuCommand: command => ipcRenderer.invoke("desktop-menu-command", command),
  openAppLink: destination => ipcRenderer.invoke("desktop-open-link", destination),
  openStorageFolder: (kind, workspaceId) => ipcRenderer.invoke("desktop-open-storage", kind, workspaceId),
  editNative: command => ipcRenderer.invoke("desktop-edit-native", command),
  onMenuEvent: callback => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("desktop-menu-event", listener);
    return () => ipcRenderer.removeListener("desktop-menu-event", listener);
  },
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
