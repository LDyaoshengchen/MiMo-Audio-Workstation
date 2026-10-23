import type { BoardWorkspacePayload, StudioNode, StudioEdge, WorkspacePayload } from "../types/studio";
import type { SynthesisActionsContext } from "./synthesisActions";

type TaskBoard = {
  workspace: BoardWorkspacePayload;
  jobs: number;
  revision: number;
  savedRevision: number;
  pending?: Promise<void>;
  aborted: Record<string, boolean>;
  save: NonNullable<SynthesisActionsContext["saveTaskWorkspace"]>;
};

/** One live graph per generating board, independent of the currently displayed board. */
export class WorkspaceTaskStore {
  private boards = new Map<string, TaskBoard>();

  capture(workspace: WorkspacePayload | null, nodes: StudioNode[], edges: StudioEdge[]) {
    if (workspace?.type !== "board") return;
    const board = this.boards.get(workspace.id);
    if (!board) return;
    const previous = board.workspace;
    if (previous.nodes !== nodes || previous.edges !== edges || previous.name !== workspace.name || previous.stashItems !== workspace.stashItems) board.revision++;
    board.workspace = { ...workspace, nodes, edges };
  }

  has(id: string) { return this.boards.has(id); }

  restore(workspace: WorkspacePayload): WorkspacePayload {
    const board = this.boards.get(workspace.id);
    if (!board) return workspace;
    const restored = board.workspace;
    if (!board.jobs && !board.pending && board.savedRevision === board.revision) this.boards.delete(workspace.id);
    return restored;
  }

  retry(id: string) { const board = this.boards.get(id); return board ? this.flush(board) : Promise.resolve(); }

  forget(ids: string[]) { for (const id of ids) this.boards.delete(id); }

  stopNode(workspaceId: string | undefined, nodeId: string) {
    if (workspaceId) {
      const board = this.boards.get(workspaceId);
      if (board) board.aborted[nodeId] = true;
    }
  }

  private flush(board: TaskBoard): Promise<void> {
    if (board.pending) return board.pending;
    const operation = Promise.resolve().then(async () => {
      while (board.savedRevision < board.revision) {
        const revision = board.revision;
        const snapshot = { ...board.workspace };
        try {
          const saved = await board.save(snapshot);
          board.savedRevision = revision;
          board.workspace = { ...board.workspace, updatedAt: saved.updatedAt };
        } catch {
          // The adapter reports errors and the save queue keeps a recovery snapshot.
          // Keep this live graph so returning to the board never loses generated results.
          break;
        }
      }
    });
    board.pending = operation;
    void operation.finally(() => { if (board.pending === operation) board.pending = undefined; });
    return operation;
  }

  scope(initial: SynthesisActionsContext, getContext: () => SynthesisActionsContext, nodeId: string) {
    const workspace = initial.activeWorkspaceRef ? initial.activeWorkspaceRef.current : initial.activeWorkspace;
    if (workspace?.type !== "board" || !initial.saveTaskWorkspace) return;
    this.capture(workspace, initial.nodesRef.current, initial.edgesRef.current);
    let board = this.boards.get(workspace.id);
    if (!board) {
      board = { workspace: { ...workspace, nodes: initial.nodesRef.current, edges: initial.edgesRef.current }, jobs: 0, revision: 0, savedRevision: 0, aborted: {}, save: initial.saveTaskWorkspace };
      this.boards.set(workspace.id, board);
    }
    const owner = board;
    owner.jobs++;
    const foreground = () => {
      const current = getContext();
      return (current.activeWorkspaceRef ? current.activeWorkspaceRef.current : current.activeWorkspace)?.id === workspace.id;
    };
    const read = () => {
      if (foreground()) {
        const current = getContext();
        this.capture(current.activeWorkspaceRef ? current.activeWorkspaceRef.current : current.activeWorkspace, current.nodesRef.current, current.edgesRef.current);
      }
      return owner.workspace;
    };
    const alive = () => this.boards.get(workspace.id) === owner && read().nodes.some(node => node.id === nodeId);
    const changed = () => {
      owner.revision++;
      if (!foreground()) void this.flush(owner);
    };
    const setNodes: SynthesisActionsContext["setNodes"] = value => {
      if (!alive()) return;
      const next = typeof value === "function" ? value(read().nodes) : value;
      owner.workspace = { ...owner.workspace, nodes: next };
      if (foreground()) { initial.nodesRef.current = next; initial.setNodes(next); }
      changed();
    };
    const setEdges: SynthesisActionsContext["setEdges"] = value => {
      if (!alive()) return;
      const next = typeof value === "function" ? value(read().edges) : value;
      owner.workspace = { ...owner.workspace, edges: next };
      if (foreground()) { initial.edgesRef.current = next; initial.setEdges(next); }
      changed();
    };
    const headers = { ...initial.getApiHeaders(false) };
    const context: SynthesisActionsContext & { finishTask: () => Promise<void> } = {
      ...initial,
      activeWorkspace: owner.workspace,
      activeWorkspaceRef: { current: owner.workspace },
      providerOptionsRef: { current: { ...initial.providerOptionsRef.current } },
      vocalAbortMapRef: { current: owner.aborted },
      nodesRef: {
        get current() { return alive() ? read().nodes : []; },
        set current(value) {
          if (!alive()) return;
          owner.workspace = { ...owner.workspace, nodes: value };
          if (foreground()) initial.nodesRef.current = value;
        },
      },
      edgesRef: {
        get current() { return alive() ? read().edges : []; },
        set current(value) {
          if (!alive()) return;
          owner.workspace = { ...owner.workspace, edges: value };
          if (foreground()) initial.edgesRef.current = value;
        },
      },
      patchNode: (id, patch) => {
        if (!alive()) return;
        if (patch.isRunning === false) owner.aborted[id] = true;
        if (foreground()) { initial.patchNode(id, patch); read(); }
        else owner.workspace = { ...owner.workspace, nodes: read().nodes.map(node => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node) };
        changed();
      },
      setNodes,
      setEdges,
      saveWorkspace: async (nodes, edges) => {
        if (!alive()) return;
        if (nodes) owner.workspace = { ...owner.workspace, nodes };
        if (edges) owner.workspace = { ...owner.workspace, edges };
        owner.revision++;
        await this.flush(owner);
      },
      getApiHeaders: (isJson, extra) => {
        if (!alive()) throw new Error("源节点已删除，后续生成已停止。");
        return { ...headers, ...(isJson ? { "Content-Type": "application/json" } : {}), ...extra };
      },
      finishTask: async () => {
        if (alive()) { read(); owner.revision++; await this.flush(owner); }
        owner.jobs--;
        if (foreground() && !owner.jobs && owner.savedRevision === owner.revision) this.boards.delete(workspace.id);
      },
    };
    return context;
  }
}
