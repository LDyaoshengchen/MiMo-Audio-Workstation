export const VOLCENGINE_PATHS = {
  http: "/api/v3/tts/unidirectional",
  sse: "/api/v3/tts/unidirectional/sse",
  websocket: "/api/v3/tts/unidirectional/stream",
  bidirectional: "/api/v3/tts/bidirection",
  legacy: "/api/v1/tts",
  legacyWebsocket: "/api/v1/tts/ws_binary",
  create: "/api/v3/tts/create"
} as const;

export type VolcengineTransport = keyof typeof VOLCENGINE_PATHS;
export interface VolcengineOptions {
  transport?: VolcengineTransport;
  resourceId?: string;
  cluster?: string;
  speakerId?: string;
}

export function normalizeVolcengineOptions(value?: VolcengineOptions): VolcengineOptions {
  const transport = value?.transport;
  return {
    transport: transport && Object.hasOwn(VOLCENGINE_PATHS, transport) ? transport : "http",
    resourceId: String(value?.resourceId || "seed-tts-2.0").slice(0, 120),
    cluster: String(value?.cluster || "volcano_tts").slice(0, 120),
    speakerId: String(value?.speakerId || "").trim().slice(0, 256)
  };
}
