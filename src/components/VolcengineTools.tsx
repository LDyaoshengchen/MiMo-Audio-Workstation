import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ProviderOptions } from "../utils/providerConfig";
import { StyledSelect } from "./StyledSelect";
import { StudioAudioPlayer } from "./StudioAudioPlayer";

const actions = [
  { value: "voice-design", label: "音色设计（文字 / 角色图片）" },
  { value: "voice-register", label: "参考音频注册音色" },
  { value: "voice-query", label: "查询注册音色状态" },
  { value: "audio-create", label: "Seed-Audio 音频创作" },
  { value: "long-submit", label: "V3 长文本提交" }, { value: "long-query", label: "V3 长文本查询" },
  { value: "legacy-long-submit", label: "旧版长文本提交" }, { value: "legacy-long-query", label: "旧版长文本查询" },
  { value: "emotion-long-submit", label: "旧版情感长文本提交" }, { value: "emotion-long-query", label: "旧版情感长文本查询" }
];

function secureAudioUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch { /* No external link for invalid output. */ }
}

async function fileBase64(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MB。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

export function VolcengineTools({ options, onChange, headers }: {
  options: ProviderOptions;
  onChange: Dispatch<SetStateAction<ProviderOptions>>;
  headers: Record<string, string>;
}) {
  const [action, setAction] = useState("voice-query");
  const [speakerId, setSpeakerId] = useState(options.volcengine?.speakerId || options.voiceId || "");
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [taskId, setTaskId] = useState(() => localStorage.getItem("mimo_volc_last_task") || "");
  const [resourceId, setResourceId] = useState("");
  const [language, setLanguage] = useState("0");
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [image, setImage] = useState<File>();
  const [result, setResult] = useState<Record<string, any>>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isQuery = action.endsWith("query");
  const longText = action.includes("long");
  const creating = action === "audio-create";
  async function run() {
    setBusy(true); setError(""); setResult(undefined);
    try {
      if (["voice-design", "voice-register"].includes(action) && !window.confirm("此操作会使用当前音色槽位的设计/注册次数，并可能覆盖该槽位音色。确认执行？")) return;
      if (creating && image && (audioFiles.length || speakerId.trim())) throw new Error("图片参考不能与音频或音色 ID 混用，请先清空其中一种。");
      const audio = action === "voice-register" && audioFiles[0] ? await fileBase64(audioFiles[0]) : undefined;
      const references = creating ? await Promise.all(audioFiles.map(async file => ({ audio: await fileBase64(file), format: file.name.toLowerCase().endsWith(".mp3") ? "mp3" : "wav" }))) : undefined;
      const response = await fetch(`/api/volcengine/tools/${action}`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ speakerId, text, prompt, taskId, resourceId, language: Number(language),
          audio, references, format: audioFiles[0]?.name.toLowerCase().endsWith(".mp3") ? "mp3" : "wav",
          image: image && (creating || action === "voice-design") ? await fileBase64(image) : undefined })
      });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error || "火山引擎操作失败。");
      setResult(output);
      const id = output.data?.task_id || output.task_id;
      if (id) { setTaskId(id); localStorage.setItem("mimo_volc_last_task", id); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败。"); }
    finally { setBusy(false); }
  }
  const output = result?.data && typeof result.data === "object" ? result.data : result;
  const audioUrl = secureAudioUrl(output?.audio_url || output?.demo_audio || output?.speaker_status?.[0]?.demo_audio);
  return <details className="storage-path-card">
    <summary>火山音色与长文本工具</summary>
    <div className="api-form-fields" style={{ marginTop: 8 }}>
      <p className="section-hint">先保存 API 凭证再使用。注册/设计需已开通的音色槽位。长文本提交后保存任务 ID，再点击查询获取下载链接。</p>
      <StyledSelect ariaLabel="火山工具操作" value={action} onValueChange={value => { setAction(value); setResult(undefined); }} options={actions} />
      {isQuery && longText ? <label>任务 ID<input className="api-key-input" value={taskId} onChange={event => setTaskId(event.target.value)} /></label>
        : <label>{creating ? "音色 ID（可选）" : "音色 / 槽位 ID"}<input className="api-key-input" value={speakerId} onChange={event => setSpeakerId(event.target.value)} /></label>}
      {!isQuery && <label>{creating ? "完整音频创作提示词（最多 3000 字符）" : "试听 / 合成文本"}<textarea className="api-key-input" rows={3} value={text} onChange={event => setText(event.target.value)} maxLength={longText ? 100000 : creating ? 3000 : 300} /></label>}
      {action === "voice-design" && <label>音色描述（最多 200 字）<textarea className="api-key-input" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={200} /></label>}
      {(action === "voice-design" || action === "voice-register") && <StyledSelect ariaLabel="注册音色语言" value={language} onValueChange={setLanguage} options={[{ value: "0", label: "中文" }, { value: "1", label: "英文" }]} />}
      {(action === "voice-register" || creating) && <label>{creating ? "参考音频（最多三条，每条不超过 30 秒）" : "注册样本（WAV / MP3）"}<input type="file" accept=".wav,.mp3" multiple={creating} onChange={event => setAudioFiles(Array.from(event.target.files || []).slice(0, creating ? 3 : 1))} /></label>}
      {audioFiles.length > 0 && <button type="button" onClick={() => setAudioFiles([])}>清空参考音频</button>}
      {(action === "voice-design" || creating) && <label>角色图片（可选，PNG / JPEG / WebP）<input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={event => setImage(event.target.files?.[0])} /></label>}
      {image && <button type="button" onClick={() => setImage(undefined)}>清空角色图片</button>}
      {(action.startsWith("legacy") || action.startsWith("emotion")) && <label>长文本 Resource-Id（可留空）<input className="api-key-input" value={resourceId} placeholder={action.startsWith("emotion") ? "volc.tts_async.emotion" : "volc.tts_async.default"} onChange={event => setResourceId(event.target.value)} /></label>}
      <button type="button" disabled={busy} onClick={() => void run()}>{busy ? "处理中…" : isQuery ? "查询" : "提交"}</button>
      {error && <p role="alert" className="node-error">{error}</p>}
      {output && <div role="status">
        {output.task_id && <p>任务 ID：{output.task_id}</p>}
        {output.task_status !== undefined && <p>任务状态码：{output.task_status}</p>}
        {output.status !== undefined && <p>音色状态码：{output.status}（2 / 4 可合成）</p>}
        {output.available_training_times !== undefined && <p>剩余注册/设计次数：{output.available_training_times}</p>}
        {output.speaker_id && <button type="button" onClick={() => onChange(current => ({ ...current, voiceId: output.speaker_id, synthesisMode: "voiceId", volcengine: { ...current.volcengine, transport: "http", resourceId: "seed-icl-2.0" } }))}>使用此音色（保存设置后生效）</button>}
        {audioUrl && <a href={audioUrl} target="_blank" rel="noreferrer">打开音频 / 下载（临时链接）</a>}
        {output.audioDataUrl && <><StudioAudioPlayer src={output.audioDataUrl} /><a href={output.audioDataUrl} download="火山音频创作.wav">下载音频</a></>}
        {output.message && <p>{String(output.message)}</p>}
      </div>}
    </div>
  </details>;
}
