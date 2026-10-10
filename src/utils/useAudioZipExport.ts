import { useEffect, useRef, useState } from "react";
import { buildAudioZip, type AudioExportItem } from "./buildAudioZip";

export function useAudioZipExport() {
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function download(items: AudioExportItem[], name: string) {
    if (controller.current) return;
    const current = new AbortController(); controller.current = current; setProgress(0);
    try {
      const blob = await buildAudioZip(items, { signal: current.signal, onProgress: percent => { if (!current.signal.aborted) setProgress(percent); } });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = name;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!current.signal.aborted) alert(error instanceof Error ? error.message : "音频导出失败。");
    } finally { controller.current = null; setProgress(null); }
  }
  return { progress, isZipping: progress !== null, download, cancel: () => controller.current?.abort() };
}
