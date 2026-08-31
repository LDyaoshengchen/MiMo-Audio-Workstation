/**
 * 服务端音频缓存命名与安全校验工具
 */

export function sanitizeFileName(name: string): string {
  return (name || "").replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
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

/**
 * 校验并清洗 API Endpoint URL，防止非法协议或向非本地内网/恶意网址发送凭据
 */
export function validateAndSanitizeEndpoint(endpoint: string): string {
  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("API Endpoint 不能为空");
  }
  const trimmed = endpoint.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`非法的 API Endpoint 格式: ${trimmed}`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`API Endpoint 协议仅支持 http: 或 https:，不支持 ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  // If remote (non-loopback), enforce HTTPS to ensure API Key is encrypted in transit
  if (!isLoopback && url.protocol !== "https:") {
    throw new Error("远程 API Endpoint 必须使用安全的 HTTPS 加密连接");
  }

  return trimmed;
}
