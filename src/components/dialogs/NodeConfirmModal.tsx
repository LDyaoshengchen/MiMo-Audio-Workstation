import { Trash2 } from "lucide-react";
import { useRef, useEffect } from "react";

export interface NodeConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NodeConfirmModal({
  options
}: {
  options: NodeConfirmOptions;
}) {
  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        options.onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);

  return (
    <div
      className="node-modal-backdrop nodrag nopan nowheel"
      onMouseDown={(e) => {
        backdropMouseDownRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          options.onCancel();
        }
      }}
    >
      <div
        className="apple-confirm-dialog node-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        style={{ maxWidth: 330, padding: "22px 20px 18px 20px" }}
      >
        <div className="apple-confirm-badge-wrap" style={{ marginBottom: 12 }}>
          <div className="apple-confirm-icon-badge destructive" style={{ width: 48, height: 48 }}>
            <Trash2 size={22} />
          </div>
        </div>

        <div className="apple-confirm-content" style={{ marginBottom: 18 }}>
          <h3 className="apple-confirm-title" style={{ fontSize: 15, marginBottom: 6 }}>
            {options.title}
          </h3>
          {options.message ? (
            <p className="apple-confirm-message" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {options.message}
            </p>
          ) : null}
        </div>

        <div className="apple-confirm-actions" style={{ gap: 8 }}>
          <button
            type="button"
            className="apple-confirm-btn cancel"
            style={{ height: 34, fontSize: 13 }}
            onClick={options.onCancel}
            autoFocus
          >
            {options.cancelLabel || "取消"}
          </button>
          <button
            type="button"
            className="apple-confirm-btn confirm destructive"
            style={{ height: 34, fontSize: 13 }}
            onClick={options.onConfirm}
          >
            {options.confirmLabel || "清空"}
          </button>
        </div>
      </div>
    </div>
  );
}
