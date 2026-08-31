import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import {
  getProviderAdapter,
  getAllProviderCapabilities,
  MimoAdapter,
  SiliconFlowAdapter,
  FishAudioAdapter,
  ElevenLabsAdapter,
  OpenAIAdapter,
  VolcengineAdapter,
  CustomAdapter
} from "../server/providers/index.js";

describe("Provider Adapters & Capabilities", () => {
  it("should declare correct capability flags for all providers", () => {
    const caps = getAllProviderCapabilities();
    expect(caps.mimo.capabilities.voiceDesign).toBe(true);
    expect(caps.mimo.capabilities.instantClone).toBe(true);
    expect(caps.mimo.capabilities.presetTTS).toBe(false);

    expect(caps.siliconflow.capabilities.presetTTS).toBe(true);
    expect(caps.siliconflow.capabilities.instantClone).toBe(true);
    expect(caps.siliconflow.capabilities.voiceDesign).toBe(false);

    expect(caps.fishaudio.capabilities.instantClone).toBe(true);
    expect(caps.fishaudio.capabilities.trainedClone).toBe(true);
    expect(caps.fishaudio.capabilities.voiceDesign).toBe(false);

    expect(caps.elevenlabs.capabilities.presetTTS).toBe(true);
    expect(caps.elevenlabs.capabilities.trainedClone).toBe(true);
    expect(caps.elevenlabs.capabilities.voiceDesign).toBe(false);
    expect(caps.elevenlabs.capabilities.instantClone).toBe(false);

    expect(caps.openai.capabilities.presetTTS).toBe(true);
    expect(caps.openai.capabilities.voiceDesign).toBe(false);
    expect(caps.openai.capabilities.instantClone).toBe(false);
    expect(caps.openai.capabilities.asr).toBe(true);

    expect(caps.volcengine.capabilities.presetTTS).toBe(true);
    expect(caps.volcengine.capabilities.trainedClone).toBe(true);
    expect(caps.volcengine.capabilities.voiceDesign).toBe(false);
    expect(caps.volcengine.capabilities.instantClone).toBe(false);
  });

  it("should retrieve proper adapter instance by ID with fallback", () => {
    expect(getProviderAdapter("mimo")).toBeInstanceOf(MimoAdapter);
    expect(getProviderAdapter("siliconflow")).toBeInstanceOf(SiliconFlowAdapter);
    expect(getProviderAdapter("fishaudio")).toBeInstanceOf(FishAudioAdapter);
    expect(getProviderAdapter("elevenlabs")).toBeInstanceOf(ElevenLabsAdapter);
    expect(getProviderAdapter("openai")).toBeInstanceOf(OpenAIAdapter);
    expect(getProviderAdapter("volcengine")).toBeInstanceOf(VolcengineAdapter);
    expect(getProviderAdapter("custom")).toBeInstanceOf(CustomAdapter);
    expect(getProviderAdapter("non_existent_provider")).toBeInstanceOf(MimoAdapter);
  });
});

describe("MiMo Adapter Protocol & Restrictions", () => {
  const mimo = new MimoAdapter();

  it("should reject disallowed audio formats (e.g. M4A/MP4)", async () => {
    await expect(
      mimo.synthesizeVoiceClone(
        {
          text: "测试",
          referenceAudioBuffer: Buffer.from("fake-audio"),
          referenceAudioMime: "audio/m4a"
        },
        { apiKey: "test-key" }
      )
    ).rejects.toThrow("仅支持 MP3 与 WAV 格式，不支持 audio/m4a");
  });

  it("should reject reference audio buffer exceeding 7.5MB", async () => {
    const largeBuffer = Buffer.alloc(8 * 1024 * 1024);
    await expect(
      mimo.synthesizeVoiceClone(
        {
          text: "测试",
          referenceAudioBuffer: largeBuffer,
          referenceAudioMime: "audio/wav"
        },
        { apiKey: "test-key" }
      )
    ).rejects.toThrow("参考音频体积过大（最大允许 7.5MB）");
  });
});

describe("Explicit Unsupported Features Handling", () => {
  it("SiliconFlow, FishAudio, ElevenLabs, OpenAI, and Volcengine should explicitly throw on VoiceDesign", async () => {
    const silicon = new SiliconFlowAdapter();
    const fish = new FishAudioAdapter();
    const eleven = new ElevenLabsAdapter();
    const openai = new OpenAIAdapter();
    const volc = new VolcengineAdapter();

    const dummyDesign = { text: "测试", voiceDescription: "温柔女声" };
    const dummyCtx = { apiKey: "key" };

    await expect(silicon.synthesizeVoiceDesign(dummyDesign, dummyCtx)).rejects.toThrow("暂未提供基于自然语言提示词的音色设计能力");
    await expect(fish.synthesizeVoiceDesign(dummyDesign, dummyCtx)).rejects.toThrow("暂不支持自然语言提示词音色设计");
    await expect(eleven.synthesizeVoiceDesign(dummyDesign, dummyCtx)).rejects.toThrow("暂不支持基于自然语言提示词");
    await expect(openai.synthesizeVoiceDesign(dummyDesign, dummyCtx)).rejects.toThrow("仅支持 6 种预置声音");
    await expect(volc.synthesizeVoiceDesign(dummyDesign, dummyCtx)).rejects.toThrow("暂不支持自然语言提示词音色设计");
  });

  it("Custom Adapter should throw on invalid protocol declaration", async () => {
    const custom = new CustomAdapter();
    await expect(
      custom.synthesizeVoiceClone(
        { text: "测试" },
        { apiKey: "key", customProtocol: "invalid-proto" as any }
      )
    ).rejects.toThrow("不支持的自定义协议类型");
  });
});

describe("Integration Mock Server Protocol Verification", () => {
  let server: http.Server;
  let serverPort: number;
  let receivedRequests: Array<{ url?: string; method?: string; headers: http.IncomingHttpHeaders; body: any }> = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          receivedRequests.push({
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: parsed
          });

          // Mock responses based on URL / Provider
          if (req.url?.includes("/v1/audio/speech")) {
            res.writeHead(200, { "Content-Type": "audio/wav" });
            res.end(Buffer.from("RIFF....WAVEfmt ....data...."));
          } else if (req.url?.includes("/v1/tts")) {
            res.writeHead(200, { "Content-Type": "audio/wav" });
            res.end(Buffer.from("RIFF....WAVEfmt ....data...."));
          } else if (req.url?.includes("/v1/text-to-speech")) {
            res.writeHead(200, { "Content-Type": "audio/mpeg" });
            res.end(Buffer.from("ID3...."));
          } else if (req.url?.includes("/chat/completions")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: "润色结果",
                      audio: { data: Buffer.from("RIFF....WAVE").toString("base64") }
                    }
                  }
                ]
              })
            );
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ code: 3000, data: Buffer.from("RIFF....WAVE").toString("base64") }));
          }
        });
      });

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        serverPort = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    receivedRequests = [];
  });

  it("OpenAI Adapter must send standard OpenAI /v1/audio/speech format (NOT MiMo format)", async () => {
    const openai = new OpenAIAdapter();
    const endpoint = `http://127.0.0.1:${serverPort}/v1/audio/speech`;

    const result = await openai.synthesizeVoiceClone(
      { text: "你好世界", voiceId: "nova", format: "wav" },
      { apiKey: "sk-openai-test", apiEndpoint: endpoint }
    );

    expect(result.audioBuffer).toBeDefined();
    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];

    // Verify it sent Authorization Bearer and OpenAI body format
    expect(req.headers.authorization).toBe("Bearer sk-openai-test");
    expect(req.body.model).toBe("tts-1");
    expect(req.body.input).toBe("你好世界");
    expect(req.body.voice).toBe("nova");
    expect(req.body.response_format).toBe("wav");

    // CRITICAL: MUST NOT CONTAIN MIMO FIELDS
    expect(req.body.messages).toBeUndefined();
    expect(req.body.audio).toBeUndefined();
  });

  it("ElevenLabs Adapter must send /v1/text-to-speech/{voice_id} with xi-api-key", async () => {
    const eleven = new ElevenLabsAdapter();
    const endpoint = `http://127.0.0.1:${serverPort}/v1/text-to-speech`;

    const result = await eleven.synthesizeVoiceClone(
      { text: "Hello ElevenLabs", voiceId: "custom-voice-123" },
      { apiKey: "eleven-secret-key", apiEndpoint: endpoint }
    );

    expect(result.audioBuffer).toBeDefined();
    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];

    expect(req.url).toBe("/v1/text-to-speech/custom-voice-123");
    expect(req.headers["xi-api-key"]).toBe("eleven-secret-key");
    expect(req.body.text).toBe("Hello ElevenLabs");
    expect(req.body.model_id).toBe("eleven_multilingual_v2");
    expect(req.body.voice_settings).toBeDefined();

    // MUST NOT CONTAIN MIMO FIELDS
    expect(req.body.messages).toBeUndefined();
  });

  it("Fish Audio Adapter must send format with reference_id / references", async () => {
    const fish = new FishAudioAdapter();
    const endpoint = `http://127.0.0.1:${serverPort}/v1/tts`;

    const result = await fish.synthesizeVoiceClone(
      { text: "Fish Speech Text", voiceId: "fish-model-456", format: "wav" },
      { apiKey: "fish-secret-key", apiEndpoint: endpoint }
    );

    expect(result.audioBuffer).toBeDefined();
    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];

    expect(req.headers.authorization).toBe("Bearer fish-secret-key");
    expect(req.body.text).toBe("Fish Speech Text");
    expect(req.body.reference_id).toBe("fish-model-456");
    expect(req.body.format).toBe("wav");

    // MUST NOT CONTAIN MIMO FIELDS
    expect(req.body.messages).toBeUndefined();
  });

  it("SiliconFlow Adapter must send /v1/audio/speech with SiliconFlow model name", async () => {
    const silicon = new SiliconFlowAdapter();
    const endpoint = `http://127.0.0.1:${serverPort}/v1/audio/speech`;

    const result = await silicon.synthesizeVoiceClone(
      { text: "SiliconFlow 语音合成测试", voiceId: "alex", format: "wav" },
      { apiKey: "sk-silicon-test", apiEndpoint: endpoint }
    );

    expect(result.audioBuffer).toBeDefined();
    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];

    expect(req.headers.authorization).toBe("Bearer sk-silicon-test");
    expect(req.body.input).toBe("SiliconFlow 语音合成测试");
    expect(req.body.voice).toBe("alex");
    expect(req.body.response_format).toBe("wav");
    expect(req.body.messages).toBeUndefined();
  });

  it("Custom Adapter must dispatch according to declared customProtocol", async () => {
    const custom = new CustomAdapter();
    const endpoint = `http://127.0.0.1:${serverPort}/v1/audio/speech`;

    const result = await custom.synthesizeVoiceClone(
      { text: "Custom OpenAI TTS", voiceId: "alloy", format: "wav" },
      { apiKey: "sk-custom-open", apiEndpoint: endpoint, customProtocol: "openai-tts" }
    );

    expect(result.audioBuffer).toBeDefined();
    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];
    expect(req.body.model).toBe("tts-1");
    expect(req.body.voice).toBe("alloy");
  });

  it("OpenAI Adapter should fallback to preset voice when cloning with voiceBuffer", async () => {
    const openai = new OpenAIAdapter();
    const endpoint = `http://127.0.0.1:${serverPort}/v1/audio/speech`;
    const fakeBuffer = Buffer.from("RIFF....WAVE");

    const result = await openai.synthesizeVoiceClone(
      { text: "Audiobook narrator segment", voiceBuffer: fakeBuffer, format: "wav" },
      { apiKey: "sk-openai-test", apiEndpoint: endpoint }
    );

    expect(result.audioBuffer).toBeDefined();
    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];
    expect(req.headers.authorization).toBe("Bearer sk-openai-test");
    expect(req.body.input).toBe("Audiobook narrator segment");
  });
});
