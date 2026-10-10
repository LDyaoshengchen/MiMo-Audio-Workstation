// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyThemeVariables, createThemeVariables, darkPresets, getInitialTheme, getThemeNodeColors, lightPresets, readableThemeInk, restoreThemeColors, themeContrast } from "../src/studio/theme";

beforeEach(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, String(value)); },
    removeItem: (key: string) => { entries.delete(key); },
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() { return entries.size; },
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("natural theme palettes", () => {
  it("provides eight light palettes and keeps all legacy IDs", () => {
    expect(Object.keys(lightPresets)).toHaveLength(8);
    for (const id of ["default", "onelight", "solarized", "catppuccin"]) expect(lightPresets[id]).toBeDefined();
    for (const id of ["default", "catppuccin", "dracula", "monokai", "onedark", "tokyonight", "solarized"]) expect(darkPresets[id]).toBeDefined();
  });

  it("offers a persistent pure-white background/card with black body text independent of node colors", () => {
    const colors = restoreThemeColors({ preset: "purewhite" }, true);
    expect(colors).toMatchObject({ preset: "purewhite", bgColor: "#ffffff", nodeColor: "#ffffff", fgColor: "#000000" });
    const tokens = createThemeVariables(colors, true, "apple");
    expect(tokens["--bg-main"]).toBe("#ffffff");
    expect(tokens["--bg-node"]).toBe("#ffffff");
    expect(tokens["--text-main"]).toBe("#000000");
    expect(tokens["--tone-audio"]).toBe("#007aff");
    expect(createThemeVariables(colors, true, "monet")["--bg-node"]).toBe("#ffffff");
  });

  it("keeps main/muted text and filled-control labels readable in every preset", () => {
    for (const [isLight, presets] of [[true, lightPresets], [false, darkPresets]] as const) {
      for (const [preset, colors] of Object.entries(presets)) {
        const variables = createThemeVariables({ preset, ...colors }, isLight);
        expect(themeContrast(colors.fgColor, colors.bgColor), preset).toBeGreaterThanOrEqual(4.5);
        expect(themeContrast(variables["--text-muted"], colors.nodeColor), preset).toBeGreaterThanOrEqual(4.5);
        expect(themeContrast(variables["--accent-button"], variables["--accent-ink"]), preset).toBeGreaterThanOrEqual(4.5);
        expect(themeContrast(variables["--tone-game-button"], variables["--tone-game-ink"]), preset + " game generation button").toBeGreaterThanOrEqual(4.5);
        expect(variables["--tone-game-ink"]).toBe(isLight ? "#ffffff" : "#000000");
        for (const [key, value] of Object.entries(variables)) {
          if (/^--tone-.*-ink$/.test(key)) expect(themeContrast(value, variables[key.replace(/-ink$/, "-button")]), preset + key).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    expect(themeContrast("#777777", readableThemeInk("#777777"))).toBeGreaterThanOrEqual(4.5);
  });

  it("migrates saved built-in colors and preserves explicit custom colors", () => {
    expect(restoreThemeColors({ preset: "onelight", accentColor: "#4078f2" }, true)).toMatchObject({ preset: "onelight", accentColor: lightPresets.onelight.accentColor });
    const custom = { preset: "custom", bgColor: "#abcdef", fgColor: "#123456", accentColor: "#456789", nodeColor: "#fedcba" };
    expect(restoreThemeColors(custom, true)).toEqual(custom);
    expect(restoreThemeColors({ ...custom, bgColor: "not-a-color" }, true).bgColor).toBe(lightPresets.default.bgColor);
  });

  it("applies coordinated surfaces and native control color scheme", () => {
    const root = document.createElement("div");
    applyThemeVariables(root, { preset: "moss", ...darkPresets.moss }, false);
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(root.style.getPropertyValue("--bg-panel")).toBe(darkPresets.moss.nodeColor);
    expect(root.style.getPropertyValue("--tone-audio")).toBe(getThemeNodeColors({ preset: "moss", ...darkPresets.moss }, false).referenceAudio);
    expect(root.style.getPropertyValue("--tone-audio-ink")).toBeDefined();
    applyThemeVariables(root, { preset: "rose", ...lightPresets.rose }, true);
    expect(root.dataset.theme).toBe("light");
    expect(root.style.getPropertyValue("--accent-color")).toBe(lightPresets.rose.accentColor);
  });

  it("shares colors between node categories and canvas edges/minimap", () => {
    const colors = { preset: "moss", ...lightPresets.moss };
    const map = getThemeNodeColors(colors, true);
    const variables = createThemeVariables(colors, true);
    expect(Object.keys(map)).toHaveLength(13);
    expect(map.referenceAudio).toBe(variables["--tone-audio"]);
    expect(map.integratedStudio).toBe(variables["--tone-integrated"]);
    expect(new Set(Object.values(map)).size).toBe(13);
    expect(map.voiceClone).toBe(variables["--tone-clone"]);
    expect(map.batchArtifact).toBe(variables["--tone-batchArtifact"]);
  });

  it("restores both presets without overwriting custom preferences", () => {
    localStorage.setItem("mimo_theme_settings", JSON.stringify({ mode: "light", autoHideTopbar: false,
      lightTheme: { preset: "onelight", bgColor: "#fafafa", fgColor: "#383a42", accentColor: "#4078f2" },
      darkTheme: { preset: "custom", bgColor: "#222222", fgColor: "#eeeeee", accentColor: "#aabbcc", nodeColor: "#333333" },
    }));
    const theme = getInitialTheme();
    expect(theme.lightTheme.accentColor).toBe(lightPresets.onelight.accentColor);
    expect(theme.darkTheme.accentColor).toBe("#aabbcc");
    expect(theme.autoHideTopbar).toBe(false);
    expect(theme.nodePalette).toBe("apple");
    localStorage.setItem("mimo_theme_settings", JSON.stringify({ ...theme, nodePalette: "monet" }));
    expect(getInitialTheme().nodePalette).toBe("monet");
  });
});
