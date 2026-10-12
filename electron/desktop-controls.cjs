const { BrowserWindow, ipcMain, Menu, shell } = require("electron");
const REPO = "https://github.com/LDyaoshengchen/MiMo-Audio-Workstation";

function newerVersion(candidate, current) {
  const parse = value => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
  const next = parse(candidate), installed = parse(current);
  if (!next || !installed) return false;
  for (let i = 1; i <= 3; i++) {
    if (+next[i] !== +installed[i]) return +next[i] > +installed[i];
  }
  return false;
}

function action(window, command) {
  const contents = window.webContents;
  switch (command) {
    case "reload": contents.reload(); break;
    case "forceReload": contents.reloadIgnoringCache(); break;
    case "devTools": contents.toggleDevTools(); break;
    case "resetZoom": contents.setZoomLevel(0); break;
    case "zoomIn": contents.setZoomLevel(Math.min(5, contents.getZoomLevel() + 0.5)); break;
    case "zoomOut": contents.setZoomLevel(Math.max(-5, contents.getZoomLevel() - 0.5)); break;
    case "fullscreen": window.setFullScreen(!window.isFullScreen()); break;
    case "minimize": window.minimize(); break;
    case "maximize": window.isMaximized() ? window.unmaximize() : window.maximize(); break;
    case "close": window.close(); break;
  }
}

function attachWindowShortcuts(window) {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = input.key.toLowerCase(), modifier = input.control || input.meta;
    let command;
    if (key === "f11") command = "fullscreen";
    else if (modifier && !input.alt) {
      if (key === "r") command = input.shift ? "forceReload" : "reload";
      else if (key === "i" && input.shift) command = "devTools";
      else if (key === "0") command = "resetZoom";
      else if (key === "+" || key === "=") command = "zoomIn";
      else if (key === "-") command = "zoomOut";
      else if (key === "m") command = "minimize";
      else if (key === "w") command = "close";
    }
    if (command) { event.preventDefault(); action(window, command); }
  });
}

function setupDesktopControls(version) {
  function trustedWindow(event) {
    const window = BrowserWindow.fromWebContents(event.sender);
    const url = new URL(event.sender.getURL());
    if (!window || event.senderFrame !== event.sender.mainFrame || url.protocol !== "http:" || url.hostname !== "127.0.0.1") throw new Error("无效的请求来源");
    return window;
  }
  ipcMain.handle("desktop-info", event => { trustedWindow(event); return { version, repository: REPO }; });
  ipcMain.handle("desktop-menu-command", (event, command) => {
    const window = trustedWindow(event);
    if (!["reload", "forceReload", "devTools", "resetZoom", "zoomIn", "zoomOut", "fullscreen", "minimize", "maximize", "close"].includes(command)) throw new Error("无效的窗口操作");
    action(window, command);
  });
  ipcMain.handle("desktop-open-link", (event, destination) => {
    trustedWindow(event);
    if (!["repository", "release"].includes(destination)) throw new Error("无效的链接");
    return shell.openExternal(destination === "repository" ? REPO : `${REPO}/releases/latest`);
  });
  ipcMain.handle("desktop-edit-native", (event, command) => {
    trustedWindow(event);
    if (!["undo", "redo", "cut", "copy", "paste", "selectAll"].includes(command)) throw new Error("无效的编辑操作");
    event.sender[command]();
  });
  let pendingCheck = null;
  ipcMain.handle("desktop-check-update", event => {
    trustedWindow(event);
    if (!pendingCheck) pendingCheck = (async () => {
      try {
        const response = await fetch("https://api.github.com/repos/LDyaoshengchen/MiMo-Audio-Workstation/releases/latest", {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "MiMo-Audio-Workstation" }, signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "GitHub 查询频率受限，请稍后重试" : `更新服务返回 HTTP ${response.status}`);
        const release = await response.json();
        if (release.draft || release.prerelease || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error("更新信息无效");
        return { status: newerVersion(release.tag_name, version) ? "available" : "latest", version, latestVersion: release.tag_name.replace(/^v/, "") };
      } catch (error) { return { status: "error", version, message: error.name === "TimeoutError" ? "检测超时，请检查网络后重试" : "无法检测更新：" + error.message }; }
    })().finally(() => { pendingCheck = null; });
    return pendingCheck;
  });
  ipcMain.handle("desktop-more", event => {
    const window = trustedWindow(event);
    const edit = (label, command, accelerator) => ({ label, accelerator, click: () => event.sender.send("desktop-menu-event", command) });
    const item = (label, command, accelerator) => ({ label, accelerator, click: () => action(window, command) });
    Menu.buildFromTemplate([
      { label: "编辑", submenu: [edit("撤销", "undo", "CmdOrCtrl+Z"), edit("重做", "redo", "CmdOrCtrl+Y"), { type: "separator" }, edit("剪切", "cut", "CmdOrCtrl+X"), edit("复制", "copy", "CmdOrCtrl+C"), edit("粘贴", "paste", "CmdOrCtrl+V"), edit("全选", "selectAll", "CmdOrCtrl+A")] },
      { label: "视图", submenu: [item("重新加载", "reload", "CmdOrCtrl+R"), item("强制重新加载", "forceReload", "CmdOrCtrl+Shift+R"), item("开发者工具", "devTools", "CmdOrCtrl+Shift+I"), { type: "separator" }, item("重置缩放", "resetZoom", "CmdOrCtrl+0"), item("放大", "zoomIn", "CmdOrCtrl+Plus"), item("缩小", "zoomOut", "CmdOrCtrl+-"), item("全屏", "fullscreen", "F11")] },
      { label: "窗口", submenu: [item("最小化", "minimize", "CmdOrCtrl+M"), item("最大化 / 还原", "maximize"), item("关闭", "close", "CmdOrCtrl+W")] },
      { type: "separator" }, { label: "关于", click: () => event.sender.send("desktop-menu-event", "about") },
    ]).popup({ window });
  });
}
module.exports = { setupDesktopControls, attachWindowShortcuts, newerVersion };
