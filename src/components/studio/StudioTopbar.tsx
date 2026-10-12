import type { Dispatch, SetStateAction, RefObject } from "react";
import type { ThemeConfig } from "../../studio/theme";
import { Palette, FolderOpen } from "lucide-react";
import { StatusPill } from "../canvas/StatusPill";
import { StudioMoreMenu } from "./StudioMoreMenu";
import { PlaybackSettings } from "./PlaybackSettings";
import { RoleVoiceLibrary } from "./RoleVoiceLibrary";
import type { StudioNode } from "../../types/studio";

export interface StudioTopbarProps {
  nodes: StudioNode[];
  themeConfig: ThemeConfig;
  topbarCollapsed: boolean;
  topbarHoverTimerRef: RefObject<number | null>;
  showApiKeyModal: boolean;
  setTopbarCollapsed: Dispatch<SetStateAction<boolean>>;
  apiKey: string;
  serverApiKeyConfigured: boolean;
  openApiKeyModal: () => void;
  setShowAppearanceModal: Dispatch<SetStateAction<boolean>>;
  setShowStoragePathModal: Dispatch<SetStateAction<boolean>>;
}

export function StudioTopbar({
  nodes,
  themeConfig,
  topbarCollapsed,
  topbarHoverTimerRef,
  showApiKeyModal,
  setTopbarCollapsed,
  apiKey,
  serverApiKeyConfigured,
  openApiKeyModal,
  setShowAppearanceModal,
  setShowStoragePathModal,
}: StudioTopbarProps) {
  return (<header
    className={`studio-topbar ${(themeConfig.autoHideTopbar ?? true) && topbarCollapsed ? "collapsed" : ""}`}
    onMouseEnter={() => {
      if (topbarHoverTimerRef.current) {
        window.clearTimeout(topbarHoverTimerRef.current);
      }
    }}
    onMouseLeave={() => {
      if ((themeConfig.autoHideTopbar ?? true) && !showApiKeyModal) {
        topbarHoverTimerRef.current = window.setTimeout(() => { if(!document.querySelector('.settings-popover-overlay,.studio-compact-menu')) setTopbarCollapsed(true); }, 1500);
      }
    }}
  >
    <div className="brand-block">
      {themeConfig.brandTitleEn ? <span className="brand-kicker" title={themeConfig.brandTitleEn}>{themeConfig.brandTitleEn}</span> : null}
      {themeConfig.brandTitleZh ? <h1 title={themeConfig.brandTitleZh}>{themeConfig.brandTitleZh}</h1> : null}
    </div>
    <div className="topbar-actions">
      <RoleVoiceLibrary />
      <StatusPill apiKey={apiKey} serverConfigured={serverApiKeyConfigured} onOpenModal={openApiKeyModal} />
      <button data-settings-trigger="appearance" type="button" onClick={() => setShowAppearanceModal(true)} title="调整外观色彩与主题">
        <Palette size={16} />
        外观
      </button>
      <button data-settings-trigger="storage" type="button" onClick={() => setShowStoragePathModal(true)} title="存储目录与单个产物下载命名设置">
        <FolderOpen size={16} />
        存储设置
      </button>
      <PlaybackSettings />
      <StudioMoreMenu />
    </div>
  </header>);
}
