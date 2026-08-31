/**
 * Multi-Provider Audio Workstation Types & Interfaces
 */

export interface ProviderCapabilities {
  textOptimization: boolean;     // 文本/提示词润色
  presetTTS: boolean;            // 预置音色 TTS
  voiceDesign: boolean;          // 音色设计 (自然语言创造音色)
  instantClone: boolean;         // 即时参考音频克隆 (Zero-Shot)
  trainedClone: boolean;         // 训练式克隆 (基于已注册/训练的 Voice ID)
  asr: boolean;                  // 语音识别
}

export interface VoiceCloneParams {
  text: string;
  instruction?: string;
  speed?: number;
  format?: string;
  referenceAudioBuffer?: Buffer;
  referenceAudioMime?: string;
  referenceAudioName?: string;
  model?: string;
  voiceId?: string;
  language?: string;
}

export interface VoiceDesignParams {
  text: string;
  voiceDescription: string;
  naturalControl?: string;
  instruction?: string;
  speed?: number;
  format?: string;
  model?: string;
  language?: string;
}

export interface TextOptimizeParams {
  prompt: string;
  systemPrompt?: string;
  model?: string;
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
  format: string;
  elapsedMs: number;
  rawResponse?: unknown;
  redactedRequest?: unknown;
}

export interface TextOptimizeResult {
  optimizedText: string;
  elapsedMs: number;
  rawResponse?: unknown;
}

export interface ProviderContext {
  apiKey: string;
  apiEndpoint?: string;
  appId?: string;          // e.g. for Volcengine
  accessToken?: string;    // e.g. for Volcengine
  customProtocol?: "mimo-chat" | "openai-tts" | "fish-tts" | "siliconflow";
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly defaultEndpoint: string;
  readonly capabilities: ProviderCapabilities;

  synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult>;
  synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult>;
  optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult>;
}
