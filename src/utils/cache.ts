import type { WorkspacePayload, StudioNode } from "../App";

/**
 * 过滤音频 URL：保留轻量的后端缓存路由路径 (/api/...)，剔除大体积 base64 与超长字符
 */
export function sanitizeAudioUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  if (url.startsWith("data:") || url.length > 500) {
    return "";
  }
  return url;
}

/**
 * 剔除大体积 Base64 音频，将几兆/十兆工作区精简为几十 KB 极速存入 localStorage，实现首屏 0 秒白屏秒开
 */
export function stripHeavyDataForCache(ws: WorkspacePayload | null): WorkspacePayload | null {
  if (!ws || ws.type !== "board") return ws;

  const lightNodes = (ws.nodes || []).map((node: StudioNode) => {
    if (!node.data) return node;
    const d: Record<string, unknown> = { ...(node.data as Record<string, unknown>) };

    // 1. 基础音频字段
    if (d.audioDataUrl) d.audioDataUrl = sanitizeAudioUrl(d.audioDataUrl);
    if (d.refAudioUrl) d.refAudioUrl = sanitizeAudioUrl(d.refAudioUrl);

    // 2. 单个参考音频
    if (d.audio && typeof d.audio === "object") {
      const audioObj = d.audio as Record<string, unknown>;
      d.audio = {
        ...audioObj,
        dataUrl: sanitizeAudioUrl(audioObj.dataUrl) || ""
      };
    }

    // 3. 多样本参考音频列表 audioAssets
    if (Array.isArray(d.audioAssets)) {
      d.audioAssets = d.audioAssets.map((asset) => {
        if (!asset || typeof asset !== "object") return asset;
        const a = asset as Record<string, unknown>;
        return {
          ...a,
          dataUrl: sanitizeAudioUrl(a.dataUrl) || ""
        };
      });
    }

    // 4. 参考音频 referenceAudios
    if (Array.isArray(d.referenceAudios)) {
      d.referenceAudios = d.referenceAudios.map((ra) => {
        if (!ra || typeof ra !== "object") return ra;
        const rad = ra as Record<string, unknown>;
        return {
          ...rad,
          audioDataUrl: sanitizeAudioUrl(rad.audioDataUrl) || ""
        };
      });
    }

    // 5. 单个产物节点 artifact
    if (d.artifact && typeof d.artifact === "object") {
      const art = d.artifact as Record<string, unknown>;
      d.artifact = {
        ...art,
        audioDataUrl: sanitizeAudioUrl(art.audioDataUrl) || ""
      };
    }

    // 6. 批量产物列表 batchArtifacts
    if (Array.isArray(d.batchArtifacts)) {
      d.batchArtifacts = d.batchArtifacts.map((ba) => {
        if (!ba || typeof ba !== "object") return ba;
        const bad = ba as Record<string, unknown>;
        return {
          ...bad,
          audioDataUrl: sanitizeAudioUrl(bad.audioDataUrl) || ""
        };
      });
    }

    // 7. 批量行生成行 batchRows
    if (Array.isArray(d.batchRows)) {
      d.batchRows = d.batchRows.map((r) => {
        if (!r || typeof r !== "object") return r;
        const row = { ...(r as Record<string, unknown>) };
        if (row.refAudioUrl) row.refAudioUrl = sanitizeAudioUrl(row.refAudioUrl);
        if (Array.isArray(row.artifacts)) {
          row.artifacts = row.artifacts.map((art) => {
            if (!art || typeof art !== "object") return art;
            const a = art as Record<string, unknown>;
            return {
              ...a,
              audioDataUrl: sanitizeAudioUrl(a.audioDataUrl) || ""
            };
          });
        }
        return row;
      });
    }

    return { ...node, data: d as StudioNode["data"] };
  });

  const lightStash = (ws.stashItems || []).map((stash: any) => {
    if (!stash || typeof stash !== "object") return stash;
    return {
      ...stash,
      audioDataUrl: sanitizeAudioUrl(stash.audioDataUrl) || ""
    };
  });

  return {
    ...ws,
    nodes: lightNodes,
    stashItems: lightStash
  };
}
