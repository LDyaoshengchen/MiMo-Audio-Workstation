import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ProviderOptions } from "../utils/providerConfig";
import { StyledSelect } from "./StyledSelect";
import { StudioAudioPlayer } from "./StudioAudioPlayer";

type Voice = { voiceId: string; name: string; description: string; type: string };
type Result = { voiceId?: string; voiceType?: string; audioDataUrl?: string; format?: string; deleted?: boolean; voices?: Voice[] };
const newId = () => `mimo_${crypto.randomUUID().replace(/-/g, "")}`;
export function MiniMaxTools({ options, onChange, headers }: { options: ProviderOptions; onChange: Dispatch<SetStateAction<ProviderOptions>>; headers: Record<string, string> }) {
  const [action, setAction] = useState("voice-clone"), [voiceId, setVoiceId] = useState(options.voiceId || newId);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState(""), [text, setText] = useState(""), [promptText, setPromptText] = useState("");
  const [audio, setAudio] = useState<File>(), [promptAudio, setPromptAudio] = useState<File>();
  const [noiseReduction, setNoiseReduction] = useState(false), [volumeNormalization, setVolumeNormalization] = useState(false);
  const [emotion, setEmotion] = useState(""), [speed, setSpeed] = useState("1"), [volume, setVolume] = useState("1"), [pitch, setPitch] = useState("0"), [language, setLanguage] = useState("auto");
  const [voices, setVoices] = useState<Voice[]>([]), [query, setQuery] = useState("");
  const [result, setResult] = useState<Result>(), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const cloning = action === "voice-clone", designing = action === "voice-design", speaking = action === "speak";
  async function request(operation: string, body: object | FormData) {
    const multipart = body instanceof FormData;
    const response = await fetch(`/api/minimax/tools/${operation}`, { method: "POST", headers: { ...headers, ...(!multipart ? { "Content-Type": "application/json" } : {}) }, body: multipart ? body : JSON.stringify(body) });
    const output = await response.json();
    if (!response.ok) throw new Error(output.error || "MiniMax 操作失败。");
    return output as Result;
  }
  async function run() {
    setBusy(true); setError(""); setNotice("");
    try {
      let output: Result;
      if (cloning) {
        if (!audio) throw new Error("请上传克隆参考音频。");
        for (const file of [audio, promptAudio]) if (file && file.size > 20 * 1024 * 1024) throw new Error("每条音频不能超过 20 MB。");
        const body = new FormData();
        body.append("audio", audio); body.append("voiceId", voiceId.trim());
        body.append("noiseReduction", String(noiseReduction)); body.append("volumeNormalization", String(volumeNormalization));
        if (promptAudio) { body.append("promptAudio", promptAudio); body.append("promptText", promptText); }
        output = await request(action, body);
      } else if (designing) output = await request(action, { prompt, text });
      else if (speaking) output = await request(action, { voiceId, text, model: options.model || "speech-2.8-hd", emotion, speed: Number(speed), volume: Number(volume), pitch: Number(pitch), language });
      else output = await request("voice-list", { voiceType: "all" });
      setResult(output);
      if (output.voiceId) setVoiceId(output.voiceId);
      if (output.voices) setVoices(output.voices);
      if (cloning) setNotice("音色克隆完成。可试听、应用到节点，或保存到角色音色库。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败。"); }
    finally { setBusy(false); }
  }
  function useVoice(id: string) {
    setVoiceId(id); onChange(current => ({ ...current, voiceId: id, synthesisMode: "voiceId" }));
    setNotice("已选用此音色，点击下方“保存配置”后节点即可使用。");
  }
  async function saveVoice() {
    if (!voiceId.trim() || !name.trim()) { setError("请填写角色名称和有效 Voice ID。"); return; }
    setBusy(true); setError("");
    try {
      // Store the Voice ID as the reusable identity. A design preview is optional audio, not its identity.
      const preview = result?.voiceId === voiceId ? result.audioDataUrl : undefined;
      const audioAsset = preview && preview.length < 10 * 1024 * 1024 ? { fileName: `${name.trim()}.${result?.format || "wav"}`, mimeType: preview.startsWith("data:audio/mpeg") ? "audio/mpeg" : "audio/wav", dataUrl: preview } : undefined;
      const response = await fetch("/api/voice-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), provider: "minimax", voiceId: voiceId.trim(), description: prompt, naturalControl: "", favorite: true, audio: audioAsset }) });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error || "收藏失败。");
      setNotice("已保存到角色音色库，可从节点打开音色库应用。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "收藏失败。"); }
    finally { setBusy(false); }
  }
  async function deleteVoice(voice: Voice) {
    if (!window.confirm(`永久删除 MiniMax 云端音色“${voice.name}”？已有节点引用的此 Voice ID 将失效。本地收藏需另行删除。`)) return;
    setBusy(true); setError("");
    try {
      await request("voice-delete", { voiceId: voice.voiceId, voiceType: voice.type });
      setVoices(current => current.filter(item => item.voiceId !== voice.voiceId));
      if (voiceId === voice.voiceId) { setVoiceId(""); setResult(undefined); }
      if (options.voiceId === voice.voiceId) onChange(current => ({ ...current, voiceId: "", synthesisMode: "preset" }));
      setNotice("云端音色已删除。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败。"); }
    finally { setBusy(false); }
  }
  const canUse = !!voiceId.trim() && (speaking || result?.voiceId === voiceId || voiceId === options.voiceId);
  return <details className="storage-path-card">
    <summary>MiniMax 音色设计、语音克隆与音色库</summary>
    <div className="api-form-fields" style={{ marginTop: 8 }}>
      <p className="section-hint">先填写 MiniMax 密钥。克隆、设计及合成按平台规则计费；克隆样本 10 秒至 5 分钟，每条不超过 20 MB。创建后可直接选用或收藏。</p>
      <StyledSelect ariaLabel="MiniMax 功能" value={action} onValueChange={value => { setAction(value); setError(""); setNotice(""); }} options={[{ value: "voice-clone", label: "参考音频克隆" }, { value: "voice-design", label: "文字音色设计" }, { value: "speak", label: "语音合成 / 试听" }, { value: "voice-list", label: "查询与管理云端音色" }]} />
      {action !== "voice-list" && <>
        <label>角色名称<input className="api-key-input" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="收藏到角色库时使用" /></label>
        {!designing && <label>{cloning ? "新音色 ID" : "Voice ID"}<input className="api-key-input" value={voiceId} maxLength={256} onChange={e => setVoiceId(e.target.value)} /></label>}
        {cloning && <>
          <button type="button" disabled={busy} onClick={() => { setVoiceId(newId()); setResult(undefined); }}>生成新的音色 ID</button>
          <label>克隆参考音频<input aria-label="MiniMax 克隆参考音频" type="file" accept=".wav,.mp3,.m4a" onChange={e => { setAudio(e.target.files?.[0]); setResult(undefined); }} /></label>
          <label><input type="checkbox" checked={noiseReduction} onChange={e => setNoiseReduction(e.target.checked)} /> 样本降噪</label>
          <label><input type="checkbox" checked={volumeNormalization} onChange={e => setVolumeNormalization(e.target.checked)} /> 样本音量归一化</label>
          <details><summary>增强相似度：补充示例音频（可选）</summary>
            <label>示例音频（小于 8 秒）<input type="file" accept=".wav,.mp3,.m4a" onChange={e => setPromptAudio(e.target.files?.[0])} /></label>
            <label>示例音频原文<textarea className="api-key-input" value={promptText} maxLength={1000} onChange={e => setPromptText(e.target.value)} /></label>
          </details>
        </>}
        {designing && <label>音色描述<textarea className="api-key-input" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="描述性别、年龄、音高、质感和表达方式" /></label>}
        {(designing || speaking) && <label>试听 / 合成台词<textarea className="api-key-input" value={text} maxLength={9999} onChange={e => setText(e.target.value)} /></label>}
        {speaking && <>
          <StyledSelect ariaLabel="MiniMax 情绪" value={emotion} onValueChange={setEmotion} options={[{ value: "", label: "自动情绪" }, ...[["happy", "高兴"], ["sad", "悲伤"], ["angry", "愤怒"], ["fearful", "害怕"], ["disgusted", "厌恶"], ["surprised", "惊讶"], ["calm", "平静"]].map(([value, label]) => ({ value, label }))]} />
          <div style={{ display: "flex", gap: 8 }}>{[["语速", speed, setSpeed, 0.5, 2, 0.1], ["音量", volume, setVolume, 0.1, 10, 0.1], ["音调", pitch, setPitch, -12, 12, 1]].map(([label, value, setter, min, max, step]) => <label key={label as string} style={{ flex: 1, minWidth: 0 }}>{label as string}<input className="api-key-input" type="number" value={value as string} min={min as number} max={max as number} step={step as number} onChange={e => (setter as (value: string) => void)(e.target.value)} /></label>)}</div>
          <StyledSelect ariaLabel="MiniMax 语言" value={language} onValueChange={setLanguage} options={[{ value: "auto", label: "自动语言" }, ...[["Chinese", "中文"], ["Chinese,Yue", "粤语"], ["English", "英语"], ["Japanese", "日语"], ["Korean", "韩语"], ["Spanish", "西班牙语"], ["French", "法语"], ["German", "德语"]].map(([value, label]) => ({ value, label }))]} />
        </>}
      </>}
      <button type="button" disabled={busy} onClick={() => void run()}>{busy ? "处理中…" : cloning ? "创建克隆音色" : designing ? "设计音色并试听" : speaking ? "生成语音" : "刷新云端音色"}</button>
      {result?.audioDataUrl && <><StudioAudioPlayer src={result.audioDataUrl} /><a href={result.audioDataUrl} download={`${name || "MiniMax试听"}.${result.format || "wav"}`}>下载试听音频</a></>}
      {result?.voiceId && <p className="section-hint">已创建 / 使用的 Voice ID：{result.voiceId}</p>}
      {canUse && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button" disabled={busy} onClick={() => useVoice(voiceId)}>使用此音色</button><button type="button" disabled={busy} onClick={() => void saveVoice()}>收藏到角色音色库</button>{cloning && <button type="button" disabled={busy} onClick={() => setAction("speak")}>试听克隆音色</button>}</div>}
      {action === "voice-list" && <>
        <input aria-label="搜索 MiniMax 云端音色" className="api-key-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索名称、描述或 Voice ID" />
        <div style={{ maxHeight: 260, overflowY: "auto" }}>{voices.filter(voice => `${voice.name} ${voice.voiceId} ${voice.description}`.toLowerCase().includes(query.toLowerCase())).map(voice => <div className="storage-path-card" key={`${voice.type}:${voice.voiceId}`} style={{ padding: 8, margin: "4px 0" }}>
          <strong>{voice.name}</strong><p className="section-hint">{voice.type === "system" ? "官方预置" : voice.type === "voice_cloning" ? "克隆音色" : "设计音色"} · {voice.description || voice.voiceId}</p>
          <button type="button" disabled={busy} onClick={() => { setVoiceId(voice.voiceId); setName(voice.name); setPrompt(voice.description); setAction("speak"); setResult(undefined); }}>选用 / 试听</button>
          {voice.type !== "system" && <button type="button" disabled={busy} onClick={() => void deleteVoice(voice)}>删除云端音色</button>}
        </div>)}</div>
        <p className="section-hint">新创建的音色通常需正式合成一次后才会出现在云端查询列表中。本地收藏不会代替云端激活。</p>
      </>}
      {notice && <p role="status" className="section-hint">{notice}</p>}
      {error && <p role="alert" className="node-error">{error}</p>}
    </div>
  </details>;
}
