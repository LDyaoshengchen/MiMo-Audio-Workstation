import { type SingleDownloadSettings, getSingleArtifactDownloadFileName } from "../utils/downloadSettings";
import { Clock3, FileAudio, FileDown, PanelsTopLeft } from "lucide-react";

export function DownloadNamingSettings({ settings, onChange, workspaceName, scope = "single" }: {
  settings: SingleDownloadSettings;
  onChange: (settings: SingleDownloadSettings) => void;
  workspaceName?: string;
  scope?: "single" | "batch";
}) {
  const isBatch = scope === "batch";
  const includeBatchNodeName = settings.includeBatchNodeName !== false;
  return <section className="download-naming-settings" aria-label={isBatch ? "批量下载和 ZIP 命名" : "单个产物下载命名"}>
    <div className="storage-path-card-title"><FileDown size={16} aria-hidden="true" /> {isBatch ? "批量下载和 ZIP 命名" : "单个产物下载命名"}</div>
    <div className="appearance-card">
      <div className="appearance-card-main">
        <div className="download-naming-label">
          <PanelsTopLeft size={18} aria-hidden="true" />
          <div><div className="appearance-card-title">带画板名称</div>
            <div className="appearance-card-sub">在文件名前添加画板名，重复部分自动合并。</div></div>
        </div>
        <button type="button" role="switch" aria-label="带画板名称" aria-checked={settings.includeWorkspaceName} data-download-scope={scope}
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
            <div className="appearance-card-sub">音频文件添加生成时间，ZIP 包添加打包时间。</div></div>
        </div>
        <button type="button" role="switch" aria-label="带时间" aria-checked={settings.includeTime} data-download-scope={scope}
          className={`capsule-switch ${settings.includeTime ? "checked" : ""}`}
          onClick={() => onChange({ ...settings, includeTime: !settings.includeTime })}>
          <span className="capsule-switch-thumb" />
        </button>
      </div>
    </div>
    {isBatch && <div className="appearance-card">
      <div className="appearance-card-main">
        <div className="download-naming-label">
          <FileAudio size={18} aria-hidden="true" />
          <div><div className="appearance-card-title">带批量产物节点名称</div>
            <div className="appearance-card-sub">批量产物节点打包时，将节点标题加入 ZIP 和音频文件名。</div></div>
        </div>
        <button type="button" role="switch" aria-label="带批量产物节点名称" aria-checked={includeBatchNodeName}
          className={`capsule-switch ${includeBatchNodeName ? "checked" : ""}`}
          onClick={() => onChange({ ...settings, includeBatchNodeName: !includeBatchNodeName })}>
          <span className="capsule-switch-thumb" />
        </button>
      </div>
    </div>}
    <div className="download-naming-preview">
      <FileAudio size={16} aria-hidden="true" />
      <div><div className="appearance-card-sub">命名示例</div>
        <div className="download-naming-filename">{getSingleArtifactDownloadFileName(isBatch && includeBatchNodeName ? "VO_00085_句段 4_01" : "VO_00085_01", "output.wav", workspaceName || "怪物", "2026-10-08T17:00:02", settings)}</div></div>
    </div>
    <p className="download-naming-help">{isBatch
      ? "适用于暂存区、全能综合工作台和批量产物的批量下载与 ZIP 打包。画板名中的自动时间后缀不会重复添加。"
      : "仅适用于单个产物下载。选择自动保存时，画板名中的自动时间后缀不会重复添加。"}</p>
  </section>;
}
