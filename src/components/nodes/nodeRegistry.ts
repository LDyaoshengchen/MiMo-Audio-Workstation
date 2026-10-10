import type { EdgeTypes, NodeTypes } from "@xyflow/react";
import type { StudioNodeType } from "../../types/studio";
import { ReferenceAudioNode } from "./ReferenceAudioNode";
import { AudioMergeNode } from "./AudioMergeNode";
import { VoiceStyleNode } from "./VoiceStyleNode";
import { PromptNode } from "./PromptNode";
import { VoiceCloneNode } from "./VoiceCloneNode";
import { VoiceDesignNode } from "./VoiceDesignNode";
import { ArtifactNode } from "./ArtifactNode";
import { BatchVoiceCloneNode } from "./BatchVoiceCloneNode";
import { BatchVoiceDesignNode } from "./BatchVoiceDesignNode";
import { BatchArtifactNode } from "./BatchArtifactNode";
import { IntegratedStudioNode } from "./IntegratedStudioNode";
import { GameVocalNode } from "./GameVocalNode";
import { CommentNode } from "./CommentNode";
import { DeletableEdge } from "../canvas/DeletableEdge";

// Module-level identities stay stable across every controller render.
export const STUDIO_NODE_TYPES = {
  referenceAudio: ReferenceAudioNode,
  audioMerge: AudioMergeNode,
  voiceStyle: VoiceStyleNode,
  prompt: PromptNode,
  voiceClone: VoiceCloneNode,
  voiceDesign: VoiceDesignNode,
  artifact: ArtifactNode,
  batchVoiceClone: BatchVoiceCloneNode,
  batchVoiceDesign: BatchVoiceDesignNode,
  batchArtifact: BatchArtifactNode,
  integratedStudio: IntegratedStudioNode,
  gameVocal: GameVocalNode,
  comment: CommentNode,
} satisfies NodeTypes & Record<StudioNodeType, unknown>;

export const STUDIO_EDGE_TYPES = { deletable: DeletableEdge } satisfies EdgeTypes;
