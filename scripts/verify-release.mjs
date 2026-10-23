import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [directory, version, installerPayload] = process.argv.slice(2);
if (!directory || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version || "")) throw new Error("Provide release directory and version");
const releaseDir = await fs.realpath(path.resolve(directory));
if (path.dirname(releaseDir) !== path.join(root, "desktop-build") || !path.basename(releaseDir).startsWith(`release-v${version}-`)) throw new Error("Expected an independent versioned release directory");
const hash = buffer => createHash("sha256").update(buffer).digest("hex");
const portableName = `MiMo-Audio-Workstation-v${version}-win64-portable.zip`;
const installerName = `MiMo-Audio-Workstation-Setup-v${version}-win64.exe`;
const portable = await fs.readFile(path.join(releaseDir, portableName));
const installer = await fs.readFile(path.join(releaseDir, installerName));
if (portable.length < 1e6 || installer.length < 1e6) throw new Error("Missing/empty release asset");
const zip = await JSZip.loadAsync(portable, { checkCRC32: true });
// Windows ZipFile emits backslashes; inspect normalized paths on every platform.
const entries = new Map(Object.entries(zip.files).map(([name, entry]) => [name.replace(/\\/g, "/"), entry]));
const names = [...entries.keys()];
if (names.some(name => name.startsWith("/") || name.split("/").includes(".."))) throw new Error("Unsafe archive path");
const privateNames = names.filter(name => /(^|\/)(?:\.env(?:\.[^/]*)?|data|workspaces?|role-voice-library)(?:\/|$)|(^|\/)(?:settings|workspaces|templates|voice-library)\.json$/i.test(name));
if (privateNames.length) throw new Error(`Private data in package: ${privateNames.join(", ")}`);
const app = path.join(releaseDir, "MiMo-Audio-Workstation-win32-x64");
const metadata = JSON.parse(await entries.get("resources/app/package.json").async("string"));
const sourceMetadata = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
if (metadata.appVersion !== version || metadata.version !== sourceMetadata.version || lock.version !== metadata.version || lock.packages[""].version !== metadata.version) throw new Error("Package/lock/version mismatch");
const localeFiles = names.filter(name => /^locales\/[^/]+\.pak$/.test(name)).sort();
if (JSON.stringify(localeFiles) !== JSON.stringify(["locales/en-US.pak", "locales/zh-CN.pak"])) throw new Error("Unexpected locales");
let verifiedResources = 0;
for (const name of names.filter(name => !entries.get(name).dir && /^(resources\/app\/(?:electron\/|package\.json$)|resources\/(?:dist|server)\/)/.test(name))) {
  const bytes = await entries.get(name).async("nodebuffer");
  if (hash(bytes) !== hash(await fs.readFile(path.join(app, name)))) throw new Error(`Portable content mismatch: ${name}`);
  let source;
  if (name.startsWith("resources/app/electron/")) source = path.join(root, "electron", name.slice("resources/app/electron/".length));
  else if (name === "resources/app/package.json") source = path.join(root, "package.json");
  else if (name.startsWith("resources/dist/")) source = path.join(root, "dist", name.slice("resources/dist/".length));
  else if (name.startsWith("resources/server/")) source = path.join(root, "build/server", name.slice("resources/server/".length));
  if (source && hash(bytes) !== hash(await fs.readFile(source))) throw new Error(`Built source mismatch: ${name}`);
  verifiedResources++;
}
const secrets = [];
try {
  for (const line of (await fs.readFile(path.join(root, ".env"), "utf8")).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/i);
    const value = match?.[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value && value.length >= 16 && !/your[_-]|placeholder|example|changeme/i.test(value)) secrets.push(value);
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
const tracked = execFileSync("git", ["ls-files", "--cached", "--modified", "--others", "--exclude-standard", "-z"], { cwd: root }).toString().split("\0").filter(name => name && /\.(?:tsx?|[cm]?js|json|ya?ml|md|ps1|html|css)$/.test(name));
const files = new Set(tracked.map(name => path.join(root, name)));
for (const name of names.filter(name => !entries.get(name).dir && /\.(?:[cm]?js|json|html|css)$/.test(name))) files.add(path.join(app, name));
for (const file of files) {
  const contents = await fs.readFile(file, "utf8");
  if (secrets.some(secret => contents.includes(secret)) || /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9_-]{32,})/.test(contents)) throw new Error(`Possible credential exposure in ${path.relative(root, file)} (value redacted)`);
}
const result = { version, packageVersion: metadata.version, portableCRC: "passed", privateFiles: privateNames.length, credentialScan: "passed", verifiedResources, locales: localeFiles,
  assets: [{ name: installerName, size: installer.length, sha256: hash(installer) }, { name: portableName, size: portable.length, sha256: hash(portable) }] };
if (installerPayload) {
  const payload = await fs.realpath(path.resolve(installerPayload));
  if (!payload.startsWith(releaseDir + path.sep)) throw new Error("Installer validation must stay in the release directory");
  const archive = path.join(releaseDir, "validation", "nsis", "$PLUGINSDIR", "app-64.7z");
  const listing = execFileSync(path.join(root, "node_modules/electron-winstaller/vendor/7z.exe"), ["l", "-slt", archive], { windowsHide: true }).toString();
  const paths = [...listing.matchAll(/^Path = (.+)$/gm)].slice(1).map(match => match[1].trim().replace(/\\/g, "/"));
  if (paths.some(name => /(^|\/)(?:\.env(?:\.[^/]*)?|data|workspaces?|role-voice-library)(?:\/|$)|(^|\/)(?:settings|workspaces|templates|voice-library)\.json$/i.test(name))) throw new Error("Private data in installer payload");
  for (const name of ["resources/app/package.json", "resources/server/index.cjs", "resources/dist/index.html"]) {
    if (hash(await fs.readFile(path.join(payload, name))) !== hash(await fs.readFile(path.join(app, name)))) throw new Error(`Installer resource mismatch: ${name}`);
  }
  result.installerPayload = "passed";
  result.installerEntries = paths.length;
}
await fs.writeFile(path.join(releaseDir, "verification.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify(result));
