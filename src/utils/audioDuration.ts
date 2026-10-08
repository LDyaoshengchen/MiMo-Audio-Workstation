/**
 * 高性能音频时长解析与缓存工具
 * 专门解决 Chromium/Electron 对 Data URL / Blob 及多音频画板无法即时读取 duration 的问题
 */

const durationCache = new Map<string, number>();

/**
 * 从二进制字节中极速提取 WAV 音频时长（微秒级纯 CPU 计算，无需 WebAudio 解码）
 * 支持标准 44 字节 WAV 及含 bext/LIST/id3 等附加块的复合 WAV 格式
 */
export function parseWavDurationFromBytes(bytes: Uint8Array, totalBytes?: number): number | null {
  if (bytes.length < 24) return null;

  // 1. 检查 "RIFF" 标识
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
    return null;
  }

  // 2. 检查 "WAVE" 标识
  if (bytes[8] !== 0x57 || bytes[9] !== 0x41 || bytes[10] !== 0x56 || bytes[11] !== 0x45) {
    return null;
  }

  const riffSize = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
  let byteRate = 0;
  let dataSize = 0;
  let dataOffset = 0;
  let offset = 12;

  // 3. 遍历 RIFF 块 (fmt, data, bext, LIST, JUNK 等)
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;

    if (chunkId === "fmt ") {
      if (offset + 8 + 16 <= bytes.length) {
        byteRate = (bytes[offset + 16] | (bytes[offset + 17] << 8) | (bytes[offset + 18] << 16) | (bytes[offset + 19] << 24)) >>> 0;
      }
    } else if (chunkId === "data") {
      dataSize = chunkSize;
      dataOffset = offset + 8;
      break;
    }

    if (chunkSize === 0 && offset + 8 >= bytes.length) break;
    offset += 8 + chunkSize;
    // RIFF 规范要求按字 (word, 2 bytes) 对齐
    if (chunkSize % 2 !== 0) {
      offset += 1;
    }
  }

  // 4. 计算真实时长
  if (byteRate > 0) {
    // 如果 dataSize 头部标为 0 或未完整指定，尝试利用文件总长或 RIFF 总长估算
    if (dataSize <= 0) {
      if (totalBytes && dataOffset > 0 && totalBytes > dataOffset) {
        dataSize = totalBytes - dataOffset;
      } else if (riffSize > 0 && dataOffset > 0 && riffSize + 8 > dataOffset) {
        dataSize = riffSize + 8 - dataOffset;
      }
    }
    if (dataSize > 0) {
      const duration = dataSize / byteRate;
      if (Number.isFinite(duration) && duration > 0 && duration < 86400) {
        return duration;
      }
    }
  }

  return null;
}

/**
 * 针对 data:audio/wav 极速首屏同步解析（截取前 2048 个 Base64 字符即可完成头部读取）
 * 在组件初始化阶段 0ms 同步返回，避免首屏 0:00 闪烁
 */
export function getAudioDurationFast(src: string): number | null {
  if (!src || typeof src !== "string") return null;

  if (durationCache.has(src)) {
    return durationCache.get(src)!;
  }

  if (src.startsWith("data:")) {
    const commaIndex = src.indexOf(",");
    if (commaIndex === -1) return null;

    const meta = src.slice(0, commaIndex).toLowerCase();
    const isWav = meta.includes("wav") || meta.includes("wave");

    // 截取前 2048 个字符（相当于 1.5KB 二进制），已足足包含包括扩展块在内的全部 WAV 头部
    const base64Sample = src.slice(commaIndex + 1, commaIndex + 1 + 2048);
    const totalBase64Len = src.length - commaIndex - 1;
    const estTotalBytes = Math.floor(totalBase64Len * 0.75);

    try {
      const atobFn = typeof window !== "undefined" && window.atob
        ? window.atob.bind(window)
        : (s: string) => Buffer.from(s, "base64").toString("binary");
      const binary = atobFn(base64Sample);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // 如果是 wav 或明确带有 RIFF 标识
      if (isWav || (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)) {
        const dur = parseWavDurationFromBytes(bytes, estTotalBytes);
        if (dur !== null && dur > 0) {
          durationCache.set(src, dur);
          return dur;
        }
      }
    } catch {
      // 容错忽略
    }
  }

  return null;
}

export function getCachedAudioDuration(src: string): number | undefined {
  return durationCache.get(src);
}

export function setCachedAudioDuration(src: string, duration: number): void {
  if (src && Number.isFinite(duration) && duration > 0) {
    durationCache.set(src, duration);
  }
}

/**
 * 完整异步时长解析（支持 WebAudio 解码与 HTML5 Audio 探针兜底，含 Chromium Infinity 规避）
 */
export async function resolveAudioDuration(src: string): Promise<number | null> {
  if (!src) return null;

  // 1. 优先查缓存
  const cached = durationCache.get(src);
  if (cached && cached > 0) return cached;

  // 2. 尝试极速 WAV 头部解析
  const fast = getAudioDurationFast(src);
  if (fast && fast > 0) {
    durationCache.set(src, fast);
    return fast;
  }

  // 3. 如果是 Data URL 且环境支持 WebAudio，使用 AudioContext 解码
  if (src.startsWith("data:") && typeof window !== "undefined") {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const commaIdx = src.indexOf(",");
        const base64 = commaIdx >= 0 ? src.slice(commaIdx + 1) : src;
        const atobFn = window.atob ? window.atob.bind(window) : (s: string) => Buffer.from(s, "base64").toString("binary");
        const binary = atobFn(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const ctx = new AudioCtx();
        try {
          const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
          if (buffer && Number.isFinite(buffer.duration) && buffer.duration > 0) {
            durationCache.set(src, buffer.duration);
            return buffer.duration;
          }
        } finally {
          void ctx.close().catch(() => {});
        }
      }
    } catch {
      // 忽略继续后备方案
    }
  }

  // 4. HTML5 Audio 元素兜底探测（含 Chromium Infinity 修复）
  if (typeof window !== "undefined" && typeof Audio !== "undefined") {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = "auto";
      let resolved = false;

      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.ondurationchange = null;
        audio.ontimeupdate = null;
        audio.oncanplay = null;
        audio.onerror = null;
        audio.src = "";
      };

      const finish = (dur: number) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (Number.isFinite(dur) && dur > 0 && dur < 86400) {
          durationCache.set(src, dur);
          resolve(dur);
        } else {
          resolve(null);
        }
      };

      const timer = window.setTimeout(() => finish(0), 4000);

      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          window.clearTimeout(timer);
          finish(audio.duration);
        } else if (audio.duration === Infinity) {
          // 触发 Chromium seek 探针
          try {
            audio.currentTime = 1e10;
          } catch {}
        }
      };

      audio.ondurationchange = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          window.clearTimeout(timer);
          finish(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        if (audio.currentTime >= 1e9) {
          const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : audio.currentTime;
          if (d > 0 && d < 1e9) {
            window.clearTimeout(timer);
            finish(d);
          }
        }
      };

      audio.oncanplay = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          window.clearTimeout(timer);
          finish(audio.duration);
        }
      };

      audio.onerror = () => {
        window.clearTimeout(timer);
        finish(0);
      };

      audio.src = src;
    });
  }

  return null;
}
