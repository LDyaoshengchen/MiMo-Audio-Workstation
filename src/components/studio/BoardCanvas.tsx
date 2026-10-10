import type { Dispatch, SetStateAction, RefObject } from "react";
import type { EdgeTypes, OnEdgesChange } from "@xyflow/react";
import type { ZoomViewport } from "../../utils/frameWheelZoom";
import type { ReactFlowInstance, NodeTypes, NodeChange, Connection, FinalConnectionState } from "@xyflow/react";
import type { WorkspacePayload, StudioNode, StudioEdge, StudioNodeType } from "../../types/studio";
import { AppleCanvasControls } from "../canvas/AppleCanvasControls";
import { ContextMenu } from "../canvas/ContextMenu";
import { LayoutGrid, Search } from "lucide-react";
import { createPortal } from "react-dom";
import { ReactFlow, Background, BackgroundVariant } from "@xyflow/react";
import { OverlapMiniMap } from "../canvas/OverlapMiniMap";
import { MouseEvent } from "react";

export interface BoardCanvasProps {
  activeWorkspace: WorkspacePayload | null;
  patchWorkspaceName: (name: string) => void;
  saveWorkspace: (overrideNodes?: StudioNode[], overrideEdges?: StudioEdge[], overrideWorkspace?: WorkspacePayload) => Promise<void>;
  tidyWorkspaceNodes: (onlySelected?: boolean) => void;
  selectedNodesCount: number;
  setShowNodeSearchModal: Dispatch<SetStateAction<boolean>>;
  flowWrapRef: RefObject<HTMLDivElement | null>;
  handleFlowMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  handleFlowMouseMove: (event: MouseEvent<HTMLDivElement>) => void;
  openContextMenu: (event: MouseEvent) => void;
  hydratedNodes: StudioNode[];
  hydratedEdges: StudioEdge[];
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  flowRef: RefObject<ReactFlowInstance<StudioNode, StudioEdge> | null>;
  handleCustomNodesChange: (changes: NodeChange<StudioNode>[]) => void;
  onEdgesChange: OnEdgesChange<StudioEdge>;
  onConnect: (connection: Connection) => void;
  onConnectEnd: (event: unknown, connectionState: FinalConnectionState) => void;
  onNodeDragStop: () => void;
  canvasMotion: { begin: () => void; end: () => void; detail: (_event: unknown, viewport: ZoomViewport) => void; };
  isLight: boolean;
  nodeColors: Record<string, string>;
  menu: { x: number; y: number; flowX: number; flowY: number; sourceNodeId?: string; sourceHandleId?: string | null; sourceHandleType?: "source" | "target"; } | null;
  addNode: (type: StudioNodeType) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  undoStackRef: RefObject<{ nodes: StudioNode[]; edges: StudioEdge[]; }[]>;
  redoStackRef: RefObject<{ nodes: StudioNode[]; edges: StudioEdge[]; }[]>;
  setMenu: Dispatch<SetStateAction<{ x: number; y: number; flowX: number; flowY: number; sourceNodeId?: string; sourceHandleId?: string | null; sourceHandleType?: "source" | "target"; } | null>>;
}

export function BoardCanvas({
  activeWorkspace,
  patchWorkspaceName,
  saveWorkspace,
  tidyWorkspaceNodes,
  selectedNodesCount,
  setShowNodeSearchModal,
  flowWrapRef,
  handleFlowMouseDown,
  handleFlowMouseMove,
  openContextMenu,
  hydratedNodes,
  hydratedEdges,
  nodeTypes,
  edgeTypes,
  flowRef,
  handleCustomNodesChange,
  onEdgesChange,
  onConnect,
  onConnectEnd,
  onNodeDragStop,
  canvasMotion,
  isLight,
  nodeColors,
  menu,
  addNode,
  handleUndo,
  handleRedo,
  undoStackRef,
  redoStackRef,
  setMenu,
}: BoardCanvasProps) {
  return (<section className="canvas-panel">
    <div className="canvas-titlebar">
      <div className="canvas-titlebar-left">
        <input
          value={activeWorkspace?.name ?? ""}
          onChange={(event) => patchWorkspaceName(event.target.value)}
          onBlur={() => void saveWorkspace()}
          placeholder="未命名工作台"
        />
        <span>右键添加节点；拖拽空白处框选；Ctrl/Cmd+Z / Y 撤销、重做；Ctrl/Cmd+C、X、V 复制、剪切、粘贴；Delete / Backspace 删除节点</span>
      </div>
      <div className="canvas-titlebar-right">
        <button
          type="button"
          className="canvas-titlebar-btn"
          onClick={() => tidyWorkspaceNodes()}
          title={selectedNodesCount >= 2 ? `一键整理当前框选的 ${selectedNodesCount} 个节点排版` : "根据依赖自动整理并优雅排布画布节点"}
        >
          <LayoutGrid size={15} />
          {selectedNodesCount >= 2 ? `框选排版 (${selectedNodesCount})` : "整齐排版"}
        </button>
        <button type="button" className="canvas-titlebar-btn" onClick={() => setShowNodeSearchModal(true)} title="搜索并快速平滑聚焦节点 (Ctrl+F)">
          <Search size={15} />
          搜索节点
        </button>
      </div>
    </div>
    <div
      className="flow-wrap"
      ref={flowWrapRef}
      onMouseDown={handleFlowMouseDown}
      onMouseMove={handleFlowMouseMove}
      onContextMenu={openContextMenu}
    >
      <ReactFlow<StudioNode, StudioEdge>
        nodes={hydratedNodes}
        edges={hydratedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onlyRenderVisibleElements={true}
        elevateNodesOnSelect={false}
        nodesDraggable={true}
        elementsSelectable={true}
        nodeDragThreshold={2}
        defaultEdgeOptions={{ type: "deletable", focusable: false }}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        onNodesChange={handleCustomNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={onNodeDragStop}
        snapToGrid={false}
        connectionRadius={30}
        selectionOnDrag
        panOnDrag={[1, 2]}
        multiSelectionKeyCode={["Control", "Meta"]}
        deleteKeyCode={["Delete", "Backspace"]}
        onNodesDelete={() => {
          void saveWorkspace();
        }}
        onEdgesDelete={() => {
          void saveWorkspace();
        }}
        minZoom={0.005}
        maxZoom={30}
        zoomOnScroll={false}
        zoomOnPinch={true}
        onMoveStart={canvasMotion.begin}
        onMoveEnd={canvasMotion.end}
        onMove={canvasMotion.detail}
        fitView
        fitViewOptions={{ minZoom: 0.005, maxZoom: 1.5, padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--canvas-grid)" gap={34} size={1.2} variant={BackgroundVariant.Dots} />
        <AppleCanvasControls />
        <OverlapMiniMap nodeColors={nodeColors} />
      </ReactFlow>
      {menu ? (
        createPortal(
          <ContextMenu
            menu={menu}
            onAdd={addNode}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStackRef.current.length > 0}
            canRedo={redoStackRef.current.length > 0}
            selectedCount={selectedNodesCount}
            onTidySelection={() => {
              setMenu(null);
              tidyWorkspaceNodes(true);
            }}
          />,
          document.body
        )
      ) : null}
    </div>
  </section>);
}
