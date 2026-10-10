import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { AudioLines, Loader2 } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { formatBytes } from "../../studio/format";
import { memo } from "react";

export const AudioMergeNode = memo(function AudioMergeNode({ id, data }: NodeProps<StudioNode>) {
  return (
    <StudioNodeFrame id={id} data={data} icon={<AudioLines size={17} />} tone="audio-merge">
      <Handle type="target" position={Position.Left} id="audio" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>音频</span>
      <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} />
      <p className="node-muted">将所有连入的音频按连接顺序拼接为一段 WAV；一个批量参考节点可提供多段音频。</p>
      {data.audio ? (
        <>
          <p className="merge-result">已整合：{data.audio.fileName} · {formatBytes(data.audio.size)}</p>
          <StudioAudioPlayer src={data.audio.dataUrl} />
        </>
      ) : null}
      {data.error ? <p className="node-error">{data.error}</p> : null}
      <button className={data.isRunning ? "run-button nodrag is-running is-generating" : "run-button nodrag"} type="button" onClick={() => data.onRunAudioMerge?.(id)} disabled={data.isRunning}>
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <AudioLines size={16} />}
        {data.isRunning ? "整合中…" : "整合并输出"}
      </button>
    </StudioNodeFrame>
  );
});
