import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { Archive } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { SingleArtifactDownloadLink } from "../SingleArtifactDownloadLink";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { memo } from "react";
import { ArtifactReview } from "../ArtifactReview";

export const ArtifactNode = memo(function ArtifactNode({ id, data }: NodeProps<StudioNode>) {
  const artifact = data.artifact;
  const isStashed = artifact ? data.isArtifactStashed?.(artifact) : false;
  const artifactForStash = artifact ? { ...artifact, sourceNodeName: data.title } : null;

  return (
    <StudioNodeFrame id={id} data={data} icon={<Archive size={17} />} tone="artifact">
      <Handle type="target" position={Position.Left} id="artifact" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>产物</span>
      {artifact ? <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} /> : null}
      {artifact ? (
        <>
          <StudioAudioPlayer src={artifact.audioDataUrl} />
          <div className="artifact-meta">
            <span>{artifact.elapsedMs} ms · {new Date(artifact.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
          </div>
          <div className="artifact-actions">
            <ArtifactReview title={data.title} src={artifact.audioDataUrl} review={artifact.review} onChange={review => data.onPatch?.(id, { artifact: { ...artifact, review } })} />
            <button
              className={isStashed ? "download-link nodrag stashed" : "download-link nodrag"}
              type="button"
              onClick={() => artifactForStash && data.onToggleStashArtifact?.(artifactForStash)}
              title={isStashed ? "已暂存 (点击取消暂存)" : "点击暂存此音频"}
            >
              <Archive size={15} />
              {isStashed ? "已暂存" : "暂存"}
            </button>
            <SingleArtifactDownloadLink title={data.title} fileName={artifact.fileName} audioDataUrl={artifact.audioDataUrl}
              workspaceName={data.workspaceName} createdAt={artifact.createdAt} settings={data.singleDownloadSettings} />
          </div>
        </>
      ) : (
        <p className="node-muted">等待音频克隆节点写入产物。</p>
      )}
    </StudioNodeFrame>
  );
});
