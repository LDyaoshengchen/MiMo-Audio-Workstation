import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "desktop-build");
const appOutDir = path.join(outputDir, "MiMo-Audio-Workstation-win32-x64");
const electronDistDir = path.join(rootDir, "node_modules", "electron", "dist");

console.log("🚀 正在编译前端与服务端代码...");
execSync("npm run build", { stdio: "inherit" });

console.log("🧹 清理旧打包目录...");
try {
  execSync("taskkill /F /IM MiMo-Audio-Workstation.exe /T", { stdio: "ignore" });
} catch {}

function safeRmDir(dir) {
  for (let i = 0; i < 5; i++) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      return;
    } catch {
      execSync("node -e \"setTimeout(() => {}, 400)\"");
    }
  }
}

safeRmDir(appOutDir);
fs.mkdirSync(appOutDir, { recursive: true });

console.log("📦 正在复制 Electron 运行环境...");
fs.cpSync(electronDistDir, appOutDir, { recursive: true });

// 重命名 electron.exe -> MiMo-Audio-Workstation.exe
const defaultExe = path.join(appOutDir, "electron.exe");
const targetExe = path.join(appOutDir, "MiMo-Audio-Workstation.exe");
if (fs.existsSync(defaultExe)) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (fs.existsSync(targetExe)) {
        fs.rmSync(targetExe, { force: true });
      }
      fs.renameSync(defaultExe, targetExe);
      break;
    } catch (err) {
      if (attempt === 9) throw err;
      execSync("node -e \"setTimeout(() => {}, 500)\"");
    }
  }
}

console.log("📁 正在打包应用资产...");
const resourcesDir = path.join(appOutDir, "resources");
const appDir = path.join(resourcesDir, "app");
const serverTargetDir = path.join(resourcesDir, "server");
const distTargetDir = path.join(resourcesDir, "dist");

fs.mkdirSync(appDir, { recursive: true });

// 复制 package.json 与 electron/ main.cjs
fs.copyFileSync(path.join(rootDir, "package.json"), path.join(appDir, "package.json"));
fs.mkdirSync(path.join(appDir, "electron"), { recursive: true });
fs.copyFileSync(path.join(rootDir, "electron", "main.cjs"), path.join(appDir, "electron", "main.cjs"));

// 复制 build/server -> resources/server
fs.cpSync(path.join(rootDir, "build", "server"), serverTargetDir, { recursive: true });

// 复制 dist -> resources/dist
fs.cpSync(path.join(rootDir, "dist"), distTargetDir, { recursive: true });

console.log("✨ 本地绿色客户端打包完成！");
console.log(`📍 目录绝对路径: ${appOutDir}`);
console.log(`📍 可执行文件绝对路径: ${targetExe}`);

// 自动生成免解压/便携 ZIP 包
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
const zipName = `MiMo-Audio-Workstation-v${pkg.version}-win64-portable.zip`;
const zipPath = path.join(outputDir, zipName);

console.log("\n🗜️  正在生成免解压便携 ZIP 压缩包...");
for (let i = 0; i < 5; i++) {
  try {
    if (fs.existsSync(zipPath)) {
      fs.rmSync(zipPath, { force: true });
    }
    break;
  } catch {
    execSync("node -e \"setTimeout(() => {}, 500)\"");
  }
}

try {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${appOutDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: "inherit" });
  console.log(`🎁 免解压便携包打包成功！`);
  console.log(`📍 ZIP 绝对路径: ${zipPath}`);
} catch (err) {
  console.error("⚠️ 生成 ZIP 包失败:", err.message);
}

