import "@xyflow/react/dist/style.css";
import { ReactFlowProvider } from "@xyflow/react";
import { StudioApp } from "./studio/StudioApp";

// Preserve existing public imports while implementations live in dedicated modules.
export type { AppleConfirmOptions } from "./studio/confirmation";
export { showAppleConfirm } from "./studio/confirmation";
export { getNodeDefaultData } from "./studio/config";
export type { WorkspacePayload, StudioNodeType, StudioNode, ApiProviderCapabilities } from "./types/studio";
export type { IntegratedRowArtifact, BatchVoiceCloneRow, BatchArtifactItem } from "./types/studioAudio";

export default function App() {
  return <ReactFlowProvider><StudioApp /></ReactFlowProvider>;
}
