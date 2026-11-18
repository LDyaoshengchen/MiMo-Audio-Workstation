import type { StudioNode, StudioEdge } from "../types/studio";

export function getStudioNodeSize(node: StudioNode) {
  const type = node.type;
  const fallbackWidth = type === "batchVoiceDesign" ? 880 : ["batchVoiceClone", "integratedStudio", "gameVocal"].includes(type || "") ? 660 : type === "batchArtifact" ? 440 : type === "voiceClone" || type === "voiceDesign" ? 360 : type === "comment" ? 280 : 340;
  let fallbackHeight = 260;
  if (type === "gameVocal") fallbackHeight = 620;
  else if (type === "batchVoiceClone" || type === "batchVoiceDesign") fallbackHeight = Math.max(460, 180 + (node.data.batchRows?.length || 1) * 75);
  else if (type === "integratedStudio") fallbackHeight = Math.max(640, 240 + (node.data.batchRows?.length || 1) * 75);
  else if (type === "batchArtifact") fallbackHeight = 110 + Math.max(3, node.data.batchArtifacts?.length ?? 0) * 85;
  else if (type === "artifact") fallbackHeight = 145;
  else if (type === "voiceDesign") fallbackHeight = 640;
  else if (type === "voiceClone") fallbackHeight = 380;
  else if (type === "referenceAudio" || type === "audioMerge") fallbackHeight = 220;
  else if (type === "comment") fallbackHeight = 200;
  const height = node.measured?.height && node.measured.height > 50 ? node.measured.height : node.height && node.height > 50 ? node.height : fallbackHeight;
  return { width: node.measured?.width && node.measured.width > 50 ? node.measured.width : node.width && node.width > 50 ? node.width : fallbackWidth,
    height: type === "batchArtifact" ? Math.max(365, height) : height };
}

/** Match tidy's three-column grid, but choose a currently free slot, not a filename sequence. */
export function findArtifactPosition(source: StudioNode, nodes: StudioNode[], edges: StudioEdge[], type: "artifact" | "batchArtifact" = "artifact") {
  const liveSource = nodes.find(node => node.id === source.id) || source;
  const batch = type === "batchArtifact" || ["gameVocal", "batchVoiceClone", "batchVoiceDesign", "integratedStudio"].includes(liveSource.type || "");
  const itemWidth = batch ? 440 : 340, itemHeight = batch ? 440 : 145;
  const connected = new Set(edges.filter(edge => edge.source === source.id).map(edge => edge.target));
  const siblings = nodes.filter(node => connected.has(node.id) && node.type === type);
  // Reserve actual player/card dimensions as well as the standard tidy cell.
  const width = Math.max(itemWidth, ...siblings.map(node => getStudioNodeSize(node).width));
  const height = Math.max(type === "artifact" ? 145 : 260, ...siblings.map(node => getStudioNodeSize(node).height));
  const stepX = itemWidth + 60, stepY = itemHeight + 60;
  const x = liveSource.position.x + getStudioNodeSize(liveSource).width + 60, y = liveSource.position.y;
  const margin = 12;
  const occupied = nodes.filter(node => !node.hidden).map(node => ({ ...node.position, ...getStudioNodeSize(node) }));
  const free = (left: number, top: number) => occupied.every(rect => left + width + margin <= rect.x || left >= rect.x + rect.width + margin || top + height + margin <= rect.y || top >= rect.y + rect.height + margin);
  for (let index = 0; index < Math.max(30, nodes.length * 6); index++) {
    const left = x + (index % 3) * stepX, top = y + Math.floor(index / 3) * stepY;
    if (free(left, top)) return { x: left, y: top };
  }
  // A very tall/custom card may span many cells; fall below it without moving other nodes.
  return { x, y: Math.max(y, ...occupied.map(rect => rect.y + rect.height)) + 60 };
}
