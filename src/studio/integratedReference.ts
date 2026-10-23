import type { StudioNode, StudioEdge } from "../types/studio";
import type { BatchVoiceCloneRow } from "../types/studioAudio";
import type { ProviderOptions } from "../utils/providerConfig";
import { getAssetVoiceId } from "../utils/providerConfig";
import { resolveCloneInputs } from "./graph";

export function resolveIntegratedReference(node: StudioNode, row: BatchVoiceCloneRow, nodes: StudioNode[], edges: StudioEdge[], options: ProviderOptions, headers: Record<string, string>) {
  // Old rows with their own reference remain usable; newly edited rows record intent explicitly.
  const mode = row.referenceMode ?? (row.refAudioUrl && row.refAudioUrl !== node.data.refAudioUrl ? "audio" : "inherit");
  const explicit = mode === "audio" || mode === "none";
  const audioSource = (dataUrl: string, fileName?: string) => ({
    dataUrl,
    fileName: fileName || "ref.wav",
    mimeType: dataUrl.match(/^data:([^;,]+)/)?.[1] || "audio/wav",
  });
  let source;
  if (mode !== "none") {
    if (row.refAudioUrl) source = audioSource(row.refAudioUrl, row.refAudioName);
    else if (mode !== "audio") {
      source = node.data.refAudioUrl
        ? audioSource(node.data.refAudioUrl, node.data.refAudioName)
        : resolveCloneInputs(node, nodes, edges).audio;
    }
  }
  const voiceId = explicit ? undefined : getAssetVoiceId(node.data, headers);
  return { audio: source, voiceId, options: mode === "audio" ? { ...options, synthesisMode: "reference" as const } : options };
}
