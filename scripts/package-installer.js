import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { packageWindows } from "./package-win.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
try {
  const paths = packageWindows(rootDir);
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  console.log("📦 正在生成 NSIS 安装包...");
  execFileSync(process.execPath, [require.resolve("electron-builder/cli.js"), "--prepackaged", paths.appOutDir,
    "--win", "nsis", `--config.directories.output=${paths.installerDir}`], { cwd: rootDir, stdio: "inherit" });
  const sourceInstaller = path.join(paths.installerDir, `MiMo Audio Workstation Setup ${pkg.version}.exe`);
  if (!fs.existsSync(sourceInstaller) || !fs.statSync(sourceInstaller).size) throw new Error("没有找到本次构建的有效安装包");
  fs.copyFileSync(sourceInstaller, paths.installerPath, fs.constants.COPYFILE_EXCL);
  console.log(`✅ 安装包: ${paths.installerPath}`);
  console.log(`✅ 便携包: ${paths.zipPath}`);
} catch (error) {
  console.error("安装包构建失败，原客户端与历史安装包保持不变:", error);
  process.exitCode = 1;
}
