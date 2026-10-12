import type { Dispatch, SetStateAction } from "react";
import type { ProviderOptions } from "../utils/providerConfig";

export function ProviderSettingsFields({ provider, options, error, onChange }: {
  provider: string;
  options: ProviderOptions;
  error: string;
  onChange: Dispatch<SetStateAction<ProviderOptions>>;
}) {
  return (
  <div className="api-form-fields">
    {error && <p role="alert" style={{ color: "#ef4444" }}>{error}</p>}
    {provider === "custom" && <label>自定义协议
      <select className="api-key-input" value={options.customProtocol} onChange={e => onChange(o => ({ ...o, customProtocol: e.target.value as ProviderOptions["customProtocol"] }))}>
        <option value="">请选择协议</option><option value="mimo-chat">MiMo Chat</option><option value="openai-tts">OpenAI TTS</option><option value="fish-tts">Fish TTS</option><option value="siliconflow">SiliconFlow</option>
      </select>
    </label>}
    {provider === "volcengine" && <>
      <label>AppID<input className="api-key-input" value={options.appId} onChange={e => onChange(o => ({ ...o, appId: e.target.value }))} /></label>
      <label>AccessToken<input type="password" className="api-key-input" value={options.accessToken} placeholder="已保存的 Token 留空保持；切换厂商需重新填写" onChange={e => onChange(o => ({ ...o, accessToken: e.target.value }))} /></label>
    </>}
    <label>克隆类节点的合成模式
      <select className="api-key-input" value={options.synthesisMode} onChange={e => onChange(o => ({ ...o, synthesisMode: e.target.value as ProviderOptions["synthesisMode"] }))}>
        <option value="reference">参考音频克隆（需厂商支持）</option>
        <option value="preset">预置音色合成（不会克隆参考音频）</option>
        <option value="voiceId">已注册 Voice ID 合成</option>
      </select>
    </label>
    {options.synthesisMode !== "reference" && <label>音色名称 / Voice ID
      <input className="api-key-input" value={options.voiceId} placeholder="如 alloy；定制音色填写厂商注册的 ID" onChange={e => onChange(o => ({ ...o, voiceId: e.target.value }))} />
    </label>}
    <label>合成模型（留空使用厂商默认）
      <input className="api-key-input" value={options.model} onChange={e => onChange(o => ({ ...o, model: e.target.value }))} />
    </label>
    {options.synthesisMode === "reference" && <label>参考音频原文（SiliconFlow / Fish 必填）
      <textarea className="api-key-input" value={options.referenceText} placeholder="填写参考音频实际说出的文字；批量使用不同参考音频时请分别配置后运行。" onChange={e => onChange(o => ({ ...o, referenceText: e.target.value }))} />
    </label>}
    <p className="api-capability-note">能力标记代表本项目已接入的功能。ElevenLabs 音色设计、各厂商 ASR 暂未接入。</p>
  </div>
  );
}
