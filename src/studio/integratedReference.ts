import type { StudioNode, StudioEdge } from "../types/studio";
import type { BatchVoiceCloneRow } from "../types/studioAudio";
import type { ProviderOptions } from "../utils/providerConfig";
import { getAssetVoiceId } from "../utils/providerConfig";
import { MIMO_PRESET_TTS_MODEL } from "./mimoPresetVoices";
import { resolveCloneInputs } from "./graph";

export function resolveIntegratedReference(node: StudioNode, row: BatchVoiceCloneRow, nodes: StudioNode[], edges: StudioEdge[], options: ProviderOptions, headers: Record<string, string>) {
  // Old rows with their own reference remain usable; newly edited rows record intent explicitly.
  const mode = row.referenceMode ?? (row.refAudioUrl && row.refAudioUrl !== node.data.refAudioUrl ? "audio" : "inherit");
  const explicit = mode === "audio" || mode === "none";
  const inheritedInputs = resolveCloneInputs(node, nodes, edges);
  const audioSource = (dataUrl: string, fileName?: string) => ({
    dataUrl,
    fileName: fileName || "ref.wav",
    mimeType: dataUrl.match(/^data:([^;,]+)/)?.[1] || "audio/wav",
  });
  let source;
  if (mode !== "none") {
    if (row.refAudioUrl) source = audioSource(row.refAudioUrl, row.refAudioName);
    else if (mode !== "audio") {
      source = inheritedInputs.voiceAssetMode === "preset" ? undefined : node.data.refAudioUrl ? audioSource(node.data.refAudioUrl, node.data.refAudioName) : inheritedInputs.audio;
    }
  }
  const voiceId = explicit ? undefined : getAssetVoiceId({ voiceId: inheritedInputs.voiceId ?? node.data.voiceId, assetProvider: inheritedInputs.assetProvider ?? node.data.assetProvider }, headers);
  const voiceAssetMode = explicit ? undefined : inheritedInputs.voiceAssetMode ?? node.data.voiceAssetMode;
  const synthesisOptions = mode === "audio"
    ? { ...options, synthesisMode: "reference" as const }
    : voiceAssetMode === "preset" ? { ...options, synthesisMode: "preset" as const, model: MIMO_PRESET_TTS_MODEL } : options;
  return { audio: source, voiceId, voiceAssetMode, options: synthesisOptions };
}
