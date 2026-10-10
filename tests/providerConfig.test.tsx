import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderSettingsFields } from "../src/components/ProviderSettingsFields";
import { appendSynthesisInputs, normalizeProviderOptions } from "../src/utils/providerConfig";
import { getAudioFileExtension } from "../src/utils/audioNaming";

describe("Provider settings UI and audio downloads", () => {
  it("shows required provider-specific fields and saved secrets are never restored into inputs", () => {
    const options = normalizeProviderOptions({ accessToken: "saved-secret" });
    expect(options.accessToken).toBe("");
    const render = (provider: string) => renderToStaticMarkup(<ProviderSettingsFields provider={provider} options={options} error="" onChange={() => {}} />);
    expect(render("volcengine")).toContain("AppID");
    expect(render("volcengine")).toContain("AccessToken");
    expect(render("volcengine")).not.toContain("saved-secret");
    expect(render("custom")).toContain("自定义协议");
    expect(render("custom")).toContain("openai-tts");
  });

  it("Voice ID synthesis works without audio and missing IDs cannot silently use defaults", async () => {
    const form = new FormData();
    await appendSynthesisInputs(form, normalizeProviderOptions({ synthesisMode: "voiceId", voiceId: "registered-voice", model: "custom-model" }));
    expect(form.get("voiceId")).toBe("registered-voice");
    expect(form.get("model")).toBe("custom-model");
    expect(form.has("voice")).toBe(false);
    await expect(appendSynthesisInputs(new FormData(), normalizeProviderOptions({ synthesisMode: "voiceId" }))).rejects.toThrow("请填写已注册 Voice ID");
  });

  it("preset synthesis never reads or uploads connected reference audio", async () => {
    const form = new FormData();
    await appendSynthesisInputs(form, normalizeProviderOptions({ synthesisMode: "preset" }), { dataUrl: "unreadable-reference", fileName: "ref.wav", mimeType: "audio/wav" });
    expect(form.has("voice")).toBe(false);
    expect(form.get("synthesisMode")).toBe("preset");
  });

  it("download extensions follow real MIME or cache URL rather than a stale WAV name", () => {
    expect(getAudioFileExtension("data:audio/mpeg;base64,SUQz", "stale.wav")).toBe(".mp3");
    expect(getAudioFileExtension("/api/audio-cache/voice.mp3", "stale.wav")).toBe(".mp3");
    expect(getAudioFileExtension("data:audio/wav;base64,UklGRg==", "stale.mp3")).toBe(".wav");
  });
});
