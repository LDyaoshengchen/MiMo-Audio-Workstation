export function ZipExportProgress({ progress, onCancel }: { progress: number | null; onCancel: () => void }) {
  if (progress === null) return null;
  return <div className="zip-export-progress nodrag" role="status">
    <progress value={progress} max={100} aria-label="音频打包进度" /><span>{progress}%</span>
    <button type="button" onClick={onCancel}>取消</button>
  </div>;
}
