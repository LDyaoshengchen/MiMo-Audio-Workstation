import { createZipInstance } from "./zipUtils";
import { fetchAudioBytes } from "./audioExport";

export type AudioExportItem = { name: string; source: string };
export async function buildAudioZip(items: AudioExportItem[], options: {
  signal?: AbortSignal; onProgress?: (percent: number) => void; maxBytes?: number;
} = {}) {
  if (!items.length) throw new Error("没有可导出的音频。");
  const zip = await createZipInstance();
  let totalBytes = 0;
  const maxBytes = options.maxBytes ?? 256 * 1024 * 1024;
  for (let index = 0; index < items.length; index++) {
    options.signal?.throwIfAborted();
    const item = items[index];
    try {
      const bytes = await fetchAudioBytes(item.source, options.signal);
      totalBytes += bytes.byteLength;
      if (totalBytes > maxBytes) throw new Error("音频总量超过 256MB 安全上限，请分批导出。");
      zip.file(item.name, bytes);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new Error(`导出失败：${item.name}；${error instanceof Error ? error.message : "读取异常"}`);
    }
    options.onProgress?.(Math.round((index + 1) / items.length * 80));
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, metadata => {
    options.onProgress?.(Math.round(80 + metadata.percent * 0.2));
  });
  // JSZip 不支持中途终止压缩，取消后丢弃结果，不触发下载。
  options.signal?.throwIfAborted();
  options.onProgress?.(100);
  return blob;
}
