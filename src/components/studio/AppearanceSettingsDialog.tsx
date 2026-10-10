import type { Dispatch, SetStateAction } from "react";
import type { ThemeConfig } from "../../studio/theme";
import { Palette, X, Monitor, Sun, Moon, RotateCcw, ChevronDown } from "lucide-react";
import { lightPresets, darkPresets } from "../../studio/theme";
import { ThemePalettePreview } from "../ThemePalettePreview";
import { NodePaletteSettings } from "../NodePaletteSettings";

export interface AppearanceSettingsDialogProps {
  showAppearanceModal: boolean;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (e: React.MouseEvent<HTMLDivElement>, onClose: () => void) => void;
  setShowAppearanceModal: Dispatch<SetStateAction<boolean>>;
  themeConfig: ThemeConfig;
  isLight: boolean;
  updateNodePalette: (id: string) => void;
  updateBrandTitle: (field: "brandTitleZh" | "brandTitleEn", val: string) => void;
  updateAutoHideTopbar: (val: boolean) => void;
  updateMode: (mode: ThemeConfig["mode"]) => void;
  resetLightPreset: () => void;
  updateLightThemePreset: (preset: string) => void;
  setShowLightCustomColors: Dispatch<SetStateAction<boolean>>;
  showLightCustomColors: boolean;
  updateLightColor: (field: "bgColor" | "fgColor" | "accentColor" | "nodeColor", val: string) => void;
  resetDarkPreset: () => void;
  updateDarkThemePreset: (preset: string) => void;
  setShowDarkCustomColors: Dispatch<SetStateAction<boolean>>;
  showDarkCustomColors: boolean;
  updateDarkColor: (field: "bgColor" | "fgColor" | "accentColor" | "nodeColor", val: string) => void;
  resetTheme: () => void;
}

export function AppearanceSettingsDialog({
  showAppearanceModal,
  handleBackdropMouseDown,
  handleBackdropClick,
  setShowAppearanceModal,
  themeConfig,
  isLight,
  updateNodePalette,
  updateBrandTitle,
  updateAutoHideTopbar,
  updateMode,
  resetLightPreset,
  updateLightThemePreset,
  setShowLightCustomColors,
  showLightCustomColors,
  updateLightColor,
  resetDarkPreset,
  updateDarkThemePreset,
  setShowDarkCustomColors,
  showDarkCustomColors,
  updateDarkColor,
  resetTheme,
}: AppearanceSettingsDialogProps) {
  return (<>{showAppearanceModal && (
    <div
      className="api-key-modal"
      onMouseDown={handleBackdropMouseDown}
      onClick={(e) => handleBackdropClick(e, () => setShowAppearanceModal(false))}
    >
      <div className="appearance-modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3><Palette size={18} /> 外观与主题</h3>
          <button className="api-key-modal-close" type="button" onClick={() => setShowAppearanceModal(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="appearance-modal-content">
          {/* 工作站名称标识设置 (两列：英文与中文) */}
          <div className="appearance-group">
            <div className="appearance-group-heading">工作站名称与标识设置</div>
            <div className="appearance-card">
              <div className="appearance-item-row-cols">
                <div className="appearance-col">
                  <span className="appearance-item-label">中文主标题</span>
                  <input
                    type="text"
                    className="appearance-text-input"
                    value={themeConfig.brandTitleZh || ""}
                    onChange={(e) => updateBrandTitle("brandTitleZh", e.target.value)}
                    placeholder="留空或输入工作站名称"
                  />
                </div>
                <div className="appearance-col">
                  <span className="appearance-item-label">英文副标题</span>
                  <input
                    type="text"
                    className="appearance-text-input"
                    value={themeConfig.brandTitleEn || ""}
                    onChange={(e) => updateBrandTitle("brandTitleEn", e.target.value)}
                    placeholder="留空或输入英文标识"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 顶部标题栏自动隐藏开关 */}
          <div
            className="appearance-card"
            style={{ cursor: "pointer" }}
            onClick={() => updateAutoHideTopbar(!(themeConfig.autoHideTopbar ?? true))}
          >
            <div className="appearance-card-main">
              <div>
                <div className="appearance-card-title">顶部标题栏自动隐藏</div>
                <div className="appearance-card-sub">开启后鼠标移开时自动收起顶部栏，移至窗口顶部即可重新展开。</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={themeConfig.autoHideTopbar ?? true}
                className={`capsule-switch ${themeConfig.autoHideTopbar ?? true ? "checked" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateAutoHideTopbar(!(themeConfig.autoHideTopbar ?? true));
                }}
                style={{ border: "none", outline: "none", cursor: "pointer" }}
                title={themeConfig.autoHideTopbar ?? true ? "已开启自动隐藏（点击切换为常驻显示）" : "已关闭自动隐藏（点击开启）"}
              >
                <span className="capsule-switch-thumb" />
              </button>
            </div>
          </div>

          {/* Appearance Mode Card */}
          <div className="appearance-card">
            <div className="appearance-card-main">
              <div>
                <div className="appearance-card-title">外观模式</div>
                <div className="appearance-card-sub">选择浅色模式、深色模式或跟随系统设置。</div>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={themeConfig.mode === "system" ? "active" : ""}
                  onClick={() => updateMode("system")}
                  title="跟随系统"
                >
                  <Monitor size={15} />
                </button>
                <button
                  type="button"
                  className={themeConfig.mode === "light" ? "active" : ""}
                  onClick={() => updateMode("light")}
                  title="浅色模式"
                >
                  <Sun size={15} />
                </button>
                <button
                  type="button"
                  className={themeConfig.mode === "dark" ? "active" : ""}
                  onClick={() => updateMode("dark")}
                  title="深色模式"
                >
                  <Moon size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Light Theme Group */}
          <NodePaletteSettings palette={themeConfig.nodePalette} isLight={isLight} onChange={updateNodePalette} />

          <div className="appearance-group appearance-theme-group">
            <div className="appearance-group-heading">浅色主题</div>
            <div className="appearance-card">
              <div className="appearance-item-row theme-preset-row">
                <span className="appearance-item-label">方案</span>
                <div className="appearance-item-controls">
                  <button
                    type="button"
                    className="appearance-icon-btn"
                    onClick={resetLightPreset}
                    title="重置为默认预设"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <select
                    className="appearance-select-control"
                    aria-label="浅色主题预设"
                    value={themeConfig.lightTheme.preset}
                    onChange={(e) => {
                      const nextPreset = e.target.value;
                      updateLightThemePreset(nextPreset);
                      if (nextPreset === "custom") {
                        setShowLightCustomColors(true);
                      }
                    }}
                  >
                    {Object.entries(lightPresets).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </div>

              <ThemePalettePreview colors={themeConfig.lightTheme} preset={lightPresets[themeConfig.lightTheme.preset]} isLight />
              <button
                type="button"
                className="appearance-collapse-toggle-btn"
                onClick={() => setShowLightCustomColors((v) => !v)}
                aria-expanded={showLightCustomColors}
              >
                <span>自定义颜色</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: showLightCustomColors ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease"
                  }}
                />
              </button>

              {showLightCustomColors && (
                <div className="appearance-custom-colors-wrap">
                  <div className="appearance-item-row">
                    <span className="appearance-item-label">背景颜色</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.lightTheme.bgColor}
                        onChange={(e) => updateLightColor("bgColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.lightTheme.bgColor}
                        onChange={(e) => updateLightColor("bgColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>

                  <div className="appearance-item-row">
                    <span className="appearance-item-label">前景文字</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.lightTheme.fgColor}
                        onChange={(e) => updateLightColor("fgColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.lightTheme.fgColor}
                        onChange={(e) => updateLightColor("fgColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>

                  <div className="appearance-item-row">
                    <span className="appearance-item-label">强调主色</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.lightTheme.accentColor}
                        onChange={(e) => updateLightColor("accentColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.lightTheme.accentColor}
                        onChange={(e) => updateLightColor("accentColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>

                  <div className="appearance-item-row">
                    <span className="appearance-item-label">节点背景颜色</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.lightTheme.nodeColor || "#ffffff"}
                        onChange={(e) => updateLightColor("nodeColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.lightTheme.nodeColor || "#ffffff"}
                        onChange={(e) => updateLightColor("nodeColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dark Theme Group */}
          <div className="appearance-group appearance-theme-group">
            <div className="appearance-group-heading">深色主题</div>
            <div className="appearance-card">
              <div className="appearance-item-row theme-preset-row">
                <span className="appearance-item-label">方案</span>
                <div className="appearance-item-controls">
                  <button
                    type="button"
                    className="appearance-icon-btn"
                    onClick={resetDarkPreset}
                    title="重置为默认预设"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <select
                    className="appearance-select-control"
                    aria-label="深色主题预设"
                    value={themeConfig.darkTheme.preset}
                    onChange={(e) => {
                      const nextPreset = e.target.value;
                      updateDarkThemePreset(nextPreset);
                      if (nextPreset === "custom") {
                        setShowDarkCustomColors(true);
                      }
                    }}
                  >
                    {Object.entries(darkPresets).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </div>

              <ThemePalettePreview colors={themeConfig.darkTheme} preset={darkPresets[themeConfig.darkTheme.preset]} isLight={false} />
              <button
                type="button"
                className="appearance-collapse-toggle-btn"
                onClick={() => setShowDarkCustomColors((v) => !v)}
                aria-expanded={showDarkCustomColors}
              >
                <span>自定义颜色</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: showDarkCustomColors ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease"
                  }}
                />
              </button>

              {showDarkCustomColors && (
                <div className="appearance-custom-colors-wrap">
                  <div className="appearance-item-row">
                    <span className="appearance-item-label">背景颜色</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.darkTheme.bgColor}
                        onChange={(e) => updateDarkColor("bgColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.darkTheme.bgColor}
                        onChange={(e) => updateDarkColor("bgColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>

                  <div className="appearance-item-row">
                    <span className="appearance-item-label">前景文字</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.darkTheme.fgColor}
                        onChange={(e) => updateDarkColor("fgColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.darkTheme.fgColor}
                        onChange={(e) => updateDarkColor("fgColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>

                  <div className="appearance-item-row">
                    <span className="appearance-item-label">强调主色</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.darkTheme.accentColor}
                        onChange={(e) => updateDarkColor("accentColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.darkTheme.accentColor}
                        onChange={(e) => updateDarkColor("accentColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>

                  <div className="appearance-item-row">
                    <span className="appearance-item-label">节点背景颜色</span>
                    <div className="color-picker-box">
                      <input
                        type="color"
                        value={themeConfig.darkTheme.nodeColor || "#121216"}
                        onChange={(e) => updateDarkColor("nodeColor", e.target.value)}
                      />
                      <input
                        type="text"
                        value={themeConfig.darkTheme.nodeColor || "#121216"}
                        onChange={(e) => updateDarkColor("nodeColor", e.target.value)}
                        className="color-hex-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="api-key-modal-footer">
          <button type="button" className="api-key-btn-cancel" onClick={resetTheme}>重置默认</button>
          <button type="button" className="api-key-btn-save" onClick={() => setShowAppearanceModal(false)}>完成</button>
        </div>
      </div>
    </div>
  )}</>);
}
