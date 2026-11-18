import type { Dispatch, SetStateAction } from "react";
import type { ProviderOptions } from "../utils/providerConfig";
import { StyledSelect } from "./StyledSelect";
import { normalizeVolcengineOptions } from "../../shared/volcengine";

export function ProviderSettingsFields({ provider, options, error, onChange }: {
  provider: string;
  options: ProviderOptions;
  error: string;
  onChange: Dispatch<SetStateAction<ProviderOptions>>;
}) {
  return (
  <div className="api-form-fields">
    {error && <p role="alert" style={{ color: "#ef4444" }}>{error}</p>}
    {provider === "minimax" && <p className="section-hint">参考音频模式会自动上传并创建克隆音色；同一账号、相同音频复用已创建的 Voice ID，按平台规则计费。节点样本须为 10 秒至 5 分钟，WAV / MP3 不超过 7.5 MB；下方工具另支持 M4A 和 20 MB 样本。默认预置音色 male-qn-qingse。语音风格请留空自动判断，或填写高兴、悲伤、愤怒、害怕、厌恶、惊讶、平静；文字音色设计可填写完整描述。</p>}
    {provider === "custom" && <label>自定义协议
      <StyledSelect value={options.customProtocol} placeholder="请选择协议" className="api-select" triggerClassName="api-key-input" onValueChange={value => onChange(o => ({ ...o, customProtocol: value as ProviderOptions["customProtocol"] }))} options={[{ value: "mimo-chat", label: "MiMo Chat" }, { value: "openai-tts", label: "OpenAI TTS" }, { value: "fish-tts", label: "Fish TTS" }, { value: "siliconflow", label: "SiliconFlow" }]} />
    </label>}
    {provider === "volcengine" && <>
      <p className="section-hint">新版控制台填写 API Key 即可。旧版凭证请填写 AppID 与 AccessToken。</p>
      <label>合成接口<StyledSelect ariaLabel="火山合成接口" value={options.volcengine?.transport || "http"}
        onValueChange={value => onChange(current => ({ ...current, volcengine: normalizeVolcengineOptions({ ...current.volcengine, transport: value as import("../../shared/volcengine").VolcengineTransport }) }))}
        options={[{ value: "http", label: "V3 HTTP 单向流式（推荐）" }, { value: "sse", label: "V3 SSE 单向流式" }, { value: "websocket", label: "V3 WebSocket 单向流式" }, { value: "bidirectional", label: "V3 WebSocket 双向流式" }, { value: "create", label: "Seed-Audio 音频生成 / 参考音频生成" }, { value: "legacy", label: "旧版小模型 HTTP" }, { value: "legacyWebsocket", label: "旧版小模型 WebSocket" }]} /></label>
      <label>资源 ID<StyledSelect ariaLabel="火山资源 ID" value={options.volcengine?.resourceId || "seed-tts-2.0"}
        onValueChange={value => onChange(current => ({ ...current, volcengine: { ...current.volcengine, resourceId: value } }))}
        options={["seed-tts-2.0", "seed-icl-2.0", "seed-tts-1.0", "seed-tts-1.0-concurr", "seed-icl-1.0", "seed-icl-1.0-concurr"].map(value => ({ value, label: value }))} /></label>
      <label>旧版 Cluster<input className="api-key-input" value={options.volcengine?.cluster || "volcano_tts"} onChange={event => onChange(current => ({ ...current, volcengine: { ...current.volcengine, cluster: event.target.value } }))} /></label>
      <label>AppID<input className="api-key-input" value={options.appId} onChange={e => onChange(o => ({ ...o, appId: e.target.value }))} /></label>
      <label>AccessToken<input type="password" className="api-key-input" value={options.accessToken} placeholder="已保存的 Token 留空保持；切换厂商需重新填写" onChange={e => onChange(o => ({ ...o, accessToken: e.target.value }))} /></label>
      <p className="section-hint">预置音色示例：zh_female_vv_uranus_bigtts。注册音色选择 seed-icl-2.0。直接参考音频生成选择 Seed-Audio。音色创造节点使用 Seed-Audio；固定音色设计和注册在下方工具执行。</p>
    </>}
    <label>克隆类节点的合成模式
      <StyledSelect value={options.synthesisMode} className="api-select" triggerClassName="api-key-input" onValueChange={value => onChange(o => ({ ...o, synthesisMode: value as ProviderOptions["synthesisMode"] }))} options={[{ value: "reference", label: "参考音频克隆（需厂商支持）" }, { value: "preset", label: "预置音色合成（不会克隆参考音频）" }, { value: "voiceId", label: "已注册 Voice ID 合成" }]} />
    </label>
    {options.synthesisMode !== "reference" && <label>音色名称 / Voice ID
      <input className="api-key-input" value={options.voiceId} placeholder="如 alloy；定制音色填写厂商注册的 ID" onChange={e => onChange(o => ({ ...o, voiceId: e.target.value }))} />
    </label>}
    <label>合成模型（留空使用厂商默认）
      {provider === "minimax" ? <StyledSelect ariaLabel="MiniMax 合成模型" value={options.model || "speech-2.8-hd"} onValueChange={model => onChange(o => ({ ...o, model }))} options={["speech-2.8-hd", "speech-2.8-turbo", "speech-2.6-hd", "speech-2.6-turbo", "speech-02-hd", "speech-02-turbo", "speech-01-hd", "speech-01-turbo"].map(value => ({ value, label: value }))} /> : <input className="api-key-input" value={options.model} onChange={e => onChange(o => ({ ...o, model: e.target.value }))} />}
    </label>
    {options.synthesisMode === "reference" && <label>参考音频原文（SiliconFlow / Fish 必填）
      <textarea className="api-key-input" value={options.referenceText} placeholder="填写参考音频实际说出的文字；批量使用不同参考音频时请分别配置后运行。" onChange={e => onChange(o => ({ ...o, referenceText: e.target.value }))} />
    </label>}
    <p className="api-capability-note">能力标记代表本项目已接入的功能。ElevenLabs 音色设计、各厂商 ASR 暂未接入。</p>
  </div>
  );
}
