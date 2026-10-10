import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { Handle, Position } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { memo } from "react";

export const VoiceStyleNode = memo(function VoiceStyleNode({ id, data }: NodeProps<StudioNode>) {
  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="style">
      <Handle type="source" position={Position.Right} id="style" className="node-handle" style={{ top: "50%" }} />
      <textarea
        className="nodrag nopan nowheel"
        value={data.text ?? ""}
        onChange={(event) => data.onPatch?.(id, { text: event.target.value })}
        rows={6}
        placeholder="写入语气、情绪、语速、角色和导演指令，并连接到克隆节点的「风格」输入。"
      />
      {data.error ? <p className="node-error">{data.error}</p> : null}
    </StudioNodeFrame>
  );
});
