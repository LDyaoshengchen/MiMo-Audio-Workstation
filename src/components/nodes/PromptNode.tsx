import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { Handle, Position } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { memo } from "react";

export const PromptNode = memo(function PromptNode({ id, data }: NodeProps<StudioNode>) {
  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="prompt">
      <Handle type="source" position={Position.Right} id="text" className="node-handle" style={{ top: "50%" }} />
      <textarea
        className="nodrag nopan nowheel"
        value={data.text ?? ""}
        onChange={(event) => data.onPatch?.(id, { text: event.target.value })}
        rows={6}
        placeholder="写入最终要生成成音频的文本，并连接到克隆节点的「文本」输入。"
      />
    </StudioNodeFrame>
  );
});
