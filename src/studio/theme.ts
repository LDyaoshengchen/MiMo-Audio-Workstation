import { getReferenceNodeTones, normalizeNodePalette } from "./nodePalettes";
export interface ThemeColorSet {
  preset: string;
  bgColor: string;
  fgColor: string;
  accentColor: string;
  nodeColor?: string;
}

export interface ThemeConfig {
  mode: "dark" | "light" | "system";
  lightTheme: ThemeColorSet;
  darkTheme: ThemeColorSet;
  brandTitleZh?: string;
  brandTitleEn?: string;
  autoHideTopbar?: boolean;
  nodePalette?: string;
}

export interface ThemePreset {
  label: string;
  description: string;
  bgColor: string;
  fgColor: string;
  accentColor: string;
  nodeColor: string;
}

// Existing preset IDs remain valid; colors now use restrained, nature-inspired palettes.
export const lightPresets: Record<string, ThemePreset> = {
  default: { label: "雾白 · 自然灰蓝（默认）", description: "柔和灰白与石蓝，干净、耐看，适合长时间工作。", bgColor: "#f3f3ef", fgColor: "#283239", accentColor: "#496779", nodeColor: "#fcfcfa" },
  purewhite: { label: "纯白 · 黑字", description: "纯白背景与卡片、纯黑正文，搭配经典蓝色界面强调；节点配色独立设置。", bgColor: "#ffffff", fgColor: "#000000", accentColor: "#007aff", nodeColor: "#ffffff" },
  onelight: { label: "海雾 · 莫奈灰蓝", description: "海雾灰蓝搭配纸白，点缀少量暖赭与灰绿。", bgColor: "#eff3f4", fgColor: "#2e3c45", accentColor: "#4e6c83", nodeColor: "#fbfcfd" },
  moss: { label: "苔原 · 鼠尾草绿", description: "苔绿、浅石灰和自然白，低饱和而不灰暗。", bgColor: "#f1f3ee", fgColor: "#303c35", accentColor: "#4d6a58", nodeColor: "#fbfcf8" },
  solarized: { label: "暖砂 · 亚麻赭石", description: "亚麻纸白与赭石棕，温暖但不泛黄。", bgColor: "#f5f1ea", fgColor: "#3e3831", accentColor: "#876543", nodeColor: "#fcfaf6" },
  rose: { label: "陶粉 · 玫瑰石", description: "陶土、灰粉与米白，柔和而有分寸。", bgColor: "#f6f1f0", fgColor: "#493a3d", accentColor: "#88636d", nodeColor: "#fdfbfa" },
  catppuccin: { label: "灰紫 · 静物暮色", description: "灰紫与淡纸色，取代高亮紫色和荧光感。", bgColor: "#f3f1f5", fgColor: "#3b3745", accentColor: "#716580", nodeColor: "#fcfbfd" },
  liuli: { label: "琉璃 · 灰青琥珀", description: "建筑中的灰青与琥珀，保留色彩层次而不过分鲜艳。", bgColor: "#f0f3f1", fgColor: "#303b3b", accentColor: "#526f70", nodeColor: "#fafcfb" },
};

export const darkPresets: Record<string, ThemePreset> = {
  default: { label: "墨青 · 柔和深灰（默认）", description: "炭灰底色、雾白文字与灰青强调，避免纯黑与霓虹。", bgColor: "#202629", fgColor: "#e5e9e6", accentColor: "#8cabb5", nodeColor: "#2a3235" },
  onedark: { label: "暮蓝 · 海雾深色", description: "沉稳灰蓝配柔和浅蓝，深色也保留清晰层次。", bgColor: "#232830", fgColor: "#dfe6ed", accentColor: "#96aec1", nodeColor: "#2c333d" },
  moss: { label: "深苔 · 森林暮色", description: "森林灰绿与浅苔色，平静、自然。", bgColor: "#202720", fgColor: "#e3e8df", accentColor: "#9ab59a", nodeColor: "#2b352c" },
  solarized: { label: "夜砂 · 暖炭褐", description: "暖炭褐底色与亚麻色强调，不使用刺眼金黄。", bgColor: "#292722", fgColor: "#ede7dd", accentColor: "#c8b392", nodeColor: "#35332d" },
  rose: { label: "陶夜 · 玫瑰灰", description: "深陶灰与柔和玫瑰色，安静、有温度。", bgColor: "#2c2528", fgColor: "#f0e3e5", accentColor: "#c39a9e", nodeColor: "#382f32" },
  catppuccin: { label: "暮紫 · 灰调紫", description: "淡灰紫点缀深灰，保留静物画般的柔和感。", bgColor: "#282630", fgColor: "#e8e3f0", accentColor: "#b2a2c4", nodeColor: "#34303d" },
  liuli: { label: "青瓦 · 琉璃深色", description: "青瓦与灰青，点缀温和的赭石与松绿。", bgColor: "#202b2b", fgColor: "#e2ebe7", accentColor: "#94b7b4", nodeColor: "#2b3837" },
  // Legacy IDs are retained so saved settings do not lose their selection.
  dracula: { label: "烟紫 · 深色静物", description: "深烟紫与浅灰紫，克制的冷暖对比。", bgColor: "#292631", fgColor: "#e8e3f0", accentColor: "#b2a2c4", nodeColor: "#36323c" },
  monokai: { label: "橄榄 · 暖灰深色", description: "橄榄灰与亚麻绿，替代高饱和红色强调。", bgColor: "#292a23", fgColor: "#e6e7df", accentColor: "#a8b38b", nodeColor: "#34362c" },
  tokyonight: { label: "夜岚 · 石板蓝", description: "石板蓝与暮云色，平衡深色界面的冷暖。", bgColor: "#222831", fgColor: "#e1e7ef", accentColor: "#9eadc6", nodeColor: "#2b3440" },
};

export const LIGHT_NODE_TONES = getReferenceNodeTones("natural", true);
export const DARK_NODE_TONES = getReferenceNodeTones("natural", false);

const nodeRoles = { referenceAudio: "audio", audioMerge: "merge", voiceStyle: "style", prompt: "prompt", voiceClone: "clone", voiceDesign: "design", artifact: "artifact", batchVoiceClone: "batchClone", batchVoiceDesign: "batchDesign", batchArtifact: "batchArtifact", integratedStudio: "integrated", gameVocal: "game", comment: "comment" } as const;

export function getNodeTones(isLight: boolean, nodePalette = "natural"): Record<string, string> {
  return nodePalette === "natural" ? (isLight ? LIGHT_NODE_TONES : DARK_NODE_TONES) : getReferenceNodeTones(nodePalette, isLight);
}
export function getThemeNodeColors(colors: ThemeColorSet, isLight: boolean, nodePalette = "natural"): Record<string, string> {
  const tones = getNodeTones(isLight, nodePalette);
  return Object.fromEntries(Object.entries(nodeRoles).map(([type, role]) => [type, tones[role]]));
}

function rgb(hex: string): number[] { return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)); }
export function mixThemeColor(base: string, tint: string, amount: number): string {
  const other = rgb(tint);
  return "#" + rgb(base).map((value, index) => Math.round(value * (1 - amount) + other[index] * amount).toString(16).padStart(2, "0")).join("");
}
export function themeContrast(first: string, second: string): number {
  const luminance = (hex: string) => rgb(hex).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function readableThemeInk(background: string): string {
  const white = themeContrast(background, "#ffffff"), dark = themeContrast(background, "#182125");
  if (Math.max(white, dark) < 4.5) return "#000000";
  return white >= dark ? "#ffffff" : "#182125";
}

export function filledThemeColor(color: string, isLight: boolean): string {
  const ink = isLight ? "#ffffff" : "#000000";
  const target = isLight ? "#000000" : "#ffffff";
  for (let step = 0; step <= 40; step++) {
    const candidate = mixThemeColor(color, target, step / 40);
    if (themeContrast(candidate, ink) >= 4.5) return candidate;
  }
  return target;
}

export function createThemeVariables(colors: ThemeColorSet, isLight: boolean, nodePalette = "natural"): Record<string, string> {
  const surface = colors.nodeColor || (isLight ? "#fcfcfa" : "#2a3235");
  const tones = getNodeTones(isLight, nodePalette);
  const muted = mixThemeColor(surface, colors.fgColor, 0.85);
  const actionInk = isLight ? "#ffffff" : "#000000";
  const variables: Record<string, string> = {
    "--bg-main": colors.bgColor, "--text-main": colors.fgColor, "--accent-color": colors.accentColor,
    "--bg-node": surface, "--bg-panel": surface, "--bg-input": mixThemeColor(surface, colors.bgColor, 0.4),
    "--bg-button": mixThemeColor(surface, colors.fgColor, isLight ? 0.045 : 0.07),
    "--bg-button-hover": mixThemeColor(surface, colors.fgColor, isLight ? 0.09 : 0.12),
    "--text-muted": muted, "--border-color": mixThemeColor(surface, colors.fgColor, isLight ? 0.16 : 0.22),
    "--action-ink": actionInk, "--accent-ink": actionInk, "--accent-button": filledThemeColor(colors.accentColor, isLight), "--accent-soft": mixThemeColor(surface, colors.accentColor, isLight ? 0.11 : 0.14),
    "--canvas-grid": mixThemeColor(colors.bgColor, colors.fgColor, 0.15), "--canvas-mask": colors.bgColor + "cc",
    "--tone-danger": isLight ? "#a14f4c" : "#d8a49e", "--danger-soft": mixThemeColor(surface, isLight ? "#a14f4c" : "#d8a49e", 0.1),
    "--tone-danger-button": filledThemeColor(isLight ? "#a14f4c" : "#d8a49e", isLight),
    "--tone-danger-ink": actionInk,
    "--status-good": isLight ? "#507563" : "#a4c2af",
  };
  for (const [role, tone] of Object.entries(tones)) {
    variables[`--tone-${role}`] = tone;
    variables[`--tone-${role}-ink`] = actionInk;
    variables[`--tone-${role}-button`] = filledThemeColor(tone, isLight);
  }
  return variables;
}

export function applyThemeVariables(root: HTMLElement, colors: ThemeColorSet, isLight: boolean, nodePalette = "natural") {
  root.setAttribute("data-theme", isLight ? "light" : "dark");
  root.style.colorScheme = isLight ? "light" : "dark";
  for (const [name, value] of Object.entries(createThemeVariables(colors, isLight, nodePalette))) root.style.setProperty(name, value);
}

export function restoreThemeColors(saved: Partial<ThemeColorSet> | undefined, isLight: boolean): ThemeColorSet {
  const presets = isLight ? lightPresets : darkPresets;
  const preset = saved?.preset || "default";
  if (preset !== "custom" && presets[preset]) return { preset, ...presets[preset] };
  const fallback = presets.default;
  const valid = (value: string | undefined, otherwise: string) => value && /^#[\da-f]{6}$/i.test(value) ? value : otherwise;
  return { preset: "custom", bgColor: valid(saved?.bgColor, fallback.bgColor), fgColor: valid(saved?.fgColor, fallback.fgColor), accentColor: valid(saved?.accentColor, fallback.accentColor), nodeColor: valid(saved?.nodeColor, fallback.nodeColor) };
}

export function resolveSystemMode(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getInitialTheme(): ThemeConfig {
  const defaultLight = { preset: "default", ...lightPresets.default };
  const defaultDark = { preset: "default", ...darkPresets.default };

  try {
    const saved = localStorage.getItem("mimo_theme_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      // 彻底净化旧版残留标题，默认保持纯净留空
      if (!parsed.brandTitleZh || parsed.brandTitleZh.includes("铸光")) {
        parsed.brandTitleZh = "";
      }
      if (!parsed.brandTitleEn || parsed.brandTitleEn.includes("ZHUGUANG")) {
        parsed.brandTitleEn = "";
      }
      parsed.brandInitialized = true;
      parsed.nodePalette = normalizeNodePalette(parsed.nodePalette);
      try {
        localStorage.setItem("mimo_theme_settings", JSON.stringify(parsed));
      } catch { }

      if (parsed.lightTheme && parsed.darkTheme && parsed.mode) {
        return {
          ...parsed,
          lightTheme: restoreThemeColors(parsed.lightTheme, true),
          darkTheme: restoreThemeColors(parsed.darkTheme, false),
          brandTitleZh: parsed.brandTitleZh || "",
          brandTitleEn: parsed.brandTitleEn || "",
          autoHideTopbar: parsed.autoHideTopbar ?? true
        };
      }
      if (parsed.mode) {
        return {
          mode: parsed.mode,
          nodePalette: parsed.nodePalette,
          lightTheme: defaultLight,
          darkTheme: parsed.preset === "custom" || parsed.bgColor
            ? restoreThemeColors({ ...parsed, preset: "custom" }, false)
            : defaultDark,
          brandTitleZh: parsed.brandTitleZh || "",
          brandTitleEn: parsed.brandTitleEn || "",
          autoHideTopbar: parsed.autoHideTopbar ?? true
        };
      }
    }
  } catch { /* fallback */ }

  return {
    mode: "system",
    nodePalette: "apple",
    lightTheme: defaultLight,
    darkTheme: defaultDark,
    brandTitleZh: "",
    brandTitleEn: "",
    autoHideTopbar: true
  };
}
