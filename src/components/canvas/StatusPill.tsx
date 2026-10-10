import { Key } from "lucide-react";

export function StatusPill({ apiKey, serverConfigured, onOpenModal }: { apiKey: string; serverConfigured?: boolean; onOpenModal: () => void }) {
  const isCustomConfigured = Boolean(apiKey && apiKey.trim());
  const isConfigured = isCustomConfigured || Boolean(serverConfigured);
  const masked = isCustomConfigured
    ? (apiKey.length > 8 ? `${apiKey.slice(0, 3)}***${apiKey.slice(-4)}` : "***")
    : (serverConfigured ? "已就绪 (.env/服务端)" : "未配置");
  return (
    <button className={`status-pill ${isConfigured ? "good" : "warn"}`} type="button" onClick={onOpenModal}>
      <Key size={14} />
      <span>API Key: {masked}</span>
    </button>
  );
}
