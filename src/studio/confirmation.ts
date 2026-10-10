

export interface AppleConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  icon?: "trash" | "warning" | "info" | "sparkles";
}

let globalAppleConfirmHandler: ((opts: AppleConfirmOptions) => Promise<boolean>) | null = null;

export function showAppleConfirm(opts: AppleConfirmOptions): Promise<boolean> {
  if (globalAppleConfirmHandler) {
    return globalAppleConfirmHandler(opts);
  }
  return Promise.resolve(window.confirm(`${opts.title}\n\n${opts.message || ""}`));
}

export function setAppleConfirmHandler(handler: typeof globalAppleConfirmHandler) {
  globalAppleConfirmHandler = handler;
}
