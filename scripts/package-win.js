import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createReleasePaths } from "./release-paths.js";

export function packageWindows(rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const electronDistDir = path.join(rootDir, "node_modules", "electron", "dist");
  if (!fs.existsSync(path.join(electronDistDir, "electron.exe"))) throw new Error("Electron 运行时缺失，请先安装依赖");
  console.log("🚀 正在编译代码（不修改现有客户端）...");
  const npmCli = process.env.npm_execpath;
  const options = { cwd: rootDir, stdio: "inherit", env: { ...process.env, MIMO_SKIP_DESKTOP_SYNC: "1" } };
  if (npmCli) execFileSync(process.execPath, [npmCli, "run", "build"], options);
  else if (process.platform === "win32") execFileSync("cmd.exe", ["/d", "/c", "npm run build"], options);
  else execFileSync("npm", ["run", "build"], options);
  const paths = createReleasePaths(rootDir, pkg.version);
  console.log(`📦 独立发布目录: ${paths.releaseDir}`);
  fs.cpSync(electronDistDir, paths.appOutDir, { recursive: true });
  fs.renameSync(path.join(paths.appOutDir, "electron.exe"), path.join(paths.appOutDir, "MiMo-Audio-Workstation.exe"));
  const resourcesDir = path.join(paths.appOutDir, "resources");
  const appDir = path.join(resourcesDir, "app");
  fs.mkdirSync(appDir, { recursive: true });
  fs.copyFileSync(path.join(rootDir, "package.json"), path.join(appDir, "package.json"));
  fs.cpSync(path.join(rootDir, "electron"), path.join(appDir, "electron"), { recursive: true });
  fs.cpSync(path.join(rootDir, "build", "server"), path.join(resourcesDir, "server"), { recursive: true });
  fs.cpSync(path.join(rootDir, "dist"), path.join(resourcesDir, "dist"), { recursive: true });
  // Deliberately exclude .env, saved credentials, and user workspaces.
  console.log("🗜️ 正在生成便携 ZIP...");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:MIMO_RELEASE_APP, $env:MIMO_RELEASE_ZIP)"],
    { cwd: rootDir, stdio: "inherit", env: { ...process.env, MIMO_RELEASE_APP: paths.appOutDir, MIMO_RELEASE_ZIP: paths.zipPath } });
  if (!fs.statSync(paths.zipPath).size) throw new Error("便携 ZIP 为空");
  console.log(`✅ 便携包: ${paths.zipPath}`);
  return paths;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { packageWindows(); }
  catch (error) { console.error("打包失败，原客户端与历史发布包保持不变:", error); process.exitCode = 1; }
}

