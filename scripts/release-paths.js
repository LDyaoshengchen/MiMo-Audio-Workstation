import fs from "node:fs";
import path from "node:path";

// Each release preserves running clients and earlier archives.
export function createReleasePaths(rootDir, version) {
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(version)) throw new Error("非法版本名称");
  const root = fs.realpathSync(rootDir);
  const output = path.join(root, "desktop-build");
  fs.mkdirSync(output, { recursive: true });
  if (fs.realpathSync(output).toLowerCase() !== output.toLowerCase()) {
    throw new Error("发布目录不能是指向其他位置的链接");
  }
  const releaseDir = fs.mkdtempSync(path.join(output, `release-v${version}-`));
  return {
    releaseDir,
    appOutDir: path.join(releaseDir, "MiMo-Audio-Workstation-win32-x64"),
    zipPath: path.join(releaseDir, `MiMo-Audio-Workstation-v${version}-win64-portable.zip`),
    installerDir: path.join(releaseDir, "installer-build"),
    installerPath: path.join(releaseDir, `MiMo-Audio-Workstation-Setup-v${version}-win64.exe`),
  };
}
