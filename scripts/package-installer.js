import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const installerDir = path.join(rootDir, "installer-build");
const desktopBuildDir = path.join(rootDir, "desktop-build");
const appOutDir = path.join(desktopBuildDir, "MiMo-Audio-Workstation-win32-x64");

console.log("🚀 [1/3] 正在构建本地绿色运行环境与便携包...");
execSync("node scripts/package-win.js", { stdio: "inherit" });

console.log("\n📦 [2/3] 正在使用 electron-builder 构建 Windows Setup 安装包 (NSIS)...");
fs.mkdirSync(installerDir, { recursive: true });
execSync(`npx electron-builder --prepackaged "${appOutDir}" --win nsis`, { stdio: "inherit" });

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
const sourceInstaller = path.join(installerDir, `MiMo Audio Workstation Setup ${pkg.version}.exe`);
const targetInstaller = path.join(desktopBuildDir, `MiMo-Audio-Workstation-Setup-v${pkg.version}-win64.exe`);

console.log("\n✨ [3/3] 整理安装包产物...");
if (fs.existsSync(sourceInstaller)) {
  fs.copyFileSync(sourceInstaller, targetInstaller);
  console.log("\n🎉 Windows Setup 安装包构建成功！");
  console.log(`📍 安装包输出路径: ${targetInstaller}`);
  console.log(`📍 便携压缩包路径: ${path.join(desktopBuildDir, `MiMo-Audio-Workstation-v${pkg.version}-win64-portable.zip`)}`);
} else {
  console.log("\n🎉 electron-builder 构建完成，安装程序位于:", installerDir);
}
