import type { SynthesisActionsContext } from "./synthesisActions";

const runningTasks = new Map<string | undefined, number>();

export function taskWorkspaceId(context: SynthesisActionsContext) {
  return (context.activeWorkspaceRef ? context.activeWorkspaceRef.current : context.activeWorkspace)?.id;
}

export function hasActiveNodeTasks(workspaceId: string | undefined) {
  return (runningTasks.get(workspaceId) || 0) > 0;
}

export function beginNodeTask(workspaceId: string | undefined) {
  runningTasks.set(workspaceId, (runningTasks.get(workspaceId) || 0) + 1);
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    const remaining = (runningTasks.get(workspaceId) || 1) - 1;
    if (remaining > 0) runningTasks.set(workspaceId, remaining);
    else runningTasks.delete(workspaceId);
  };
}

/** In-flight jobs may never mutate a different board or a deleted source. */
export function scopeNodeTask(getContext: () => SynthesisActionsContext, nodeId: string): SynthesisActionsContext & { finishTask?: () => Promise<void> } {
  const initial = getContext();
  const background = initial.workspaceTasks?.scope(initial, getContext, nodeId);
  if (background) return background;
  const workspaceId = taskWorkspaceId(initial);
  const active = () => {
    const current = getContext();
    return taskWorkspaceId(current) === workspaceId && current.nodesRef.current.some(node => node.id === nodeId);
  };
  return {
    ...initial,
    nodesRef: {
      get current() { return active() ? getContext().nodesRef.current : []; },
      set current(value) { if (active()) getContext().nodesRef.current = value; },
    },
    edgesRef: {
      get current() { return active() ? getContext().edgesRef.current : []; },
      set current(value) { if (active()) getContext().edgesRef.current = value; },
    },
    patchNode: (id, patch) => { if (active()) initial.patchNode(id, patch); },
    setNodes: value => { if (active()) initial.setNodes(value); },
    setEdges: value => { if (active()) initial.setEdges(value); },
    saveWorkspace: async (...args) => { if (active()) await initial.saveWorkspace(...args); },
    getApiHeaders: (...args) => {
      if (!active()) throw new Error("画板或源节点已改变，后续生成已停止。");
      return initial.getApiHeaders(...args);
    },
  };
}
