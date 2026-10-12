import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { GAME_CHARACTER_PRESETS } from "../../utils/gamePresets";
import { Handle, Position } from "@xyflow/react";
import { Mic2, Loader2, AudioLines, Grid } from "lucide-react";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { GenerationButtonText } from "../GenerationButtonText";
import { RoleVoiceLibrary } from "../studio/RoleVoiceLibrary";
import { memo, useRef, useState, useLayoutEffect, Fragment } from "react";
import { useAutoUpdateNodeInternals, getElementTopInNode } from "../../studio/nodeInternals";

export const VoiceCloneNode = memo(function VoiceCloneNode({ id, data }: NodeProps<StudioNode>) {
  const label1Ref = useRef<HTMLSpanElement | null>(null);
  const label2Ref = useRef<HTMLSpanElement | null>(null);
  const [instTop, setInstTop] = useState(86);
  const [textTop, setTextTop] = useState(218);

  useAutoUpdateNodeInternals(id, [instTop, textTop]);

  useLayoutEffect(() => {
    function update() {
      const y1 = getElementTopInNode(label1Ref.current);
      const y2 = getElementTopInNode(label2Ref.current);
      if (y1 !== null && Math.abs(y1 - instTop) >= 3) {
        setInstTop(y1);
      }
      if (y2 !== null && Math.abs(y2 - textTop) >= 3) {
        setTextTop(y2);
      }
    }
    update();
    const ro = new ResizeObserver(update);
    const node = label1Ref.current?.closest<HTMLElement>(".studio-node");
    if (node) ro.observe(node);
    return () => ro.disconnect();
  }, [instTop, textTop]);

  const dynStyle = (top: number): React.CSSProperties => ({ top });

  return (
    <StudioNodeFrame id={id} data={data} icon={<Mic2 size={17} />} tone="clone">
      <Handle type="target" position={Position.Left} id="voice" className="node-handle handle-voice" />
      <span className="input-handle-label label-voice">参考</span>
      <Handle type="target" position={Position.Left} id="instruction" className="node-handle" style={dynStyle(instTop)} />
      <span className="input-handle-label" style={dynStyle(instTop)}>风格</span>
      <Handle type="target" position={Position.Left} id="text" className="node-handle" style={dynStyle(textTop)} />
      <span className="input-handle-label" style={dynStyle(textTop)}>文本</span>
      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />

      <div className="clone-toolbar nodrag">
        <select
          className="clone-preset-select"
          defaultValue=""
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            const isEn = val.endsWith("_en");
            const charId = val.replace(/_(?:zh|en)$/, "");
            const p = GAME_CHARACTER_PRESETS.find((c) => c.id === charId);
            if (p) {
              data.onPatch?.(id, {
                instruction: p.directionEn,
                text: isEn ? p.dialogueEn : p.dialogueZh,
                error: undefined
              });
            }
          }}
        >
          <option value="" disabled>🎮 角色预设</option>
          <optgroup label="🎮 官方多语种角色预设 (支持中/英/日/韩等语种)">
            {GAME_CHARACTER_PRESETS.map((p) => (
              <Fragment key={p.id}>
                <option value={`${p.id}_zh`}>
                  {p.avatar} {p.nameZh} (中)
                </option>
                <option value={`${p.id}_en`}>
                  {p.avatar} {p.nameZh} (英)
                </option>
              </Fragment>
            ))}
          </optgroup>
        </select>
        <RoleVoiceLibrary nodeId={id} data={data} />
      </div>

      <label className="node-field nodrag">
        <span ref={label1Ref}>语音风格（导演文本）</span>
        <textarea className="nodrag nopan nowheel" value={data.instruction ?? ""} onChange={(event) => data.onPatch?.(id, { instruction: event.target.value })} rows={4} />
      </label>
      <label className="node-field nodrag">
        <span ref={label2Ref}>音频文本</span>
        <textarea className="nodrag nopan nowheel" value={data.text ?? ""} onChange={(event) => data.onPatch?.(id, { text: event.target.value })} rows={5} />
      </label>
      {data.error ? <p className="node-error">{data.error}</p> : null}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          className={data.isRunning ? "run-button nodrag is-running is-generating" : "run-button nodrag"}
          type="button"
          onClick={() => data.onRunClone?.(id, 1)}
          disabled={data.isRunning}
          style={{ flex: 1, margin: 0 }}
          title="生成 1 条音频克隆产物"
        >
          {data.isRunning ? <Loader2 className="spin" size={15} /> : <AudioLines size={15} />}
          <GenerationButtonText data={data} idle="运行克隆" batch={false} />
        </button>

        <button
          className={data.isRunning ? "run-button batch-nine-btn nodrag is-running is-generating" : "run-button batch-nine-btn nodrag"}
          type="button"
          onClick={() => data.onRunClone?.(id, 9)}
          disabled={data.isRunning}
          style={{ flex: 1, margin: 0 }}
          title="一次性批量克隆 9 个音频产物"
        >
          {data.isRunning ? <Loader2 className="spin" size={15} /> : <Grid size={15} />}
          <GenerationButtonText data={data} idle="批量克隆 9个" running="批量克隆中..." batch />
        </button>
      </div>
    </StudioNodeFrame>
  );
});
