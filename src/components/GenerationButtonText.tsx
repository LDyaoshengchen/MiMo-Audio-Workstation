import type { NodeData } from "../types/studio";
export function GenerationButtonText({ data, idle, running = "生成中...", batch }: { data: NodeData; idle: string; running?: string; batch?: boolean }) {
  const progress = data.generationProgress;
  const showProgress = progress && (batch === undefined || (progress.total > 1) === batch);
  return <span role={data.isRunning && showProgress ? "status" : undefined}>{data.isRunning && showProgress ? `完成 ${progress.completed}/${progress.total}` : data.isRunning ? running : idle}</span>;
}
