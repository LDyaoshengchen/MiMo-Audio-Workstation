const { app, BrowserWindow, dialog, Menu } = require("electron");
const path = require("node:path");

let apiServer = null;

function setupChineseMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac
      ? [
          {
            label: "铸光音频工作站",
            submenu: [
              { role: "about", label: "关于 铸光音频工作站" },
              { type: "separator" },
              { role: "services", label: "服务" },
              { type: "separator" },
              { role: "hide", label: "隐藏 铸光音频工作站" },
              { role: "hideOthers", label: "隐藏其他应用" },
              { role: "unhide", label: "显示全部" },
              { type: "separator" },
              { role: "quit", label: "退出 铸光音频工作站" }
            ]
          }
        ]
      : []),
    {
      label: "文件",
      submenu: [
        isMac ? { role: "close", label: "关闭窗口" } : { role: "quit", label: "退出" }
      ]
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" }
      ]
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新加载" },
        { role: "forceReload", label: "强制重新加载" },
        { role: "toggleDevTools", label: "切换开发者工具" },
        { type: "separator" },
        { role: "resetZoom", label: "重置缩放 (实际大小)" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "切换全屏" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front", label: "前置所有窗口" },
              { type: "separator" },
              { role: "window", label: "窗口" }
            ]
          : [{ role: "close", label: "关闭" }])
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "关于 铸光音频工作站",
          click: async () => {
            dialog.showMessageBox({
              type: "info",
              title: "关于 铸光音频工作站",
              message: "铸光音频工作站 (MiMo Audio Workstation)",
              detail: "基于大模型的高性能音频设计、语音克隆与智能有声书制作工作流工作站\n版本: 0.2.0"
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function startApiServer() {
  const appRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..");
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "server", "index.cjs")
    : path.join(appRoot, "build", "server", "index.cjs");
  const staticDir = app.isPackaged ? path.join(process.resourcesPath, "dist") : path.join(appRoot, "dist");

  process.env.MIMO_NO_AUTO_LISTEN = "1";
  process.env.MIMO_DATA_DIR = app.getPath("userData");
  process.env.MIMO_STATIC_DIR = staticDir;

  const serverModule = require(serverEntry);
  apiServer = serverModule.startServer(0, "127.0.0.1");

  await new Promise((resolve, reject) => {
    apiServer.once("listening", resolve);
    apiServer.once("error", reject);
  });

  const address = apiServer.address();
  if (!address || typeof address !== "object") {
    throw new Error("Unable to determine local API server port.");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function createWindow() {
  const localUrl = await startApiServer();
  const appRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..");
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "dist", "icon.png")
    : path.join(appRoot, "build", "icon.png");

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: "MiMo Audio Workstation",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadURL(localUrl);
}

app.whenReady().then(async () => {
  try {
    setupChineseMenu();
    await createWindow();
  } catch (error) {
    dialog.showErrorBox(
      "MiMo Audio Workstation failed to start",
      error instanceof Error ? error.message : String(error)
    );
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        dialog.showErrorBox("MiMo Audio Workstation failed to start", String(error));
      });
    }
  });
});

app.on("before-quit", () => {
  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
