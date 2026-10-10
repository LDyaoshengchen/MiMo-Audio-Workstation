import type { WorkspaceSummary } from "../../types/studio";
import { Copy, X, AlertTriangle } from "lucide-react";
import { useState, useRef } from "react";

export function SaveAsModal({
  workspace,
  onClose,
  onConfirm
}: {
  workspace: WorkspaceSummary;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
}) {
  const [name, setName] = useState(`${workspace.name} 副本`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("画板名称不能为空");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "另存为失败");
      setIsSubmitting(false);
    }
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="api-key-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <Copy size={18} />
            另存为新画板
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="api-key-modal-body">
            <p className="api-key-modal-hint">原画板：{workspace.name}</p>
            <p className="api-key-modal-hint">请输入新画板的名称：</p>
            <input
              type="text"
              className="api-key-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="新画板名称"
              autoFocus
            />
            {error && (
              <p className="api-key-modal-warn">
                <AlertTriangle size={14} />
                {error}
              </p>
            )}
          </div>
          <div className="api-key-modal-footer">
            <button type="button" className="api-key-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              取消
            </button>
            <button type="submit" className="api-key-btn-save" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "确定另存为"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
