import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NodeData } from "../../types/studio";
import type { AudioAsset } from "../../types/studioAudio";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { useSettingsPopover } from "./useSettingsPopover";
import { ROLE_AUDIO_MIME, ROLE_AUDIO_DROPPED_EVENT } from "../../utils/roleAudioDrag";
import { useAudioFavorite } from "../../utils/useAudioFavorite";
import { voiceFavoriteStatus } from "../../utils/voiceFavoriteStatus";
import type { ReactNode } from "react";
import { ChevronDown, Folder, Search, Save, Star, Trash2, Upload, Users, X } from "lucide-react";

type Asset = { id: string; name: string; description: string; naturalControl: string; voiceId: string; provider: string; favorite?: boolean; localAudioFileName?: string; audio?: AudioAsset };
const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("音频读取失败")); reader.readAsDataURL(blob); });
export function RoleVoiceLibrary({ nodeId, data, label = "角色音色库", draft, iconOnly = false }: { nodeId?: string; data?: NodeData; label?: ReactNode; iconOnly?: boolean; draft?: { name: string; audio: AudioAsset } }) {
  const isFavorite = useAudioFavorite(iconOnly ? draft?.audio.dataUrl || "" : "");
  const favoriteLabel = isFavorite ? "已收藏到角色音色库" : "收藏到角色音色库";
  const [open, setOpen] = useState(false), [assets, setAssets] = useState<Asset[]>([]);
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [control, setControl] = useState(""), [voiceId, setVoiceId] = useState("");
  const [audio, setAudio] = useState<AudioAsset | undefined>(), [error, setError] = useState(""), [requestBusy, setBusy] = useState(false), [query, setQuery] = useState("");
  const [migration, setMigration] = useState<{ running: boolean; remainingSeconds: number | null; phase: string; startedAt: number } | null>(null);
  const busy = requestBusy || !!migration?.running;
  const [favoriteOnly, setFavoriteOnly] = useState(false), [directory, setDirectory] = useState("");
  const dialog = useRef<HTMLElement>(null), alive = useRef(true);
  const saving = useRef(false);
  const [quickSave, setQuickSave] = useState(false);
  const migrationError = useRef(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const popover=useSettingsPopover(open && !quickSave,trigger,dialog);
  const audioPicker = useRef<HTMLInputElement>(null);
  const [formExpanded, setFormExpanded] = useState(false);
  const [draggingAudio, setDraggingAudio] = useState(false);
  const [expandedAssets, setExpandedAssets] = useState<string[]>([]);
  const formId = useId();
  const filteredAssets = assets.filter(asset => (!favoriteOnly || asset.favorite) && `${asset.name} ${asset.description}`.toLowerCase().includes(query.toLowerCase()));
  const provider = localStorage.getItem("mimo-api-provider") || "mimo";
  useEffect(() => {
    if (!draggingAudio) return;
    const accepted = () => { setDraggingAudio(false); setOpen(false); };
    window.addEventListener(ROLE_AUDIO_DROPPED_EVENT, accepted);
    return () => window.removeEventListener(ROLE_AUDIO_DROPPED_EVENT, accepted);
  }, [draggingAudio]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!open) { setMigration(null); return; }
    let stopped = false, refreshWhenDone = false, seenStart = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/settings/storage-migration', { signal: controller.signal, cache: 'no-store' });
        if (response.ok) {
          const status = await response.json();
          if (!stopped && typeof status.running === 'boolean') {
            setMigration(status);
            if (status.running) refreshWhenDone = true;
            else if (refreshWhenDone || migrationError.current || (status.phase === 'completed' && status.startedAt !== seenStart)) {
              refreshWhenDone = false; seenStart = status.startedAt;
              if (quickSave) { migrationError.current = false; setError(""); }
              else { await request(); if (!stopped) await refreshLocation(); }
            }
          }
        }
      } catch { /* A later poll can recover from a temporary connection failure. */ }
      finally { if (!stopped) timer = setTimeout(poll, 750); }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [open, quickSave]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const nameInput = dialog.current?.querySelector<HTMLInputElement>(".voice-favorite-name");
    if (nameInput) { nameInput.focus(); nameInput.select(); }
    else dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); }
      if (event.key === "Tab") {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea") || []).filter(element => element.getClientRects().length > 0);
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [open]);
  async function request(method = "GET", body?: Omit<Asset, "id"> | { favorite: boolean }, suffix = "") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/voice-library${suffix}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "角色库操作失败");
      migrationError.current = false;
      voiceFavoriteStatus.refresh();
      if (alive.current) setAssets(result);
      return true;
    } catch (reason) { if (reason instanceof Error && reason.message.includes('数据正在迁移')) migrationError.current = true; if (alive.current) setError(reason instanceof Error ? reason.message : "角色库操作失败"); return false; }
    finally { if (alive.current) setBusy(false); }
  }
  function initialize() {
    setQuickSave(!!draft);
    setFormExpanded(false);
    setExpandedAssets([]);
    setError("");
    setName(draft?.name || data?.title || ""); setDescription(data?.voiceDescription || data?.instruction || ""); setControl(data?.naturalControl || ""); setVoiceId(data?.assetProvider && data.assetProvider !== provider ? "" : data?.voiceId || ""); setAudio(draft?.audio || data?.audio || data?.audioAssets?.[0]); setOpen(true);
    if (!draft) { void request(); void refreshLocation(); }
  }
  async function refreshLocation() {
    try { const response = await fetch('/api/voice-library/location'); const result = response.ok ? await response.json() : null; if (alive.current && result?.directory) setDirectory(result.directory); } catch { /* Refreshed after migration. */ }
  }
  async function readAudio(file: File) {
    if (file.size > 7.5 * 1024 * 1024 || (!file.type.startsWith("audio/") && !/\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(file.name))) throw new Error("请选择不超过 7.5MB 的音频文件。");
    const dataUrl = await toDataUrl(file);
    setAudio({ fileName: file.name, mimeType: file.type || "audio/wav", size: file.size, dataUrl });
  }
  async function save() {
    if (saving.current || busy) return;
    if (!name.trim()) { setError("请填写角色名称。"); return; }
    saving.current = true; setBusy(true); setError("");
    try {
      let savedAudio = audio;
      if (savedAudio && !savedAudio.dataUrl.startsWith("data:")) {
        const response = await fetch(savedAudio.dataUrl); if (!response.ok) throw new Error("参考音频读取失败，未保存角色。");
        savedAudio = { ...savedAudio, dataUrl: await toDataUrl(await response.blob()) };
      }
      const saved = await request("POST", { name: name.trim(), description, naturalControl: control, voiceId, provider, audio: savedAudio, favorite: !!draft });
      if (saved && quickSave && alive.current) setOpen(false);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  function apply(asset: Asset) {
    if (!nodeId || !data?.onPatch) return;
    if (asset.voiceId && asset.provider !== provider) { setError(`此 Voice ID 属于 ${asset.provider}，请先切换 API 服务商后再使用。`); return; }
    data.onPatch(nodeId, { instruction: asset.description, voiceDescription: asset.description, naturalControl: asset.naturalControl, voiceId: asset.voiceId, assetProvider: asset.provider,
      vocalVoiceDescription: asset.description,
      ...(data.batchRows ? { batchRows: data.batchRows.map(row => ({ ...row, instruction: asset.description, naturalControl: asset.naturalControl, refAudioUrl: asset.audio?.dataUrl, refAudioName: asset.audio?.fileName, referenceMode: asset.voiceId ? "inherit" : asset.audio ? "audio" : "none" })) } : {}),
      ...(asset.audio ? { audio: asset.audio, audioAssets: [asset.audio], refAudioUrl: asset.audio.dataUrl, refAudioName: asset.audio.fileName } : {}), error: undefined });
    setOpen(false);
  }
  return <>
    <button ref={trigger} type="button" className={`${iconOnly ? "favorite-icon-button" : "role-library-button"}${iconOnly && isFavorite ? " is-favorite" : ""} nodrag nopan`} title={iconOnly ? favoriteLabel : "角色音色库"} aria-label={iconOnly ? favoriteLabel : undefined} aria-pressed={iconOnly ? isFavorite : undefined} onClick={initialize}>{iconOnly ? <Star size={14} fill={isFavorite ? "currentColor" : "none"} /> : label}</button>
    {open && createPortal(<div className={`studio-about-overlay${quickSave ? " voice-favorite-overlay" : popover.overlayClass}${draggingAudio ? " voice-library-dragging" : ""}`} onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialog} className={`studio-about-dialog voice-library-dialog${quickSave ? " voice-favorite-dialog" : popover.panelClass}`} style={quickSave ? undefined : popover.style} role="dialog" aria-modal="true" aria-label={quickSave ? "收藏音频" : "角色音色资产库"}>
        <header className="voice-library-header"><h3>{quickSave ? <Star size={16} /> : <Users size={17} />}{quickSave ? "收藏音频" : "角色音色资产库"}</h3><button className="settings-close-button" type="button" aria-label="关闭角色音色库" title="关闭" onClick={() => setOpen(false)}><X size={18} /></button></header>
        {quickSave ? <form className="voice-favorite-form" onSubmit={event => { event.preventDefault(); void save(); }}>
          <div className="voice-favorite-body">
            <label>角色名称<input className="voice-favorite-name" placeholder="输入角色名称" value={name} onChange={event => setName(event.target.value)} maxLength={120} disabled={busy} /></label>
            {audio && <div className="voice-favorite-preview"><span title={audio.fileName}>{audio.fileName}</span><StudioAudioPlayer src={audio.dataUrl} /></div>}
            <p className="voice-favorite-note">音频按角色名保存到本地角色库文件夹。</p>
            {isFavorite && <p className="voice-favorite-note">此音频已收藏，保存将新增一个角色。</p>}
            {migration?.running ? <div className="voice-library-migration" role="status"><span>数据正在迁移，请稍候…</span><strong>{migration.remainingSeconds == null ? "正在估算…" : `预计 ${migration.remainingSeconds} 秒`}</strong></div> : error && <p className="voice-library-error" role="alert">{error}</p>}
          </div>
          <footer className="voice-favorite-footer"><button type="button" disabled={busy} onClick={() => setOpen(false)}>取消</button><button className="voice-library-save" type="submit" disabled={busy}><Save size={14} />{busy ? "保存中…" : "收藏并保存"}</button></footer>
        </form> : <div className="voice-library-body">
        <p className="voice-library-intro">音频按角色名保存到下方本地文件夹，可跨画板复用。Voice ID 仅对应服务商，不保存 API Key。</p>
        <div className="voice-library-editor">
        <button type="button" className="voice-library-editor-toggle" aria-expanded={formExpanded} aria-controls={formId} onClick={() => setFormExpanded(value => !value)}><Save size={15} /><span>{draft ? "收藏到角色库" : nodeId ? "保存当前角色" : "新建角色资产"}</span><ChevronDown size={16} /></button>
        <div id={formId} className="voice-library-form" hidden={!formExpanded}>
          <label>角色名称<input placeholder="输入角色名称" value={name} onChange={event => setName(event.target.value)} maxLength={120} /></label>
          <label>Voice ID（{provider}）<input placeholder="可选" value={voiceId} onChange={event => setVoiceId(event.target.value)} /></label>
          <label className="voice-library-wide">音色描述<textarea placeholder="描述角色的音色、音高与声音特点" value={description} onChange={event => setDescription(event.target.value)} rows={2} /></label>
          <label className="voice-library-wide">自然语言控制<textarea placeholder="可选，描述情绪、语速与表演方式" value={control} onChange={event => setControl(event.target.value)} rows={2} /></label>
          <div className="voice-library-wide voice-library-audio-field">
            <span className="voice-library-field-label">参考音频</span>
            <input ref={audioPicker} className="voice-library-native-file" type="file" tabIndex={-1} aria-label="选择角色参考音频" accept="audio/*" onChange={event => { const file = event.target.files?.[0]; if (file) void readAudio(file).catch(reason => setError(reason.message)); event.target.value = ""; }} />
            <div className="voice-library-upload-row">
              <button type="button" onClick={() => audioPicker.current?.click()}><Upload size={14} />{audio ? "更换音频" : "选择音频"}</button>
              <span title={audio?.fileName}>{audio?.fileName || "未添加参考音频"}</span>
              {audio && <button className="voice-library-icon-button" type="button" aria-label="移除参考音频" title="移除参考音频" onClick={() => setAudio(undefined)}><X size={15} /></button>}
            </div>
            {audio ? <StudioAudioPlayer src={audio.dataUrl} /> : <small>支持 MP3、WAV、M4A 等音频，最大 7.5 MB</small>}
          </div>
          <button className="voice-library-wide voice-library-save" type="button" disabled={busy} onClick={() => void save()}><Save size={15} />{busy ? "处理中…" : draft ? "收藏并保存到角色库" : "保存为角色资产"}</button>
        </div>
        </div>
        {migration?.running ? <div className="voice-library-migration" role="status"><span>数据正在迁移，请稍候…</span><strong>{migration.remainingSeconds == null ? (migration.phase === 'committing' ? '正在完成…' : '正在估算…') : `预计 ${migration.remainingSeconds} 秒`}</strong></div> : error && <p className="voice-library-error" role="alert">{error}</p>}
        <div className="voice-library-list-heading"><h4>已保存的角色</h4><span>{filteredAssets.length} 个</span></div>
        <div className="voice-library-filters">
          <div className="voice-library-search"><Search size={15} /><input aria-label="搜索角色资产" placeholder="搜索名称或音色描述" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <button className="voice-library-favorite-filter" type="button" aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly(value => !value)}><Star size={14} fill={favoriteOnly ? "currentColor" : "none"} />仅显示收藏</button>
        </div>
        <p className="voice-library-drag-hint">拖住含音频的角色卡片，放到左侧参考音频区域即可。</p>
        <div className="voice-library-list">{filteredAssets.map(asset => <article key={asset.id}
          draggable={!!asset.audio && !busy} title={asset.audio ? "拖到参考音频区域，仅替换目标行音频" : undefined}
          onDragStart={event => {
            if (!asset.audio || (event.target as HTMLElement).closest("button,input")) { event.preventDefault(); return; }
            event.stopPropagation(); event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData(ROLE_AUDIO_MIME, JSON.stringify(asset.audio)); setDraggingAudio(true);
          }}
          onDragEnd={() => setDraggingAudio(false)}>
          <div className="voice-library-asset-heading"><strong title={asset.name}>{asset.name}</strong>
          <div className="voice-library-asset-actions">
          <button type="button" className="voice-library-description-toggle" aria-expanded={expandedAssets.includes(asset.id)} aria-controls={`${formId}-${asset.id}`} onClick={() => setExpandedAssets(previous => previous.includes(asset.id) ? previous.filter(value => value !== asset.id) : [...previous, asset.id])}>音色描述<ChevronDown size={13} /></button>
          <button className="voice-library-icon-button" type="button" title={asset.favorite ? "取消收藏" : "收藏角色"} aria-label={asset.favorite ? "取消收藏" : "收藏角色"} aria-pressed={!!asset.favorite} disabled={busy} onClick={() => void request("PATCH", { favorite: !asset.favorite }, `/${encodeURIComponent(asset.id)}`)}><Star size={16} fill={asset.favorite ? "currentColor" : "none"} /></button>
          {nodeId && <button type="button" disabled={busy} title={data?.batchRows ? "应用到当前节点所有行" : "应用到当前节点"} onClick={() => apply(asset)}>应用</button>}
          <button className="voice-library-icon-button" type="button" aria-label={`删除角色资产 ${asset.name}`} title="删除角色" disabled={busy} onClick={() => { if (window.confirm(`删除角色资产“${asset.name}”？已应用到画板的副本不会受影响。`)) void request("DELETE", undefined, `/${encodeURIComponent(asset.id)}`); }}><Trash2 size={14} /></button>
          </div>
          </div>
          <div className="voice-library-asset-preview">{asset.audio ? <StudioAudioPlayer src={asset.audio.dataUrl} /> : <small>{asset.voiceId ? `Voice ID · ${asset.provider}` : "文字音色"}</small>}</div>
          <div className="voice-library-asset-details" id={`${formId}-${asset.id}`} hidden={!expandedAssets.includes(asset.id)}>
            <p>{asset.description || "未设置音色描述"}</p>
            {asset.naturalControl && <p><span>自然语言控制</span>{asset.naturalControl}</p>}
            {asset.voiceId && <p><span>Voice ID · {asset.provider}</span>{asset.voiceId}</p>}
            {asset.localAudioFileName && <p><span>本地音频文件</span>{asset.localAudioFileName}</p>}
          </div>
        </article>)}</div>
        {!busy && filteredAssets.length === 0 && <div className="voice-library-empty"><Users size={25} /><p>{assets.length === 0 ? "角色库为空，可从当前节点保存，也可以在这里新建。" : "没有匹配的角色，试试其他关键词或取消收藏筛选。"}</p></div>}
        {directory && <div className="voice-library-location"><Folder size={14} /><span title={directory}>本地文件夹：{directory}</span></div>}
        </div>}
      </section>
    </div>, document.body)}
  </>;
}
