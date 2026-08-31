import { describe, it, expect } from "vitest";
import { buildCleanAudioCacheFileName as serverNaming, sanitizeFileName, validateAndSanitizeEndpoint } from "../server/utils/audioNaming.js";
import {
  buildCleanAudioCacheFileName as clientNaming,
  getArtifactDownloadFileName,
  getFileExtension,
  audioSourceToFile,
  audioSourceToBlob,
  buildApiHeaders
} from "../src/utils/audioNaming.js";

describe("Audio Naming & Security Utilities (生产函数真实测试)", () => {
  describe("Server buildCleanAudioCacheFileName", () => {
    it("should name audio cache file by artifact node title", () => {
      const name = serverNaming("太阳语音 产物", "产物", "node-123456");
      expect(name).toBe("太阳语音 产物_123456.wav");
    });

    it("should sanitize illegal characters in node title", () => {
      const name = serverNaming("克隆:播音员/01*test?", "产物", "node-abcdef");
      expect(name).toBe("克隆_播音员_01_test__abcdef.wav");
    });

    it("should fallback to prefix when title is empty", () => {
      const name = serverNaming("", "批量产物", "item-998877");
      expect(name).toBe("批量产物_998877.wav");
    });

    it("should preserve custom audio extensions like .mp3", () => {
      const name = serverNaming("参考背景音", "参考音频", "ref-001122", "bgm.mp3");
      expect(name).toBe("参考背景音_001122.mp3");
    });
  });

  describe("Client getArtifactDownloadFileName", () => {
    it("should generate user-friendly download file name with workspace prefix", () => {
      const fname = getArtifactDownloadFileName("女播音员-试听1", "output.wav", "画板A");
      expect(fname).toBe("画板A_女播音员-试听1.wav");
    });

    it("should not duplicate workspace name if already present in title", () => {
      const fname = getArtifactDownloadFileName("画板A_女播音员", "output.wav", "画板A");
      expect(fname).toBe("画板A_女播音员.wav");
    });
  });

  describe("API Endpoint Validation & Security", () => {
    it("should allow valid https endpoint", () => {
      const valid = validateAndSanitizeEndpoint("https://api.xiaomimimo.com/v1/chat/completions");
      expect(valid).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    });

    it("should allow local http endpoint for mock or dev proxy", () => {
      const valid = validateAndSanitizeEndpoint("http://localhost:3001/v1/chat/completions");
      expect(valid).toBe("http://localhost:3001/v1/chat/completions");
    });

    it("should reject unencrypted http for remote domains to protect API key in transit", () => {
      expect(() => validateAndSanitizeEndpoint("http://insecure-api.example.com/v1")).toThrowError(
        /HTTPS/
      );
    });

    it("should reject non-http/https protocols like file: or javascript:", () => {
      expect(() => validateAndSanitizeEndpoint("file:///etc/passwd")).toThrowError(
        /仅支持 http: 或 https:/
      );
    });
  });

  describe("audioSourceToFile & audioSourceToBlob (支持 Base64 与 缓存路径双向读取)", () => {
    it("should convert Base64 data URL to File properly", async () => {
      const base64Audio = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      const file = await audioSourceToFile(base64Audio, "test.wav", "audio/wav");
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe("test.wav");
      expect(file.type).toBe("audio/wav");
      expect(file.size).toBeGreaterThan(0);
    });

    it("should convert URL audio cache path to File via fetch", async () => {
      const fakeWavData = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0]);
      // Mock global fetch for URL
      const origFetch = global.fetch;
      global.fetch = async (url: string | URL | Request) => {
        if (String(url).includes("/api/audio-cache/")) {
          return {
            ok: true,
            status: 200,
            blob: async () => new Blob([fakeWavData], { type: "audio/wav" })
          } as Response;
        }
        return origFetch(url);
      };

      try {
        const file = await audioSourceToFile("/api/audio-cache/voice_123.wav", "voice_123.wav", "audio/wav");
        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe("voice_123.wav");
        expect(file.type).toBe("audio/wav");
        expect(file.size).toBe(fakeWavData.length);
      } finally {
        global.fetch = origFetch;
      }
    });

    it("should convert Base64 and URL to Blob", async () => {
      const base64Audio = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      const blob = await audioSourceToBlob(base64Audio);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe("buildApiHeaders (统一请求头构建器)", () => {
    it("should build full provider headers including X-API-Provider", () => {
      const headers = buildApiHeaders({
        apiKey: "sk-test",
        apiEndpoint: "https://api.openai.com/v1/audio/speech",
        apiProvider: "openai",
        isJson: true
      });
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-API-Key"]).toBe("sk-test");
      expect(headers["X-API-Endpoint"]).toBe("https://api.openai.com/v1/audio/speech");
      expect(headers["X-API-Provider"]).toBe("openai");
    });

    it("should attach AppId & AccessToken for Volcengine and Custom", () => {
      const headers = buildApiHeaders({
        apiKey: "sk-volc",
        apiProvider: "volcengine",
        appId: "volc-app-1",
        accessToken: "volc-token-2"
      });
      expect(headers["X-API-Provider"]).toBe("volcengine");
      expect(headers["X-API-AppId"]).toBe("volc-app-1");
      expect(headers["X-API-AccessToken"]).toBe("volc-token-2");
    });

    it("should attach Custom Protocol for Custom Provider", () => {
      const headers = buildApiHeaders({
        apiKey: "sk-custom",
        apiProvider: "custom",
        customProtocol: "openai-tts"
      });
      expect(headers["X-API-Provider"]).toBe("custom");
      expect(headers["X-API-Custom-Protocol"]).toBe("openai-tts");
    });
  });
});
