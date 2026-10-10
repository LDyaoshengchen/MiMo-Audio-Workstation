import type { StudioNodeType } from "../../types/studio";
import { LayoutGrid } from "lucide-react";
import { nodeCatalog } from "../../studio/config";

export function ContextMenu({
  menu,
  onAdd,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedCount,
  onTidySelection
}: {
  menu: { x: number; y: number };
  onAdd: (type: StudioNodeType) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  selectedCount?: number;
  onTidySelection?: () => void;
}) {
  const menuWidth = 440;
  const menuHeight = 520;
  const clampedX = Math.max(12, Math.min(menu.x, window.innerWidth - menuWidth - 12));
  const clampedY = Math.max(12, Math.min(menu.y, window.innerHeight - menuHeight - 12));

  return (
    <div
      className="context-menu nodrag nopan nowheel"
      style={{ left: clampedX, top: clampedY, maxHeight: "85vh", overflowY: "auto", zIndex: 999999 }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {selectedCount && selectedCount >= 2 && onTidySelection ? (
        <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <button
            type="button"
            className="context-menu-item"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(224, 185, 102, 0.12)",
              borderColor: "rgba(224, 185, 102, 0.35)",
              color: "#e8c97e",
              fontWeight: 600,
              padding: "8px 12px",
              borderRadius: 6,
              cursor: "pointer"
            }}
            onClick={onTidySelection}
          >
            <LayoutGrid size={15} style={{ flexShrink: 0 }} />
            <span>整理框选节点 ({selectedCount})</span>
          </button>
        </div>
      ) : null}
      <strong>添加工作节点</strong>
      <div className="context-menu-node-grid">
        {(Object.keys(nodeCatalog) as StudioNodeType[])
          .filter((type) => type !== "artifact" && type !== "batchArtifact")
          .map((type) => (
            <button key={type} type="button" className={`context-menu-item tone-${type}`} onClick={() => onAdd(type)}>
              <span>{nodeCatalog[type].label}</span>
              <small>{nodeCatalog[type].description}</small>
            </button>
          ))}
      </div>
    </div>
  );
}
