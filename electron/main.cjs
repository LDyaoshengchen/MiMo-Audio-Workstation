const { app, BrowserWindow, dialog, Menu, ipcMain, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// 开启 Chromium 渲染硬件加速与极致秒开运行优化
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("enable-fast-unload");

let apiServer = null;

function getPackageMeta() {
  try {
    const appRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..");
    const pkgPath = path.join(appRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    }
  } catch {}
  return { version: "0.8.17", name: "mimo-voiceclone-debugger" };
}

const pkgMeta = getPackageMeta();
const APP_VERSION = pkgMeta.version || "0.8.17";

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
              detail: `基于大模型的高性能音频设计、语音克隆与智能有声书制作工作流工作站\n版本: v${APP_VERSION}`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function loadEnvFiles(appRoot) {
  const envCandidates = [
    path.join(process.resourcesPath, ".env"),
    path.join(path.dirname(process.execPath), ".env"),
    path.join(appRoot, ".env"),
    path.join(app.getPath("userData"), ".env"),
    path.resolve(process.cwd(), ".env")
  ];
  for (const p of envCandidates) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, "utf-8");
        content.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            if (key && val && !process.env[key]) {
              process.env[key] = val;
            }
          }
        });
      } catch (err) {
        console.warn(`[electron] failed to read env file ${p}:`, err);
      }
    }
  }
}

async function startApiServer() {
  const appRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..");
  loadEnvFiles(appRoot);

  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "server", "index.cjs")
    : path.join(appRoot, "build", "server", "index.cjs");
  const staticDir = app.isPackaged ? path.join(process.resourcesPath, "dist") : path.join(appRoot, "dist");

  process.env.MIMO_NO_AUTO_LISTEN = "1";
  process.env.MIMO_DATA_DIR = app.getPath("userData");
  process.env.MIMO_STATIC_DIR = staticDir;

  const serverModule = require(serverEntry);

  const PREFERRED_PORT = 38210;
  let serverInstance = null;
  try {
    serverInstance = serverModule.startServer(PREFERRED_PORT, "127.0.0.1");
    await new Promise((resolve, reject) => {
      serverInstance.once("listening", resolve);
      serverInstance.once("error", reject);
    });
  } catch {
    serverInstance = serverModule.startServer(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
      serverInstance.once("listening", resolve);
      serverInstance.once("error", reject);
    });
  }

  apiServer = serverInstance;
  const address = apiServer.address();
  if (!address || typeof address !== "object") {
    throw new Error("Unable to determine local API server port.");
  }

  return `http://127.0.0.1:${address.port}`;
}

app.name = "MiMo 音色复刻调试台";

function resolveAppIcon() {
  const appRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..");
  const candidates = [
    path.join(appRoot, "public", "icon.png"),
    path.join(appRoot, "build", "icon.png"),
    path.join(appRoot, "dist", "icon.png"),
    path.join(process.resourcesPath, "dist", "icon.png")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(appRoot, "public", "icon.png");
}

function getPersistedThemeInfo() {
  const userDataDir = app.getPath("userData");
  const themeFile = path.join(userDataDir, "theme.json");
  let saved = null;
  try {
    if (fs.existsSync(themeFile)) {
      saved = JSON.parse(fs.readFileSync(themeFile, "utf8"));
    }
  } catch {}

  const isSystemDark = nativeTheme.shouldUseDarkColors;
  let isLight = false;
  let bgColor = "#080807";

  if (saved && typeof saved === "object") {
    if (saved.mode === "light") {
      isLight = true;
      bgColor = saved.bgColor || saved.lightBgColor || "#ffffff";
    } else if (saved.mode === "dark") {
      isLight = false;
      bgColor = saved.bgColor || saved.darkBgColor || "#080807";
    } else {
      // system mode
      isLight = !isSystemDark;
      bgColor = isLight ? (saved.lightBgColor || saved.bgColor || "#ffffff") : (saved.darkBgColor || saved.bgColor || "#080807");
    }
  } else {
    // 尚未保存主题时，默认匹配操作系统当前颜色偏好（白色或黑色）
    isLight = !isSystemDark;
    bgColor = isLight ? "#ffffff" : "#080807";
  }

  return {
    mode: saved?.mode || "system",
    isLight,
    bgColor
  };
}

async function createWindow(serverUrlPromise) {
  const iconPath = resolveAppIcon();
  const preloadPath = path.join(__dirname, "preload.cjs");
  const themeInfo = getPersistedThemeInfo();

  try {
    nativeTheme.themeSource = themeInfo.isLight ? "light" : "dark";
  } catch {}

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: "铸光音频工作站",
    icon: iconPath,
    show: false, // 先创建，Chromium 渲染骨架就绪时（ready-to-show）立即现身
    backgroundColor: themeInfo.bgColor, // 严格按照当前颜色模式预先设定白色或黑色背景，消除开屏闪烁
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false // 禁用富文本拼写检查，提升大画板长文本渲染性能
    }
  });

  let hasShown = false;
  const showWindowSafely = () => {
    if (!hasShown && !window.isDestroyed()) {
      hasShown = true;
      window.show();
    }
  };

  // 1. ready-to-show 触发时（Chromium 渲染骨架就绪，通常仅需 100~200ms）即刻展示窗口，实现秒级响应！
  window.once("ready-to-show", () => {
    showWindowSafely();
  });

  // 2. 优先监听前端 React 首帧完成绘制的通知，携带最新确切的背景色
  ipcMain.once("app-first-paint", (_event, clientTheme) => {
    if (clientTheme && typeof clientTheme === "object") {
      if (clientTheme.bgColor && !window.isDestroyed()) {
        try {
          window.setBackgroundColor(clientTheme.bgColor);
        } catch {}
      }
      if (clientTheme.isLight !== undefined) {
        try {
          nativeTheme.themeSource = clientTheme.isLight ? "light" : "dark";
        } catch {}
      }
      try {
        const themeFile = path.join(app.getPath("userData"), "theme.json");
        fs.writeFileSync(themeFile, JSON.stringify(clientTheme, null, 2), "utf8");
      } catch {}
    }
    showWindowSafely();
  });

  // 监听后续用户动态切换主题模式
  ipcMain.on("app-theme-update", (_event, newTheme) => {
    try {
      if (!newTheme || typeof newTheme !== "object") return;
      const themeFile = path.join(app.getPath("userData"), "theme.json");
      fs.writeFileSync(themeFile, JSON.stringify(newTheme, null, 2), "utf8");
      if (newTheme.isLight !== undefined) {
        try {
          nativeTheme.themeSource = newTheme.isLight ? "light" : "dark";
        } catch {}
      }
      if (newTheme.bgColor && window && !window.isDestroyed()) {
        try {
          window.setBackgroundColor(newTheme.bgColor);
        } catch {}
      }
    } catch (err) {
      console.warn("[electron] failed to save theme:", err);
    }
  });

  // 3. 超时安全兜底：若 600ms 内未触发，强制显示窗口避免隐形
  setTimeout(showWindowSafely, 600);

  window.on("page-title-updated", (event, title) => {
    event.preventDefault();
    window.setTitle(title);
  });

  // 等待并行启动的服务端并即刻加载
  const localUrl = await serverUrlPromise;
  await window.loadURL(localUrl);
}

app.whenReady().then(async () => {
  try {
    setupChineseMenu();
    // 并行启动服务端与渲染窗口
    const serverUrlPromise = startApiServer();
    await createWindow(serverUrlPromise);
  } catch (error) {
    dialog.showErrorBox(
      "MiMo Audio Workstation failed to start",
      error instanceof Error ? error.message : String(error)
    );
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const serverUrlPromise = apiServer
        ? Promise.resolve(`http://127.0.0.1:${apiServer.address().port}`)
        : startApiServer();
      createWindow(serverUrlPromise).catch((error) => {
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
