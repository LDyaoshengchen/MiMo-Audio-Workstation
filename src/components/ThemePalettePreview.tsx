import { createThemeVariables, type ThemeColorSet, type ThemePreset } from "../studio/theme";
import { Info } from "lucide-react";

export function ThemePalettePreview({ colors, preset, isLight }: { colors: ThemeColorSet; preset?: ThemePreset; isLight: boolean }) {
  const tokens = createThemeVariables(colors, isLight);
  const samples = [
    ["背景", tokens["--bg-main"]], ["卡片", tokens["--bg-node"]], ["文字", tokens["--text-main"]],
    ["强调", tokens["--accent-color"]],
  ];
  return <div className="theme-palette-preview" aria-label={`${isLight ? "浅色" : "深色"}配色预览`}>
    <span className="theme-preview-caption">预览</span>
    <div className="theme-palette-swatches">{samples.map(([label, color]) => <div key={label} className="theme-palette-sample">
      <span className="theme-palette-chip" style={{ backgroundColor: color }} title={`${label} ${color}`} aria-hidden="true" />
      <span>{label}</span>
    </div>)}</div>
    <span className="node-palette-help" tabIndex={0} aria-label={`${isLight ? "浅色" : "深色"}主题说明`} title={preset?.description || "自定义背景、卡片、文字和强调色；节点配色由独立设置控制。"}><Info size={14} /></span>
  </div>;
}
