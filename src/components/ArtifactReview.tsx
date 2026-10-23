import type { ProductReview } from "../types/studioAudio";
import { RoleVoiceLibrary } from "./studio/RoleVoiceLibrary";

export function ArtifactReview({ title, src }: { title: string; src: string; review?: ProductReview; onChange: (review: ProductReview) => void }) {
  return <RoleVoiceLibrary iconOnly draft={{ name: title, audio: { fileName: `${title}.wav`, mimeType: "audio/wav", size: 0, dataUrl: src } }} />;
}
