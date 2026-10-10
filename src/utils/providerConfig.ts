import { audioSourceToFile } from "./audioNaming";

export interface ProviderOptions {
  appId: string;
  accessToken: string;
  customProtocol: "" | "mimo-chat" | "openai-tts" | "fish-tts" | "siliconflow";
  voiceId: string;
  model: string;
  referenceText: string;
  synthesisMode: "reference" | "preset" | "voiceId";
}

export function normalizeProviderOptions(value: Partial<ProviderOptions> = {}): ProviderOptions {
  return {
    appId: value.appId || "", accessToken: "", customProtocol: value.customProtocol || "",
    voiceId: value.voiceId || "", model: value.model || "", referenceText: value.referenceText || "",
    synthesisMode: value.synthesisMode || "reference"
  };
}

export async function appendSynthesisInputs(form: FormData, options: ProviderOptions, audio?: { dataUrl: string; fileName: string; mimeType: string }): Promise<void> {
  form.append("synthesisMode", options.synthesisMode);
  if (options.model.trim()) form.append("model", options.model.trim());
  if (options.synthesisMode === "reference") {
    if (!audio?.dataUrl) throw new Error("参考音频克隆需要上传音频。");
    form.append("voice", await audioSourceToFile(audio.dataUrl, audio.fileName, audio.mimeType));
    form.append("referenceText", options.referenceText.trim());
  } else {
    if (options.synthesisMode === "voiceId" && !options.voiceId.trim()) throw new Error("请填写已注册 Voice ID。");
    if (options.voiceId.trim()) form.append("voiceId", options.voiceId.trim());
  }
}
