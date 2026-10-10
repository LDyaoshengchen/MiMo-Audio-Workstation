import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { memo } from "react";

export const CommentNode = memo(function CommentNode({ id, data }: NodeProps<StudioNode>) {
  return (
    <div className="comment-node">
      <textarea
        className="nodrag nopan nowheel"
        value={data.text ?? ""}
        onChange={(event) => data.onPatch?.(id, { text: event.target.value })}
        rows={3}
        placeholder="添加注释..."
      />
    </div>
  );
});
