import { AlertTriangle, Sparkles, Trash2, Info } from "lucide-react";

export interface AppleConfirmDialogProps {
  appleConfirmState: { isOpen: boolean; title: string; message?: string; confirmLabel: string; cancelLabel: string; isDestructive: boolean; icon: "trash" | "warning" | "info" | "sparkles"; resolve: (val: boolean) => void; } | null;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (e: React.MouseEvent<HTMLDivElement>, onClose: () => void) => void;
  handleAppleConfirmClose: (result: boolean) => void;
}

export function AppleConfirmDialog({ appleConfirmState, handleBackdropMouseDown, handleBackdropClick, handleAppleConfirmClose }: AppleConfirmDialogProps) {
  return (<>{appleConfirmState?.isOpen && (
    <div
      className="apple-modal-overlay"
      onMouseDown={handleBackdropMouseDown}
      onClick={(e) => handleBackdropClick(e, () => handleAppleConfirmClose(false))}
    >
      <div
        className="apple-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="apple-confirm-badge-wrap">
          <div className={`apple-confirm-icon-badge ${appleConfirmState.isDestructive ? "destructive" : "accent"}`}>
            {appleConfirmState.icon === "trash" ? (
              <Trash2 size={24} />
            ) : appleConfirmState.icon === "info" ? (
              <Info size={24} />
            ) : appleConfirmState.icon === "sparkles" ? (
              <Sparkles size={24} />
            ) : (
              <AlertTriangle size={24} />
            )}
          </div>
        </div>

        <div className="apple-confirm-content">
          <h3 className="apple-confirm-title">{appleConfirmState.title}</h3>
          {appleConfirmState.message ? (
            <p className="apple-confirm-message">{appleConfirmState.message}</p>
          ) : null}
        </div>

        <div className="apple-confirm-actions">
          <button
            type="button"
            className="apple-confirm-btn cancel"
            onClick={() => handleAppleConfirmClose(false)}
            autoFocus
          >
            {appleConfirmState.cancelLabel}
          </button>
          <button
            type="button"
            className={`apple-confirm-btn confirm ${appleConfirmState.isDestructive ? "destructive" : "primary"}`}
            onClick={() => handleAppleConfirmClose(true)}
          >
            {appleConfirmState.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )}</>);
}
