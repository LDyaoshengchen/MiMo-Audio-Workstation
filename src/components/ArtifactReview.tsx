import type { ProductReview } from "../types/studioAudio";
import { RoleVoiceLibrary } from "./studio/RoleVoiceLibrary";
import { Star } from "lucide-react";

export function ArtifactReview({ title, src }: { title: string; src: string; review?: ProductReview; onChange: (review: ProductReview) => void }) {
  return <RoleVoiceLibrary iconOnly label={<Star size={14} />} draft={{ name: title, audio: { fileName: `${title}.wav`, mimeType: "audio/wav", size: 0, dataUrl: src } }} />;
}
