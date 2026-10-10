import type { NodeData } from "../../types/studio";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { ReactNode } from "react";

const typeLabels: Record<string, string> = {
  audio: "参考音频", "audio-merge": "音频整合", style: "语音风格", prompt: "提示词",
  clone: "音频克隆", "batch-clone": "批量克隆", design: "音色创造", "batch-design": "批量创造",
  artifact: "音频产物", "batch-artifact": "批量产物", "integrated-studio": "综合工作台",
  integratedStudio: "综合工作台", "game-vocal": "游戏语音",
};

export function StudioNodeFrame({
  id,
  data,
  icon,
  tone,
  style,
  children
}: {
  id: string;
  data: NodeData;
  icon: ReactNode;
  tone: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <section className={`studio-node node-${tone}`} style={style}>
      <header className="node-header" title="按住拖拽移动节点">
        <div className="node-title-wrap">
          {icon}
          <input
            className="node-title-input nodrag"
            title="点击修改节点名称"
            value={data.title ?? ""}
            placeholder="节点名称"
            onChange={(event) => data.onPatch?.(id, { title: event.target.value })}
          />
        </div>
        <div className="node-header-actions">
          <span className="node-type-label">{typeLabels[tone] || tone}</span>
          {tone === "style" || tone === "design" ? (
            <button
              className="icon-button optimize-icon nodrag"
              type="button"
              onClick={() => (tone === "style" ? data.onOptimizeStyle?.(id) : data.onOptimizeVoiceDesign?.(id))}
              disabled={data.isRunning}
              title={data.isRunning ? "AI优化中" : tone === "style" ? "AI优化语音风格" : "AI润色音色描述"}
            >
              {data.isRunning ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
            </button>
          ) : null}
          <button className="icon-button nodrag" type="button" onClick={() => data.onDelete?.(id)} title="删除节点">
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      <div className="node-body-container nowheel">
        {children}
      </div>
    </section>
  );
}
