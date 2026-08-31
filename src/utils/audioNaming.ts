/**
 * 音频命名与文件名清洗工具
 */

export function sanitizeFileName(name: string): string {
  return (name || "").replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
}

export function getFileExtension(fileName: string): string {
  const match = sanitizeFileName(fileName).match(/(\.[a-z0-9]{1,8})$/i);
  return match?.[1] ?? ".wav";
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
    const safeWsName = sanitizeFileName(workspaceName.trim());
    if (safeTitle.startsWith(safeWsName)) {
      return `${safeTitle}${ext}`;
    }
    return `${safeWsName}_${safeTitle}${ext}`;
  }
  return `${safeTitle}${ext}`;
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
