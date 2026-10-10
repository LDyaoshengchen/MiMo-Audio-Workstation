import type { WorkspaceSummary } from "../../types/studio";
import { LayoutTemplate, X, AlertTriangle } from "lucide-react";
import { useState, useRef } from "react";

export function SaveAsTemplateModal({
  workspace,
  onClose,
  onConfirm
}: {
  workspace: WorkspaceSummary;
  onClose: () => void;
  onConfirm: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(`${workspace.name} 模板`);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("模板名称不能为空");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmedName, description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存为模板失败");
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
            <LayoutTemplate size={18} />
            存为画板模板
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="api-key-modal-body">
            <p className="api-key-modal-hint">原画板：{workspace.name}</p>
            <label className="node-field">
              <span>模板名称：</span>
              <input
                type="text"
                className="api-key-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="模板名称"
                autoFocus
              />
            </label>
            <label className="node-field" style={{ marginTop: 10 }}>
              <span>模板说明（可选）：</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简短说明该模板适用场景和流程结构..."
                rows={3}
              />
            </label>
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
              {isSubmitting ? "保存中..." : "存为模板"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
