import { Download } from "lucide-react";
import { getSingleArtifactDownloadFileName, type SingleDownloadSettings } from "../utils/downloadSettings";

/** 三种产物界面使用同一下载入口，避免某个按钮遗漏命名设置。 */
export function SingleArtifactDownloadLink({ title, fileName, audioDataUrl, workspaceName, createdAt, settings, className = "download-link nodrag", iconSize = 15 }: {
  title: string; fileName: string; audioDataUrl: string; workspaceName?: string; createdAt: string;
  settings?: SingleDownloadSettings; className?: string; iconSize?: number;
}) {
  return <a className={className} href={audioDataUrl}
    download={getSingleArtifactDownloadFileName(title, fileName, workspaceName, createdAt, settings)}
    title="单条下载" style={{ textDecoration: "none" }}>
    <Download size={iconSize} style={{ flexShrink: 0 }} /><span>下载</span>
  </a>;
}
