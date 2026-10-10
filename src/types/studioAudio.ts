export interface IntegratedRowArtifact {
  id: string;
  seqIndex?: number;
  fileName: string;
  audioDataUrl: string;
  elapsedMs: number;
  createdAt: string;
}

export interface BatchVoiceCloneRow {
  id: string;
  title: string;
  instruction: string;
  naturalControl?: string;
  voiceStyle?: string;
  text: string;
  refAudioUrl?: string;
  refAudioName?: string;
  artifacts?: IntegratedRowArtifact[];
}

export interface BatchArtifactItem {
  id: string;
  seqIndex?: number;
  rowTitle: string;
  fileName: string;
  audioDataUrl: string;
  elapsedMs: number;
  createdAt: string;
}

export type AudioAsset = {
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export type ArtifactData = {
  fileName: string;
  audioDataUrl: string;
  elapsedMs: number;
  createdAt: string;
  sourceNodeName: string;
  sourceNodeId?: string;
  sourceRowId?: string;
  mimeType?: string;
  size?: number;
};
