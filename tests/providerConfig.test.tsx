// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
    expect(render("custom")).toContain("role=\"combobox\"");
  });

  it("opens the unified protocol dropdown with all provider options", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(<ProviderSettingsFields provider="custom" options={normalizeProviderOptions()} error="" onChange={() => {}} />));
      const protocol = host.querySelector<HTMLButtonElement>("[role=combobox]")!;
      await act(async () => protocol.click());
      expect(document.body.textContent).toContain("OpenAI TTS");
      expect(document.body.textContent).toContain("MiMo Chat");
      expect(document.body.textContent).toContain("Fish TTS");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
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

  it("applies an official MiMo asset as preset synthesis with its required model", async () => {
    const form = new FormData();
    await appendSynthesisInputs(form, normalizeProviderOptions(), undefined, "Chloe", "preset");
    expect(form.get("synthesisMode")).toBe("preset");
    expect(form.get("model")).toBe("mimo-v2.5-tts");
    expect(form.get("voiceId")).toBe("Chloe");
    expect(form.has("voice")).toBe(false);
  });

  it("download extensions follow real MIME or cache URL rather than a stale WAV name", () => {
    expect(getAudioFileExtension("data:audio/mpeg;base64,SUQz", "stale.wav")).toBe(".mp3");
    expect(getAudioFileExtension("/api/audio-cache/voice.mp3", "stale.wav")).toBe(".mp3");
    expect(getAudioFileExtension("data:audio/wav;base64,UklGRg==", "stale.mp3")).toBe(".wav");
  });
});
