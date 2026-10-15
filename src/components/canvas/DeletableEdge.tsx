import type { EdgeProps } from "@xyflow/react";
import type { StudioEdge } from "../../types/studio";
import { X } from "lucide-react";
import { getClosestPointOnBezier } from "../../studio/edgeGeometry";
import { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveFrame = useRef<number | null>(null);
  const latestPointer = useRef({ x: 0, y: 0 });
  const pressed = useRef(false);
  const keepVisible = useCallback(() => {
    if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setIsHovered(true);
  }, []);
  useEffect(() => () => {
    if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    if (moveFrame.current !== null) cancelAnimationFrame(moveFrame.current);
  }, []);
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

  const updateHoverPosition = useCallback(
    (point: { x: number; y: number }) => {
      const pos = screenToFlowPosition(point);
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
      keepVisible();
    },
    [screenToFlowPosition, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, keepVisible]
  );

  const handleMouseEnter = useCallback((event: React.MouseEvent) => {
    updateHoverPosition({ x: event.clientX, y: event.clientY });
  }, [updateHoverPosition]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (pressed.current) return;
    latestPointer.current = { x: event.clientX, y: event.clientY };
    if (moveFrame.current !== null) return;
    moveFrame.current = requestAnimationFrame(() => {
      moveFrame.current = null;
      if (!pressed.current) updateHoverPosition(latestPointer.current);
    });
  }, [updateHoverPosition]);

  const handleMouseLeave = useCallback(() => {
    if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { hideTimer.current = null; setIsHovered(false); }, 180);
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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <path className="edge-hover-path" d={edgePath} />
        <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      </g>
      {isHovered && <EdgeLabelRenderer>
        <button
          className="edge-delete visible nodrag nopan"
          onPointerDown={event => { event.stopPropagation(); pressed.current = true; }}
          onPointerUp={() => { pressed.current = false; }}
          onPointerCancel={() => { pressed.current = false; }}
          onClick={(event) => {
            event.stopPropagation();
            data?.onDeleteEdge?.(id);
          }}
          onMouseEnter={keepVisible}
          onMouseMove={handleMouseMove}
          onFocus={keepVisible}
          onBlur={handleMouseLeave}
          onMouseLeave={() => { pressed.current = false; handleMouseLeave(); }}
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
