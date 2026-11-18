import {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderContext,
  TTSResult,
  TextOptimizeParams,
  TextOptimizeResult,
  VoiceCloneParams,
  VoiceDesignParams
} from "./types.js";

export class IndexTTSAdapter implements ProviderAdapter {
  readonly id = "indextts";
  readonly name = "IndexTTS-2.5 (本地大模型)";
  readonly defaultEndpoint = "http://127.0.0.1:7860/api/clone";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: false,
    presetTTS: true,
    voiceDesign: true,
    instantClone: true,
    trainedClone: true,
    asr: false
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;

    const formData = new FormData();
    formData.append("text", params.text);
    formData.append("lang", params.language || "ZH");
    formData.append("speed", String(params.speed || 1.0));

    if (params.instruction) {
      formData.append("instruction", params.instruction);
    }
    if (params.voiceId) {
      formData.append("voiceId", params.voiceId);
    }

    if (params.referenceAudioBuffer) {
      const mime = (params.referenceAudioMime || "audio/wav").toLowerCase();
      const ext = mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "wav";
      const blob = new Blob([new Uint8Array(params.referenceAudioBuffer)], { type: mime });
      formData.append("voice", blob, params.referenceAudioName || `reference.${ext}`);
    }

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(600000)
      });
    } catch (err) {
      throw Object.assign(
        new Error(
          `IndexTTS 本地服务连接失败，请确认本地服务已启动并在 ${endpoint} 运行。\n错误: ${err instanceof Error ? err.message : String(err)}`
        ),
        { status: 502 }
      );
    }

    const elapsedMs = Date.now() - startedAt;

    if (!res.ok) {
      const errText = await res.text();
      let msg = errText;
      try {
        const json = JSON.parse(errText);
        msg = json.detail || json.message || errText;
      } catch {}
      throw Object.assign(new Error(`IndexTTS 本地推理失败 (HTTP ${res.status}): ${msg}`), {
        status: res.status
      });
    }

    const arrayBuf = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);

    return {
      audioBuffer,
      mimeType: "audio/wav",
      format: "wav",
      elapsedMs,
      redactedRequest: {
        text: params.text,
        instruction: params.instruction,
        speed: params.speed,
        hasReferences: Boolean(params.referenceAudioBuffer)
      }
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    return this.synthesizeVoiceClone(
      {
        text: params.text,
        instruction: params.voiceDescription,
        speed: params.speed,
        language: params.language,
        model: params.model
      },
      ctx
    );
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    throw new Error("IndexTTS 为本地音频模型，不含 LLM 文本润色接口。");
  }
}
