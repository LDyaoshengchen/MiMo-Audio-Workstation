import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";

const [version, directory, commit] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || "") || !/^[a-f0-9]{40}$/.test(commit || "")) throw new Error("Provide version, release directory and exact commit");
const files = [`MiMo-Audio-Workstation-Setup-v${version}-win64.exe`, `MiMo-Audio-Workstation-v${version}-win64-portable.zip`].map(name => path.resolve(directory, name));
for (const file of files) if (!fs.statSync(file).size) throw new Error("Empty release asset");
const credential = spawnSync("git", ["credential", "fill"], { input: "protocol=https\nhost=github.com\n\n", encoding: "utf8", windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" } });
const token = credential.stdout?.split(/\r?\n/).find(line => line.startsWith("password="))?.slice(9);
if (!token) throw new Error("GitHub credentials unavailable; sign in before publishing");
const base = "https://api.github.com/repos/LDyaoshengchen/MiMo-Audio-Workstation";
async function request(url, options = {}) {
  const temporary = options.body ? fs.mkdtempSync(path.join(os.tmpdir(), "mimo-release-request-")) : null;
  try {
    const args = ["-NoProfile", "-NonInteractive", "-File", path.resolve("scripts/github-request.ps1"), "-Uri", url, "-Method", options.method || "GET"];
    if (temporary) { const file = path.join(temporary, "body"); fs.writeFileSync(file, options.body); args.push("-BodyFile", file, "-ContentType", options.headers?.["Content-Type"] || "application/json"); }
    const result = spawnSync("powershell.exe", args, { encoding: "utf8", windowsHide: true, timeout: 910000, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, MIMO_RELEASE_TOKEN: token } });
    if (result.status !== 0) throw new Error(`GitHub request failed for ${new URL(url).pathname}: ${result.stdout?.match(/GITHUB_REQUEST_FAILED[^\r\n]*/)?.[0] || "no response"}`);
    return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
  } finally { if (temporary) fs.rmSync(temporary, { recursive: true, force: true }); }
}
const received = await request(`${base}/releases`);
const existing = Array.isArray(received) ? received : Array.isArray(received.value) ? received.value : [received];
const previous = existing.find(release => release.tag_name === `v${version}`);
if (process.argv.includes("--inspect")) { console.log(JSON.stringify(previous ? { tag: previous.tag_name, draft: previous.draft, target: previous.target_commitish, assets: previous.assets?.map(asset => ({ name: asset.name, size: asset.size, state: asset.state })) } : { exists: false })); process.exit(0); }
if (previous && (!previous.draft || previous.target_commitish !== commit)) throw new Error("Existing public/different release; refusing to overwrite assets");
const body = `Windows x64 installer and portable edition. Only Simplified Chinese and English Electron language packs.\n\n- Edge disconnect X follows the mouse along the actual curve, once per animation frame.\n- Fix hover/press position jumps and keep the disconnect button reliably clickable.\n- Workstation title and topbar settings start collapsed; expanded appearance cards scroll without clipping.\n- 248 automated tests passed, plus isolated desktop workflow checks.\n\nNo API keys or user workspaces are included. Built from ${commit}.`;
const release = previous || await request(`${base}/releases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag_name: `v${version}`, target_commitish: commit, name: `MiMo Audio Workstation v${version}`, body, draft: true, prerelease: false }) });
for (const file of files) {
  const buffer = fs.readFileSync(file), sha = createHash("sha256").update(buffer).digest("hex");
  const uploaded = release.assets?.find(asset => asset.name === path.basename(file));
  if (uploaded) { if (uploaded.size !== buffer.length || uploaded.digest !== `sha256:${sha}`) throw new Error("Existing asset digest differs; refusing to overwrite"); console.log(`Verified existing asset: ${uploaded.name}`); continue; }
  const asset = await request(release.upload_url.replace(/\{.*$/, "") + `?name=${encodeURIComponent(path.basename(file))}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: buffer });
  if (asset.size !== buffer.length || (asset.digest && asset.digest !== `sha256:${sha}`)) throw new Error("Uploaded asset integrity check failed");
  console.log(JSON.stringify({ name: asset.name, size: asset.size, sha256: sha, url: asset.browser_download_url }));
}
const published = await request(`${base}/releases/${release.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: false, make_latest: "true" }) });
const verified = await request(`${base}/releases/tags/v${version}`);
if (verified.draft || verified.assets.length !== 2) throw new Error("Public release verification failed");
console.log(JSON.stringify({ published: published.html_url, draft: verified.draft, assets: verified.assets.map(asset => ({ name: asset.name, size: asset.size })) }));
