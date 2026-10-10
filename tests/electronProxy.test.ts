import { expect, it } from "vitest";
import http from "node:http";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

it("Electron downloader initializes its overridden proxy dependency and routes through a local proxy", async () => {
  const require = createRequire(import.meta.url);
  const builderRequire = createRequire(require.resolve("app-builder-lib"));
  const downloader = builderRequire.resolve("@electron/get");
  const downloaderRequire = createRequire(downloader);
  expect(downloaderRequire("global-agent/package.json").version).toMatch(/^4\./);
  const urls: string[] = [];
  const server = http.createServer((req, res) => { urls.push(req.url ?? ""); res.end("proxy-ok"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(global_agent_|https?_proxy|no_proxy|electron_get_use_proxy)/i.test(key)) delete env[key];
    env.GLOBAL_AGENT_HTTP_PROXY = `http://127.0.0.1:${port}`;
    const script = `require(${JSON.stringify(downloader)}).initializeProxy();
      require('node:http').get('http://127.0.0.1:9/proxy-test', r => {
        let body=''; r.on('data', chunk => body+=chunk); r.on('end', () => process.stdout.write(body));
      }).on('error', e => { console.error(e.message); process.exitCode=1; });`;
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", script], { env, windowsHide: true });
      let result = "", errors = "";
      const timeout = setTimeout(() => { child.kill(); reject(new Error("local proxy test timed out")); }, 8000);
      child.stdout.on("data", chunk => result += chunk);
      child.stderr.on("data", chunk => errors += chunk);
      child.on("error", error => { clearTimeout(timeout); reject(error); });
      child.on("close", code => { clearTimeout(timeout); code === 0 ? resolve(result) : reject(new Error(errors)); });
    });
    expect(output).toBe("proxy-ok");
    expect(urls).toEqual(["http://127.0.0.1:9/proxy-test"]);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 15000);
