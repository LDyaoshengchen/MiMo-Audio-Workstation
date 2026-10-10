// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { NodePaletteSettings } from "../src/components/NodePaletteSettings";
import { ThemePalettePreview } from "../src/components/ThemePalettePreview";
import { getReferenceNodeTones, nodePalettePresets, normalizeNodePalette } from "../src/studio/nodePalettes";
import { createThemeVariables, getThemeNodeColors, lightPresets, darkPresets, themeContrast } from "../src/studio/theme";

describe("independent node palette setting", () => {
  it("keeps theme previews compact with four labels and hover-only explanations", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () => root.render(<ThemePalettePreview colors={{ preset: "default", ...lightPresets.default }} preset={lightPresets.default} isLight />));
      expect(host.querySelectorAll(".theme-palette-chip")).toHaveLength(4);
      for (const label of ["背景", "卡片", "文字", "强调"]) expect(host.textContent).toContain(label);
      expect(host.querySelector("p")).toBeNull();
      expect(host.querySelector('[aria-label="浅色主题说明"]')?.getAttribute("title")).toBe(lightPresets.default.description);
      expect(host.querySelector('[aria-label="浅色主题说明"]')?.getAttribute("tabindex")).toBe("0");
    } finally { await act(async () => root.unmount()); }
  });
  it("retains Apple anchors while separating formerly duplicated families", () => {
    expect(getReferenceNodeTones("apple", false)).toMatchObject({ audio: "#0a84ff", clone: "#ff9f0a", style: "#bf5af2", artifact: "#9291ff" });
    expect(normalizeNodePalette(undefined)).toBe("apple");
    expect(normalizeNodePalette("__proto__")).toBe("apple");
    expect(nodePalettePresets.natural).toBeDefined();
    expect(Object.keys(nodePalettePresets).length).toBeGreaterThanOrEqual(10);
  });

  it("gives all palettes thirteen unique tones and separates unrelated color families", () => {
    const hue = (hex: string) => {
      const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
      const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
      return ((max===r ? (g-b)/d : max===g ? (b-r)/d+2 : (r-g)/d+4)*60+360)%360;
    };
    const difference=(a:string,b:string)=>{const d=Math.abs(hue(a)-hue(b));return Math.min(d,360-d);};
    const roles=["audio","merge","style","prompt","clone","design","artifact","integrated","game","batchClone","batchDesign","batchArtifact"];
    const family: Record<string,string> = { batchClone: "clone", batchDesign: "design", batchArtifact: "artifact" };
    for(const palette of Object.keys(nodePalettePresets)) for(const isLight of [true,false]){
      const tones=getReferenceNodeTones(palette,isLight);
      expect(new Set(Object.values(tones)).size,palette).toBe(13);
      for(let i=0;i<roles.length;i++) for(let j=i+1;j<roles.length;j++){
        if((family[roles[i]] || roles[i])===(family[roles[j]] || roles[j]))continue;
        expect(difference(tones[roles[i]],tones[roles[j]]),`${palette} ${isLight} ${roles[i]} / ${roles[j]}`).toBeGreaterThanOrEqual(25);
      }
      for(const [single,batch] of [["clone","batchClone"],["design","batchDesign"],["artifact","batchArtifact"]]){
        expect(difference(tones[single],tones[batch]),`${palette} ${single}`).toBeLessThan(15);
        expect(tones[single]).not.toBe(tones[batch]);
      }
    }
  });

  it("changes every node color without changing any interface theme variable", () => {
    for (const isLight of [true, false]) {
      const theme = { preset: "default", ...(isLight ? lightPresets.default : darkPresets.default) };
      const baseline = createThemeVariables(theme, isLight, "apple");
      for (const palette of Object.keys(nodePalettePresets)) {
        const tokens = createThemeVariables(theme, isLight, palette);
        for (const name of Object.keys(baseline).filter(name => !name.startsWith("--tone-"))) expect(tokens[name], palette + name).toBe(baseline[name]);
        const colors = getThemeNodeColors(theme, isLight, palette);
        expect(Object.keys(colors)).toHaveLength(13);
        for (const color of Object.values(colors)) expect(color).toMatch(/^#[\da-f]{6}$/i);
        for (const [key, ink] of Object.entries(tokens).filter(([key]) => /^--tone-.*-ink$/.test(key))) {
          expect(ink, palette + key).toBe(isLight ? "#ffffff" : "#000000");
          expect(themeContrast(ink, tokens[key.replace(/-ink$/, "-button")]), palette + key).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(getThemeNodeColors(theme, isLight, "monet")).not.toEqual(getThemeNodeColors(theme, isLight, "apple"));
    }
  });

  it("selects a complete palette and shows all thirteen preview colors", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const root = createRoot(host);
    const changed = vi.fn();
    function Harness() {
      const [palette, setPalette] = useState("apple");
      return <NodePaletteSettings palette={palette} isLight onChange={id => { changed(id); setPalette(id); }} />;
    }
    try {
      await act(async () => root.render(<Harness />));
      const select = host.querySelector("select")!;
      expect(select.value).toBe("apple");
      expect(host.querySelectorAll(".node-palette-chip")).toHaveLength(13);
      const before = host.querySelector<HTMLElement>(".node-palette-chip")!.style.backgroundColor;
      await act(async () => { select.value = "monet"; select.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(changed).toHaveBeenCalledWith("monet");
      expect(select.value).toBe("monet");
      expect(host.querySelector<HTMLElement>(".node-palette-chip")!.style.backgroundColor).not.toBe(before);
      expect(host.querySelector('[aria-label="节点配色说明"]')?.getAttribute("title")).toContain("不改变界面背景");
      expect(host.querySelectorAll(".theme-palette-sample")).toHaveLength(0);
      expect(host.querySelector(".node-palette-chip")?.getAttribute("title")).toContain("参考音频");
    } finally { await act(async () => root.unmount()); }
  });
});
