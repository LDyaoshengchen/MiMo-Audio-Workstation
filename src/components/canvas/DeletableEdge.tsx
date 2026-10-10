import type { EdgeProps } from "@xyflow/react";
import type { StudioEdge } from "../../types/studio";
import { X } from "lucide-react";
import { getClosestPointOnBezier } from "../../studio/edgeGeometry";
import { memo, useState, useCallback, useMemo } from "react";
import { useReactFlow, getBezierPath, BaseEdge, EdgeLabelRenderer } from "@xyflow/react";

export const DeletableEdge = memo(function DeletableEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data
}: EdgeProps<StudioEdge>) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const strokeColor = style?.stroke || "#0a84ff";

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const closest = getClosestPointOnBezier(
        pos.x,
        pos.y,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition
      );
      setHoverPos(closest);
      setIsHovered(true);
    },
    [screenToFlowPosition, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const buttonX = hoverPos ? hoverPos.x : labelX;
  const buttonY = hoverPos ? hoverPos.y : labelY;

  const edgeStyle = useMemo(
    () => ({
      strokeWidth: style?.strokeWidth || 2,
      ...style,
      stroke: strokeColor
    }),
    [style, strokeColor]
  );

  return (
    <>
      <g
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <path className="edge-hover-path" d={edgePath} />
        <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      </g>
      {isHovered && <EdgeLabelRenderer>
        <button
          className={isHovered ? "edge-delete visible" : "edge-delete"}
          onClick={(event) => {
            event.stopPropagation();
            data?.onDeleteEdge?.(id);
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `translate(-50%, -50%) translate(${buttonX}px, ${buttonY}px)`,
            borderColor: strokeColor,
            color: strokeColor
          }}
          title="断开链接"
          type="button"
        >
          <X size={13} style={{ display: "block", flexShrink: 0 }} />
        </button>
      </EdgeLabelRenderer>}
    </>
  );
});
