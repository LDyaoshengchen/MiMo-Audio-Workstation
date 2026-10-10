// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { DownloadNamingSettings } from "../src/components/DownloadNamingSettings";
import { SingleArtifactDownloadLink } from "../src/components/SingleArtifactDownloadLink";
import { useDownloadSettings } from "../src/utils/useDownloadSettings";
import { formatHierarchyName } from "../src/utils/audioNaming";

function DownloadHarness({ nodeName = "全能综合工作台", rowName = "VO_00085" }) {
  const [settings, setSettings] = useDownloadSettings();
  const title = formatHierarchyName(nodeName, rowName, 1);
  return <>
    <DownloadNamingSettings settings={settings} onChange={setSettings} workspaceName="怪物" />
    {["single", "batch", "integrated"].map(context => <div key={context} data-context={context}>
      <SingleArtifactDownloadLink title={title} fileName="cache.wav" audioDataUrl="/api/audio-cache/cache.wav" workspaceName="怪物" createdAt="2026-10-08T17:00:02" settings={settings} />
    </div>)}
  </>;
}

describe("download switches → actual rendered download buttons → persisted preferences", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("localStorage", new JSDOM("", { url: "http://127.0.0.1" }).window.localStorage);
    localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.unstubAllGlobals(); });
  const names = () => Array.from(container.querySelectorAll("a[download]")).map(link => link.getAttribute("download"));
  async function toggle(label: string) {
    await act(async () => (container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click());
  }
  it("updates all three rendered entry points, keeps explicit node prefixes, and restores on remount", async () => {
    await act(async () => root.render(<DownloadHarness />));
    expect(names()).toEqual(Array(3).fill("怪物_VO_00085_01.wav"));
    await toggle("带画板名称");
    expect(names()).toEqual(Array(3).fill("VO_00085_01.wav"));
    await toggle("带时间");
    expect(names()).toEqual(Array(3).fill("VO_00085_01_2026-10-08_17-00-02.wav"));
    await act(async () => root.render(<DownloadHarness nodeName="战斗" />));
    expect(names()).toEqual(Array(3).fill("战斗_VO_00085_01_2026-10-08_17-00-02.wav"));
    const link = container.querySelector("a[download]")!;
    let clickedName = "";
    link.addEventListener("click", event => { event.preventDefault(); clickedName = link.getAttribute("download")!; });
    await act(async () => (link as HTMLAnchorElement).click());
    expect(clickedName).toBe(names()[0]);
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(<DownloadHarness nodeName="战斗" />));
    expect(names()).toEqual(Array(3).fill(clickedName));
    expect(container.querySelector('[aria-label="带时间"]')?.getAttribute("aria-checked")).toBe("true");
  });
});
