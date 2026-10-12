export type ProductReview = { verdict?: "unrated" | "usable" | "alternate" | "rejected"; rating?: number; favorite?: boolean; selected?: boolean };
export function isSelectedProduct(item: { review?: ProductReview }) { return !!item.review?.selected && item.review.verdict !== "rejected"; }
export interface IntegratedRowArtifact {
  review?: ProductReview;
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
  review?: ProductReview;
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
  review?: ProductReview;
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
