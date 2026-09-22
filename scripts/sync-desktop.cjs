const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const appOutDir = path.join(rootDir, "desktop-build", "MiMo-Audio-Workstation-win32-x64");
const resourcesDir = path.join(appOutDir, "resources");

if (!fs.existsSync(resourcesDir)) {
  console.log("⚠️ desktop-build 目录尚未生成，跳过同步。");
  process.exit(0);
}

const targetDist = path.join(resourcesDir, "dist");
const targetServer = path.join(resourcesDir, "server");
const targetApp = path.join(resourcesDir, "app");

try {
  console.log("🔄 正在将最新构建资源实时同步至客户端运行目录...");
  
  if (fs.existsSync(path.join(rootDir, "dist"))) {
    fs.cpSync(path.join(rootDir, "dist"), targetDist, { recursive: true });
    console.log("  ✅ dist 静态网页资源已同步");
  }

  if (fs.existsSync(path.join(rootDir, "build", "server"))) {
    fs.cpSync(path.join(rootDir, "build", "server"), targetServer, { recursive: true });
    console.log("  ✅ server 服务端打包已同步");
  }

  if (fs.existsSync(path.join(rootDir, "electron"))) {
    fs.mkdirSync(path.join(targetApp, "electron"), { recursive: true });
    fs.cpSync(path.join(rootDir, "electron"), path.join(targetApp, "electron"), { recursive: true });
    console.log("  ✅ electron 主进程代码已同步");
  }

  console.log("✨ 客户端资源实时同步完成！在客户端按 Ctrl + R 即可体验最新效果。");
} catch (err) {
  console.error("同步至 desktop-build 失败:", err);
}
