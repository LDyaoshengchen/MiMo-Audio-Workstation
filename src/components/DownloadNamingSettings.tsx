import { type SingleDownloadSettings, getSingleArtifactDownloadFileName } from "../utils/downloadSettings";
import { Clock3, FileAudio, FileDown, PanelsTopLeft } from "lucide-react";

export function DownloadNamingSettings({ settings, onChange, workspaceName }: {
  settings: SingleDownloadSettings;
  onChange: (settings: SingleDownloadSettings) => void;
  workspaceName?: string;
}) {
  return <section className="download-naming-settings" aria-label="单个产物下载命名">
    <div className="storage-path-card-title"><FileDown size={16} aria-hidden="true" /> 单个产物下载命名</div>
    <div className="appearance-card">
      <div className="appearance-card-main">
        <div className="download-naming-label">
          <PanelsTopLeft size={18} aria-hidden="true" />
          <div><div className="appearance-card-title">带画板名称</div>
            <div className="appearance-card-sub">在文件名前添加画板名，重复部分自动合并。</div></div>
        </div>
        <button type="button" role="switch" aria-label="带画板名称" aria-checked={settings.includeWorkspaceName}
          className={`capsule-switch ${settings.includeWorkspaceName ? "checked" : ""}`}
          onClick={() => onChange({ ...settings, includeWorkspaceName: !settings.includeWorkspaceName })}>
          <span className="capsule-switch-thumb" />
        </button>
      </div>
    </div>
    <div className="appearance-card">
      <div className="appearance-card-main">
        <div className="download-naming-label">
          <Clock3 size={18} aria-hidden="true" />
          <div><div className="appearance-card-title">带时间</div>
            <div className="appearance-card-sub">添加音频生成时间，精确到秒。</div></div>
        </div>
        <button type="button" role="switch" aria-label="带时间" aria-checked={settings.includeTime}
          className={`capsule-switch ${settings.includeTime ? "checked" : ""}`}
          onClick={() => onChange({ ...settings, includeTime: !settings.includeTime })}>
          <span className="capsule-switch-thumb" />
        </button>
      </div>
    </div>
    <div className="download-naming-preview">
      <FileAudio size={16} aria-hidden="true" />
      <div><div className="appearance-card-sub">命名示例</div>
        <div className="download-naming-filename">{getSingleArtifactDownloadFileName("VO_00085_01", "output.wav", workspaceName || "怪物", "2026-10-08T17:00:02", settings)}</div></div>
    </div>
    <p className="download-naming-help">适用于单个产物节点、全能综合工作台和批量产物节点的单条下载；不影响 ZIP 打包。选择自动保存，画板名中的自动时间后缀不重复添加。</p>
  </section>;
}
