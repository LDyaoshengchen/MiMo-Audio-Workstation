/**
 * 音频命名与文件名清洗工具
 */

export function sanitizeFileName(name: string): string {
  return (name || "").replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
}

/** 画板产物统一基础名：自定义节点名 + 行名 + 序号，默认标题不参与命名。 */
export function formatHierarchyName(parentTitle?: string, nodeTitle?: string, seqIndex?: number): string {
  const normalize = (value?: string) => (value || "").trim().replace(/[:：\s]+/g, "_");
  const placeholders = new Set(["节点名称", "批量节点", "音频克隆", "音色创造", "全能综合工作台", "全能综合台", "全能工作台"]);
  let parent = normalize(parentTitle);
  let row = normalize(nodeTitle);
  if (placeholders.has(parent)) parent = "";
  if (row === "节点名称" || row === "产物节点") row = "";
  const base = parent && row ? mergeWorkspaceTitle(parent, row) : parent || row || "产物";
  return seqIndex === undefined ? base : `${base}_${String(seqIndex).padStart(2, "0")}`;
}

export function getFileExtension(fileName: string): string {
  const match = sanitizeFileName(fileName).match(/(\.[a-z0-9]{1,8})$/i);
  return match?.[1] ?? ".wav";
}

export function getAudioFileExtension(source: string, fileName?: string): string {
  const mime = source.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
  if (mime === "audio/mpeg" || mime === "audio/mp3") return ".mp3";
  if (mime && ["audio/wav", "audio/x-wav", "audio/wave"].includes(mime)) return ".wav";
  const sourceExt = source.split(/[?#]/)[0].match(/\.(mp3|wav)$/i)?.[0];
  return sourceExt?.toLowerCase() || getFileExtension(fileName || "");
}

export function buildCleanAudioCacheFileName(
  title: string | undefined,
  fallbackPrefix: string,
  id: string | number | undefined,
  originalFileName?: string,
  workspaceName?: string
): string {
  const ext = (originalFileName && originalFileName.match(/\.[a-z0-9]{1,8}$/i)?.[0]) || ".wav";

  let baseTitle = "";
  if (title && title.trim()) {
    baseTitle = sanitizeFileName(title.trim()).replace(/\.[a-z0-9]{1,8}$/i, "");
  }

  if (!baseTitle && originalFileName) {
    const safeOrig = sanitizeFileName(originalFileName).replace(/\.[a-z0-9]{1,8}$/i, "");
    if (safeOrig && !safeOrig.startsWith("mimo-") && !safeOrig.startsWith("data:")) {
      baseTitle = safeOrig;
    }
  }

  if (!baseTitle) {
    baseTitle = fallbackPrefix;
  }

  const shortId = id ? `_${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-6)}` : `_${Date.now().toString().slice(-6)}`;
  return `${baseTitle}${shortId}${ext}`;
}

export function getArtifactDownloadFileName(title: string, originalFileName: string, workspaceName?: string): string {
  const safeTitle = sanitizeFileName(title).replace(/\.[a-z0-9]{1,8}$/i, "") || "audio";
  const ext = getFileExtension(originalFileName);
  if (workspaceName && workspaceName.trim()) {
    return `${mergeWorkspaceTitle(workspaceName, safeTitle)}${ext}`;
  }
  return `${safeTitle}${ext}`;
}

/** 按完整名称片段合并：包含的名称只保留一次，末尾与开头重合的部分也只保留一次。 */
export function mergeWorkspaceTitle(workspaceName: string, title: string): string {
  const normalize = (value: string) => sanitizeFileName(value).replace(/[:：\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const workspace = normalize(workspaceName);
  const file = normalize(title);
  if (!workspace) return file;
  if (!file) return workspace;
  const w = workspace.split("_");
  const f = file.split("_");
  const contains = (whole: string[], part: string[]) => whole.some((_, i) => whole.slice(i, i + part.length).join("_") === part.join("_"));
  if (contains(f, w)) return file;
  if (contains(w, f)) return workspace;
  for (let count = Math.min(w.length, f.length); count > 0; count--) {
    if (w.slice(-count).join("_") === f.slice(0, count).join("_")) return [...w, ...f.slice(count)].join("_");
  }
  // 中文名称可能没有分隔符，例如“酒馆对白”与“对白_01”。
  for (let count = Math.min(workspace.length, file.length); count >= 2; count--) {
    const overlap = workspace.slice(-count);
    if (/[\u3400-\u9fff]/.test(overlap) && file.startsWith(overlap)) return workspace + file.slice(count);
  }
  return `${workspace}_${file}`;
}

export async function audioSourceToFile(source: string, fileName: string, mimeType?: string): Promise<File> {
  if (!source) {
    throw new Error("参考音频源为空");
  }

  if (source.startsWith("data:")) {
    const [meta, base64] = source.split(",");
    const resolvedMime = mimeType || meta.match(/data:(.*);base64/)?.[1] || "audio/wav";
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], fileName, { type: resolvedMime });
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`无法读取本地缓存参考音频 (${source}): HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const resolvedMime = mimeType || blob.type || "audio/wav";
  return new File([blob], fileName, { type: resolvedMime });
}

export async function audioSourceToBlob(source: string, mimeType?: string): Promise<Blob> {
  if (!source) {
    return new Blob([], { type: mimeType || "audio/wav" });
  }

  if (source.startsWith("data:")) {
    const [meta, base64] = source.split(",");
    const resolvedMime = mimeType || meta.match(/data:(.*);base64/)?.[1] || "audio/wav";
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: resolvedMime });
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`无法读取本地缓存音频 (${source}): HTTP ${response.status}`);
  }
  return await response.blob();
}

export function buildApiHeaders(config: {
  apiKey?: string;
  apiEndpoint?: string;
  apiProvider?: string;
  customProtocol?: string;
  appId?: string;
  accessToken?: string;
  isJson?: boolean;
  extraHeaders?: Record<string, string>;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (config.isJson) {
    headers["Content-Type"] = "application/json";
  }
  if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
  }
  if (config.apiEndpoint) {
    headers["X-API-Endpoint"] = config.apiEndpoint;
  }
  if (config.apiProvider) {
    headers["X-API-Provider"] = config.apiProvider;
  }
  if (config.customProtocol && config.apiProvider === "custom") {
    headers["X-API-Custom-Protocol"] = config.customProtocol;
  }
  if (config.appId && (config.apiProvider === "volcengine" || config.apiProvider === "custom")) {
    headers["X-API-AppId"] = config.appId;
  }
  if (config.accessToken && (config.apiProvider === "volcengine" || config.apiProvider === "custom")) {
    headers["X-API-AccessToken"] = config.accessToken;
  }
  if (config.extraHeaders) {
    Object.assign(headers, config.extraHeaders);
  }
  return headers;
}
