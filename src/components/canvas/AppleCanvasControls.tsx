import { Plus, Minus, Maximize2 } from "lucide-react";
import { useReactFlow } from "@xyflow/react";

export function AppleCanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="apple-canvas-controls nodrag">
      <button
        type="button"
        className="apple-canvas-ctrl-btn"
        onClick={() => zoomIn({ duration: 220 })}
        title="放大视图 (Ctrl + +)"
        aria-label="放大"
      >
        <Plus size={15} strokeWidth={2.2} />
      </button>
      <div className="apple-canvas-ctrl-divider" />
      <button
        type="button"
        className="apple-canvas-ctrl-btn"
        onClick={() => zoomOut({ duration: 220 })}
        title="缩小视图 (Ctrl + -)"
        aria-label="缩小"
      >
        <Minus size={15} strokeWidth={2.2} />
      </button>
      <div className="apple-canvas-ctrl-divider" />
      <button
        type="button"
        className="apple-canvas-ctrl-btn"
        onClick={() => fitView({ duration: 260, padding: 0.2 })}
        title="适应画布全景 (Space + 0)"
        aria-label="适应画布"
      >
        <Maximize2 size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}
