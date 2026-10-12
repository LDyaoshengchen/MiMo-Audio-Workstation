import type { ArtifactData, AudioAsset, BatchVoiceCloneRow, BatchArtifactItem } from "./studioAudio";
import type { GameCharacterType } from "../utils/gameVocalCharacterTags";
import type { GameVocalDurationMode } from "../utils/gameVocalOptimizer";
import type { Node, Edge } from "@xyflow/react";
import type { ProviderOptions } from "../utils/providerConfig";
import type { SelectedVocalItem } from "../utils/gameVocalLibrary";
import type { SingleDownloadSettings } from "../utils/downloadSettings";

export type StatusResponse = {
  ok: boolean;
  model: string;
  apiKeyConfigured: boolean;
  maxAudioBytes: number;
  allowedMimeTypes: string[];
};

export type ApiSettingsResponse = {
  apiKey?: string;
  apiEndpoint: string;
  apiProvider?: string;
  configured: boolean;
  hasApiKey?: boolean;
  maskedApiKey?: string;
  appId?: string;
  customProtocol?: ProviderOptions["customProtocol"];
  voiceId?: string;
  model?: string;
  referenceText?: string;
  synthesisMode?: ProviderOptions["synthesisMode"];
  hasAccessToken?: boolean;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  type: "board" | "audiobook";
  createdAt: string;
  updatedAt: string;
  nodeCount?: number;
  edgeCount?: number;
  stashCount?: number;
  characterCount?: number;
  segmentCount?: number;
  phase?: string;
};

export type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  type: "board" | "audiobook";
  isBuiltIn?: boolean;
  createdAt: string;
};

export type BoardWorkspacePayload = {
  id: string;
  type: "board";
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: StudioNode[];
  edges: StudioEdge[];
  stashItems: StashItem[];
};

export type AudiobookCharacter = {
  id: string;
  name: string;
  roleType: "narrator" | "protagonist" | "supporting" | "custom";
  aliases: string[];
  voiceSource: "analysis" | "manualDesign" | "manualClone";
  voiceMode: "designed" | "cloned";
  isSystem?: boolean;
  isVoiceLocked?: boolean;
  gender: string;
  age: string;
  voiceTraits: string;
  personality: string;
  voiceDescription: string;
  voiceSampleText?: string;
  voiceDataUrl: string | null;
  voiceStatus: "pending" | "generating" | "ready" | "error";
  voiceError?: string;
  referenceAudioDataUrl?: string;
  referenceAudioFileName?: string;
  referenceAudioMimeType?: string;
};

export type AudiobookSegment = {
  id: string;
  text: string;
  characterId: string | null;
  characterName: string;
  emotion: string;
  isAutoAnnotated: boolean;
};

export type AudiobookProduct = {
  id: string;
  segmentId: string;
  characterId: string | null;
  characterName: string;
  text: string;
  instruction: string;
  audioDataUrl: string | null;
  status: "pending" | "generating" | "ready" | "error";
  error?: string;
  elapsedMs?: number;
  createdAt: string;
  synthesisMethod: "voiceClone" | "voiceDesign";
};

export type AudiobookChapter = {
  id: string;
  title: string;
  novelText: string;
  characterHints: string;
  segments: AudiobookSegment[];
  products: AudiobookProduct[];
  phase: "character-creation" | "annotation" | "generation";
  createdAt: string;
  updatedAt: string;
};

export type AudiobookWorkspacePayload = {
  id: string;
  type: "audiobook";
  name: string;
  createdAt: string;
  updatedAt: string;
  activeChapterId: string;
  novelText: string;
  characterHints: string;
  characters: AudiobookCharacter[];
  segments: AudiobookSegment[];
  products: AudiobookProduct[];
  phase: "character-creation" | "annotation" | "generation";
  chapters: AudiobookChapter[];
};

export type WorkspacePayload = BoardWorkspacePayload | AudiobookWorkspacePayload;

export type WorkspacesResponse = {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceSummary[];
};

export type StudioNodeType = "referenceAudio" | "audioMerge" | "voiceStyle" | "prompt" | "voiceClone" | "voiceDesign" | "artifact" | "batchVoiceClone" | "batchVoiceDesign" | "batchArtifact" | "integratedStudio" | "gameVocal" | "comment";

export type StudioNode = Node<NodeData, StudioNodeType>;

export type StudioEdge = Edge<{ onDeleteEdge?: (edgeId: string) => void }>;

export type StashItem = ArtifactData & {
  id: string;
  timestamp?: number;
};

export type NodeData = {
  title: string;
  text?: string;
  instruction?: string;
  naturalControl?: string;
  voiceDescription?: string;
  voiceId?: string;
  assetProvider?: string;
  audio?: AudioAsset;
  /** A reference node may hold several samples; the first one remains available as audio for compatibility. */
  audioAssets?: AudioAsset[];
  artifact?: ArtifactData;
  exportPrefixName?: string;
  parentTitle?: string;
  seqIndex?: number;
  batchRowId?: string;
  batchRows?: BatchVoiceCloneRow[];
  batchArtifacts?: BatchArtifactItem[];
  selectedVocals?: SelectedVocalItem[];
  selectedCategoryId?: string;
  selectedSubcategoryId?: string;
  vocalRefMode?: "clone" | "design";
  vocalCharacterType?: GameCharacterType;
  vocalSelectedTags?: string[];
  vocalVoiceDescription?: string;
  antiDrone?: boolean;
  vocalDurationMode?: GameVocalDurationMode;
  phoneticAnchor?: boolean;
  autoTrimTail?: boolean;
  vocalProgressText?: string;
  refAudioUrl?: string;
  refAudioName?: string;
  refAudioDuration?: number;
  isRunning?: boolean;
  generationProgress?: { completed: number; total: number };
  singleRunningRowId?: string;
  error?: string;
  workspaceName?: string;
  singleDownloadSettings?: SingleDownloadSettings;
  stashedArtifactKeys?: ReadonlySet<string>;
  onPatch?: (nodeId: string, patch: Partial<NodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onRunClone?: (nodeId: string, count?: number) => void;
  onRunBatchVoiceClone?: (nodeId: string) => void;
  onRunSingleRowBatchVoiceClone?: (nodeId: string, rowId: string) => void;
  onRunBatchVoiceDesign?: (nodeId: string) => void;
  onRunSingleRowBatchVoiceDesign?: (nodeId: string, rowId: string) => void;
  onRunIntegratedBatch?: (nodeId: string) => void;
  onRunIntegratedSingleRow?: (nodeId: string, rowId: string) => void;
  onRunGameVocalClone?: (nodeId: string) => void;
  onDeleteIntegratedArtifactItem?: (nodeId: string, rowId: string, itemId: string) => void;
  onDeleteBatchArtifactItem?: (nodeId: string, itemId: string) => void;
  onRunVoiceDesign?: (nodeId: string, count?: number) => void;
  onOptimizeStyle?: (nodeId: string) => void;
  onOptimizeVoiceDesign?: (nodeId: string) => void;
  onStashArtifact?: (artifact: ArtifactData) => void;
  onToggleStashArtifact?: (artifact: ArtifactData) => void;
  onRunAudioMerge?: (nodeId: string) => void;
  onCreateReferenceFromAudio?: (title: string, audioAsset: AudioAsset) => void;
  isArtifactStashed?: (artifact: ArtifactData) => boolean;
};

export type DebugResponse = {
  audioDataUrl: string;
  fileName: string;
  elapsedMs: number;
};

export type StyleOptimizeResponse = {
  optimizedText: string;
  elapsedMs: number;
  error?: string;
};

export interface ApiProviderCapabilities {
  textOptimization: boolean;     // 文本润色
  presetTTS: boolean;            // 预置 TTS
  voiceDesign: boolean;          // 音色设计
  instantClone: boolean;         // 即时克隆
  trainedClone: boolean;         // 训练式克隆
  asr: boolean;                  // ASR 识别
}

export interface ApiProviderPreset {
  id: string;
  name: string;
  badge: string;
  endpoint: string;
  description: string;
  capabilities: ApiProviderCapabilities;
  getKeyUrl?: string;
  hint?: string;
  subEndpoints?: Array<{ label: string; url: string }>;
}
