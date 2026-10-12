import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import { useSettingsPopover } from "./useSettingsPopover";
import type { ProviderOptions } from "../../utils/providerConfig";
import { API_PROVIDERS } from "../../studio/config";
import { X, Key, Sparkles } from "lucide-react";
import { ProviderSettingsFields } from "../ProviderSettingsFields";
import { normalizeProviderOptions } from "../../utils/providerConfig";

export interface ApiSettingsDialogProps {
  showApiKeyModal: boolean;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (e: React.MouseEvent<HTMLDivElement>, onClose: () => void) => void;
  closeApiKeyModal: () => void;
  apiProviderInput: string;
  setApiProviderInput: Dispatch<SetStateAction<string>>;
  setApiKeyInput: Dispatch<SetStateAction<string>>;
  setProviderOptionsInput: Dispatch<SetStateAction<ProviderOptions>>;
  setApiEndpointInput: Dispatch<SetStateAction<string>>;
  providerOptionsInput: ProviderOptions;
  apiEndpointInput: string;
  serverApiKeyConfigured: boolean;
  apiKeyInput: string;
  settingsError: string;
  saveApiKey: () => Promise<void>;
}

export function ApiSettingsDialog({
  showApiKeyModal,
  handleBackdropMouseDown,
  handleBackdropClick,
  closeApiKeyModal,
  apiProviderInput,
  setApiProviderInput,
  setApiKeyInput,
  setProviderOptionsInput,
  setApiEndpointInput,
  providerOptionsInput,
  apiEndpointInput,
  serverApiKeyConfigured,
  apiKeyInput,
  settingsError,
  saveApiKey,
}: ApiSettingsDialogProps) {
  const panel=useRef<HTMLDivElement>(null);
  const popover=useSettingsPopover(showApiKeyModal,'.topbar-actions .status-pill',panel);
  return (<>{showApiKeyModal && (
    <div
      className={`api-key-modal${popover.overlayClass}`}
      onMouseDown={handleBackdropMouseDown}
      onClick={(e) => handleBackdropClick(e, closeApiKeyModal)}
    >
      <div ref={panel} className={`api-key-modal-content${popover.panelClass}`} style={popover.style} onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <Key size={18} />
            配置 AI 语音/文本 API 密钥与服务入口
          </h3>
          <button className="api-key-modal-close settings-close-button" type="button" aria-label="关闭 API 设置" title="关闭" onClick={closeApiKeyModal}>
            <X size={18} />
          </button>
        </div>
        <div className="api-key-modal-body">
          {/* 1. 服务商快捷选择 (紧凑 4 列横排) */}
          <div className="api-provider-section">
            <div className="api-provider-section-header">
              <span className="api-provider-section-title">
                <Sparkles size={14} /> AI 服务商 / API 协议：
              </span>
              {(() => {
                const currentPreset = API_PROVIDERS.find((p) => p.id === apiProviderInput) || API_PROVIDERS[0];
                return currentPreset.getKeyUrl ? (
                  <a href={currentPreset.getKeyUrl} target="_blank" rel="noopener noreferrer" className="api-provider-quicklink">
                    获取 {currentPreset.name} API Key ↗
                  </a>
                ) : null;
              })()}
            </div>
            <div className="api-provider-grid">
              {API_PROVIDERS.map((p) => {
                const isActive = apiProviderInput === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={isActive ? "api-provider-card active" : "api-provider-card"}
                    onClick={() => {
                      setApiProviderInput(p.id);
                      setApiKeyInput("");
                      setProviderOptionsInput(normalizeProviderOptions({ synthesisMode: p.capabilities.instantClone ? "reference" : "preset" }));
                      if (p.endpoint) {
                        setApiEndpointInput(p.endpoint);
                      }
                    }}
                  >
                    <span className="api-provider-name">{p.name}</span>
                    <span className="api-provider-badge">{p.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 当前服务商能力与快捷预设 (单行紧凑整合) */}
          {(() => {
            const customProvider = ({ "mimo-chat": "mimo", "openai-tts": "openai", "fish-tts": "fishaudio", siliconflow: "siliconflow" } as Record<string, string>)[providerOptionsInput.customProtocol];
            const currentPreset = API_PROVIDERS.find(p => p.id === (apiProviderInput === "custom" ? customProvider : apiProviderInput)) || { ...API_PROVIDERS[0], capabilities: { textOptimization: false, presetTTS: false, voiceDesign: false, instantClone: false, trainedClone: false, asr: false } };
            return (
              <div className="api-provider-compact-bar">
                <div className="api-cap-mini-list">
                  <span className="api-cap-mini-label">项目已接入：</span>
                  <span className={`api-cap-mini-tag ${currentPreset.capabilities.instantClone ? "supported" : "unsupported"}`}>
                    {currentPreset.capabilities.instantClone ? "✓" : "✕"} 即时克隆
                  </span>
                  <span className={`api-cap-mini-tag ${currentPreset.capabilities.presetTTS ? "supported" : "unsupported"}`}>
                    {currentPreset.capabilities.presetTTS ? "✓" : "✕"} 预置TTS
                  </span>
                  <span className={`api-cap-mini-tag ${currentPreset.capabilities.voiceDesign ? "supported" : "unsupported"}`}>
                    {currentPreset.capabilities.voiceDesign ? "✓" : "✕"} 音色设计
                  </span>
                  <span className={`api-cap-mini-tag ${currentPreset.capabilities.textOptimization ? "supported" : "unsupported"}`}>
                    {currentPreset.capabilities.textOptimization ? "✓" : "✕"} 文本润色
                  </span>
                  <span className={`api-cap-mini-tag ${currentPreset.capabilities.trainedClone ? "supported" : "unsupported"}`}>
                    {currentPreset.capabilities.trainedClone ? "✓" : "✕"} 训练克隆
                  </span>
                  <span className={`api-cap-mini-tag ${currentPreset.capabilities.asr ? "supported" : "unsupported"}`}>
                    {currentPreset.capabilities.asr ? "✓" : "✕"} ASR
                  </span>
                </div>

                {currentPreset.subEndpoints && currentPreset.subEndpoints.length > 0 ? (
                  <div className="endpoint-pill-group">
                    <span className="endpoint-pill-label">预设地址快捷选：</span>
                    {currentPreset.subEndpoints.map((sub) => (
                      <button
                        key={sub.url}
                        type="button"
                        className={apiEndpointInput === sub.url ? "endpoint-pill active" : "endpoint-pill"}
                        onClick={() => setApiEndpointInput(sub.url)}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })()}

          {/* 3. 输入表单 (API Key & Endpoint URL) */}
          <div className="api-form-fields">
            <div className="api-key-field">
              <div className="api-field-label">
                <span>API Key 密钥：</span>
                {serverApiKeyConfigured && !apiKeyInput && (
                  <span className="api-field-badge-env">服务端已保存配置</span>
                )}
              </div>
              <input
                type="password"
                className="api-key-input"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={serverApiKeyConfigured ? "服务端已配置，留空保持密钥" : "sk-..."}
                spellCheck={false}
              />
            </div>

            <div className="api-endpoint-section">
              <div className="api-field-label">
                <span>API 服务地址 (Endpoint URL)：</span>
              </div>
              <input
                type="text"
                className="api-key-input"
                value={apiEndpointInput}
                onChange={(e) => setApiEndpointInput(e.target.value)}
                placeholder="https://..."
                spellCheck={false}
              />
            </div>
          </div>
          <ProviderSettingsFields provider={apiProviderInput} options={providerOptionsInput} error={settingsError} onChange={setProviderOptionsInput} />
        </div>

        <div className="api-key-modal-footer">
          <button type="button" className="api-key-btn-cancel" onClick={closeApiKeyModal}>
            取消
          </button>
          <button type="button" className="api-key-btn-save" onClick={saveApiKey}>
            保存配置
          </button>
        </div>
      </div>
    </div>
  )}</>);
}
