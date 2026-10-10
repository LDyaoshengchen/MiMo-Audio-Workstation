import type { WorkspacePayload, WorkspaceSummary, StudioNode, StudioNodeType } from "../../types/studio";
import { Search, X, Loader2 } from "lucide-react";
import { nodeCatalog } from "../../studio/config";
import { useState, useRef, useEffect, useMemo } from "react";

export function NodeSearchModal({
  activeWorkspace,
  workspaces,
  onClose,
  onSelectNode
}: {
  activeWorkspace: WorkspacePayload | null;
  workspaces: WorkspaceSummary[];
  onClose: () => void;
  onSelectNode: (workspaceId: string, node: StudioNode) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [allNodesMap, setAllNodesMap] = useState<Array<{ workspaceId: string; workspaceName: string; node: StudioNode }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setIsLoading(true);

    Promise.all(
      workspaces.map(async (ws) => {
        try {
          if (ws.id === activeWorkspace?.id && activeWorkspace.type === "board") {
            return {
              workspaceId: ws.id,
              workspaceName: ws.name,
              nodes: activeWorkspace.nodes || []
            };
          }
          const res = await fetch(`/api/workspaces/${ws.id}`);
          if (!res.ok) return null;
          const data = (await res.json()) as WorkspacePayload;
          if (data.type === "board") {
            return {
              workspaceId: ws.id,
              workspaceName: ws.name,
              nodes: data.nodes || []
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    )
      .then((results) => {
        const combined: Array<{ workspaceId: string; workspaceName: string; node: StudioNode }> = [];
        results.forEach((item) => {
          if (item) {
            item.nodes.forEach((node) => {
              combined.push({
                workspaceId: item.workspaceId,
                workspaceName: item.workspaceName,
                node
              });
            });
          }
        });
        setAllNodesMap(combined);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [workspaces, activeWorkspace]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNodesMap;
    return allNodesMap.filter(({ workspaceName, node }) => {
      const wsTitle = String(workspaceName).toLowerCase();
      const title = String(node.data.title || "").toLowerCase();
      const text = String(node.data.text || "").toLowerCase();
      const instruction = String(node.data.instruction || "").toLowerCase();
      const voiceDescription = String(node.data.voiceDescription || "").toLowerCase();
      const rowsText = (node.data.batchRows || [])
        .map((r) => `${r.title} ${r.text} ${r.instruction || ""}`)
        .join(" ")
        .toLowerCase();
      const typeLabel = (nodeCatalog[node.type as StudioNodeType]?.label || node.type).toLowerCase();

      return (
        wsTitle.includes(q) ||
        title.includes(q) ||
        text.includes(q) ||
        instruction.includes(q) ||
        voiceDescription.includes(q) ||
        rowsText.includes(q) ||
        typeLabel.includes(q)
      );
    });
  }, [allNodesMap, query]);

  return (
    <div className="api-key-modal" onClick={onClose}>
      <div className="api-key-modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <Search size={18} />
            全库画板节点全局搜索 (Ctrl+F)
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="api-key-modal-body">
          <div className="search-input-box" style={{ marginBottom: 12 }}>
            <input
              ref={inputRef}
              type="text"
              className="api-key-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="跨全库画板搜索节点名字、台词文本、提示词、行内数据..."
              spellCheck={false}
            />
          </div>
          <div className="node-search-results-list">
            {isLoading ? (
              <p className="node-muted" style={{ textAlign: "center", padding: "28px 0" }}>
                <Loader2 size={18} className="spin" style={{ display: "inline-block", verticalAlign: "-3px", marginRight: 8 }} />
                正在检索全库 {workspaces.length} 个画板的数据...
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="node-muted" style={{ textAlign: "center", padding: "28px 0" }}>全库画板中未找到匹配的节点</p>
            ) : (
              filteredItems.map(({ workspaceId, workspaceName, node }) => {
                const label = nodeCatalog[node.type as StudioNodeType]?.label || node.type;
                const snippet = node.data.text || node.data.instruction || node.data.voiceDescription || "";
                return (
                  <button
                    key={`${workspaceId}-${node.id}`}
                    type="button"
                    className="node-search-item-card"
                    onClick={() => void onSelectNode(workspaceId, node)}
                  >
                    <div className="node-search-item-header">
                      <div className="node-search-title-group">
                        <span className="node-search-workspace-tag">[{workspaceName}]</span>
                        <strong className="node-search-node-name">{node.data.title || label}</strong>
                      </div>
                      <span className="node-search-type-badge">{label}</span>
                    </div>
                    {snippet ? (
                      <p className="node-search-item-snippet">{snippet}</p>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
