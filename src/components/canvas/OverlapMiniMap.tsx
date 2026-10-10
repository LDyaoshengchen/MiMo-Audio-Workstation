import { createContext, memo, useContext, useEffect, useMemo, useState } from "react";
import { MiniMap, useStore, useStoreApi, type MiniMapNodeProps } from "@xyflow/react";
import { getNodeOverlapBadges, type OverlapBadge, type OverlapRect } from "../../utils/nodeOverlapBadges";

const BadgeContext = createContext<{ badges: OverlapBadge[]; lastId?: string; scale: number }>({ badges: [], scale: 1 });

const MapNode = memo(function MapNode({ id, x, y, width, height, borderRadius, className, color, strokeColor, strokeWidth, selected, shapeRendering, onClick }: MiniMapNodeProps) {
  const { badges, lastId, scale } = useContext(BadgeContext);
  return <g>
    <rect x={x} y={y} width={width} height={height} rx={borderRadius} ry={borderRadius}
      className={`react-flow__minimap-node ${selected ? "selected" : ""} ${className}`}
      style={{ fill: color, stroke: strokeColor, strokeWidth }} shapeRendering={shapeRendering}
      onClick={onClick ? event => onClick(event, id) : undefined} />
    {id === lastId && badges.map(badge => <g key={JSON.stringify(badge.ids)} className="minimap-overlap-badge" pointerEvents="none" aria-label={`${badge.count} 个同类节点重叠`}>
      <title>{badge.count} 个同类节点重叠</title>
      <circle cx={badge.x} cy={badge.y} r={8 * scale} />
      <text x={badge.x} y={badge.y} dy="0.35em" textAnchor="middle" fontSize={11 * scale}>{badge.count}</text>
    </g>)}
  </g>;
});

export function OverlapMiniMap({ nodeColors }: { nodeColors: Record<string, string> }) {
  const nodes = useStore(state => state.nodes);
  const store = useStoreApi();
  const [badges, setBadges] = useState<OverlapBadge[]>([]);
  // Geometry changes only. Pan/zoom does not rerun overlap detection; dragging is debounced.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const rects: OverlapRect[] = [];
      for (const node of store.getState().nodeLookup.values()) {
        if (node.hidden) continue;
        rects.push({ id: node.id, type: node.type || "default", ...node.internals.positionAbsolute,
          width: node.measured.width || node.width || 0, height: node.measured.height || node.height || 0 });
      }
      setBadges(getNodeOverlapBadges(rects));
    }, 80);
    return () => window.clearTimeout(timer);
  }, [nodes, store]);
  const scale = useStore(state => {
    if (!badges.length) return 1;
    const [tx, ty, zoom] = state.transform;
    let left = -tx / zoom, top = -ty / zoom, right = left + state.width / zoom, bottom = top + state.height / zoom;
    for (const node of state.nodeLookup.values()) {
      if (node.hidden) continue;
      const { x, y } = node.internals.positionAbsolute;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + (node.measured.width || node.width || 0));
      bottom = Math.max(bottom, y + (node.measured.height || node.height || 0));
    }
    return Math.max((right - left) / 200, (bottom - top) / 150) * (160 / 150);
  });
  const lastId = nodes.filter(node => !node.hidden).at(-1)?.id;
  const badgeContext = useMemo(() => ({ badges, lastId, scale }), [badges, lastId, scale]);
  return <BadgeContext.Provider value={badgeContext}>
    <MiniMap pannable zoomable nodeComponent={MapNode}
      nodeClassName={node => `minimap-tone-${node.type || "default"}`}
      nodeColor={node => (node.type && nodeColors[node.type]) || "var(--accent-color)"} maskColor="var(--canvas-mask)" />
  </BadgeContext.Provider>;
}
