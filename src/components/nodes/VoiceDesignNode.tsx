import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { GAME_CHARACTER_PRESETS, getFormattedNaturalControl } from "../../utils/gamePresets";
import { Handle, Position } from "@xyflow/react";
import { Sparkles, Wand2, Loader2, Grid } from "lucide-react";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { VOICE_DESIGN_PRESETS, VOICE_INSTRUCTION_TAGS, VOICE_CONTROL_TAGS } from "../../studio/voicePresets";
import { memo, useRef, useState, useLayoutEffect, Fragment } from "react";
import { useAutoUpdateNodeInternals, getElementTopInNode } from "../../studio/nodeInternals";

export const VoiceDesignNode = memo(function VoiceDesignNode({ id, data }: NodeProps<StudioNode>) {
  const label2Ref = useRef<HTMLSpanElement | null>(null);
  const [textTop, setTextTop] = useState(380);

  useAutoUpdateNodeInternals(id, [textTop]);

  useLayoutEffect(() => {
    function update() {
      const y = getElementTopInNode(label2Ref.current);
      if (y !== null && Math.abs(y - textTop) >= 3) {
        setTextTop(y);
      }
    }
    update();
    const ro = new ResizeObserver(update);
    const node = label2Ref.current?.closest<HTMLElement>(".studio-node");
    if (node) ro.observe(node);
    return () => ro.disconnect();
  }, [textTop]);

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    if (val.startsWith("game_")) {
      const isEn = val.endsWith("_en");
      const gameId = val.replace(/_(?:zh|en)$/, "").replace("game_", "");
      const gamePreset = GAME_CHARACTER_PRESETS.find((p) => p.id === gameId);
      if (gamePreset) {
        data.onPatch?.(id, {
          instruction: gamePreset.voiceDescriptionEn,
          naturalControl: getFormattedNaturalControl(gamePreset),
          text: isEn ? gamePreset.dialogueEn : gamePreset.dialogueZh,
          error: undefined
        });
        return;
      }
    }

    const idx = parseInt(val, 10);
    if (!isNaN(idx) && VOICE_DESIGN_PRESETS[idx]) {
      const p = VOICE_DESIGN_PRESETS[idx];
      data.onPatch?.(id, { instruction: p.instruction, naturalControl: p.naturalControl, error: undefined });
    }
  };

  const handleAppendInstructionTag = (tag: string) => {
    const current = data.instruction ?? "";
    const updated = current ? `${current}，${tag}` : tag;
    data.onPatch?.(id, { instruction: updated, error: undefined });
  };

  const handleAppendControlTag = (tag: string) => {
    const current = data.naturalControl ?? "";
    const updated = current ? `${current}；${tag}` : `指导：${tag}`;
    data.onPatch?.(id, { naturalControl: updated, error: undefined });
  };

  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="design">
      <Handle type="target" position={Position.Left} id="text" className="node-handle" style={{ top: textTop }} />
      <span className="input-handle-label" style={{ top: textTop }}>文本</span>
      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />

      <div className="design-toolbar nodrag">
        <select className="design-preset-select" defaultValue="" onChange={handleSelectPreset}>
          <option value="" disabled>✨ 音色预设…</option>
          <optgroup label="🎮 官方多语种角色预设 (支持中/英/日/韩等语种)">
            {GAME_CHARACTER_PRESETS.map((p) => (
              <Fragment key={p.id}>
                <option value={`game_${p.id}_zh`}>
                  {p.avatar} {p.nameZh} (中)
                </option>
                <option value={`game_${p.id}_en`}>
                  {p.avatar} {p.nameZh} (英)
                </option>
              </Fragment>
            ))}
          </optgroup>
          <optgroup label="🎙️ 通用播客/有声预设">
            {VOICE_DESIGN_PRESETS.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </optgroup>
        </select>
        <button
          className="design-action-btn"
          type="button"
          onClick={() => data.onOptimizeVoiceDesign?.(id)}
          title="使用 AI 智能扩展与润色描述"
          disabled={data.isRunning}
        >
          <Wand2 size={13} />
          AI 润色
        </button>
      </div>

      <label className="node-field nodrag">
        <div className="design-field-header">
          <span>音色描述词</span>
        </div>
        <textarea
          value={data.instruction ?? ""}
          onChange={(event) => data.onPatch?.(id, { instruction: event.target.value, error: undefined })}
          rows={3}
          className="nodrag nopan nowheel"
          placeholder='例：一位年迈的老先生，说带北方口音的普通话，语速缓慢沉稳，嗓音略带沧桑感...'
        />
        <div className="tag-cloud">
          {VOICE_INSTRUCTION_TAGS.map((tag) => (
            <span key={tag} className="tag-pill" onClick={() => handleAppendInstructionTag(tag)}>
              +{tag}
            </span>
          ))}
        </div>
      </label>

      <label className="node-field nodrag">
        <div className="design-field-header">
          <span>自然语言控制</span>
        </div>
        <textarea
          value={data.naturalControl ?? ""}
          onChange={(event) => data.onPatch?.(id, { naturalControl: event.target.value, error: undefined })}
          rows={4}
          className="nodrag nopan nowheel"
          placeholder={"可选填角色/场景/情绪指导，例：\n角色：百年门阀大当家\n场景：在祠堂阴影里居高临下\n指导：冰冷而慵懒，断句干净利落..."}
        />
        <div className="tag-cloud">
          {VOICE_CONTROL_TAGS.map((tag) => (
            <span key={tag} className="tag-pill" onClick={() => handleAppendControlTag(tag)}>
              +{tag}
            </span>
          ))}
        </div>
      </label>

      <label className="node-field nodrag">
        <span ref={label2Ref}>音频文本</span>
        <textarea
          value={data.text ?? ""}
          onChange={(event) => data.onPatch?.(id, { text: event.target.value, error: undefined })}
          rows={4}
          className="nodrag nopan nowheel"
          placeholder="写入需要直接合成音频的示范文本（或在节点左侧连接提示词节点）。"
        />
      </label>

      {data.error ? <p className="node-error">{data.error}</p> : null}
      <div className="voice-design-bottom-btn-group nodrag" style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className={data.isRunning ? "run-button nodrag is-running is-generating" : "run-button nodrag"}
          type="button"
          onClick={() => data.onRunVoiceDesign?.(id, 1)}
          disabled={data.isRunning}
          style={{ flex: 1, margin: 0 }}
          title="生成 1 条音色产物"
        >
          {data.isRunning ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
          {data.isRunning ? "生成中..." : "运行音色创造"}
        </button>

        <button
          className={data.isRunning ? "run-button batch-nine-btn nodrag is-running is-generating" : "run-button batch-nine-btn nodrag"}
          type="button"
          onClick={() => data.onRunVoiceDesign?.(id, 9)}
          disabled={data.isRunning}
          style={{ flex: 1, margin: 0 }}
          title="一次性批量创造 9 个不同音色产物"
        >
          {data.isRunning ? <Loader2 className="spin" size={15} /> : <Grid size={15} />}
          {data.isRunning ? "批量生成中..." : "批量音色 9个"}
        </button>
      </div>
    </StudioNodeFrame>
  );
});
