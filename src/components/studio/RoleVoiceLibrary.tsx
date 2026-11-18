import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NodeData } from "../../types/studio";
import type { AudioAsset } from "../../types/studioAudio";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { StyledSelect } from "../StyledSelect";
import { useSettingsPopover } from "./useSettingsPopover";
import { ROLE_AUDIO_MIME, ROLE_AUDIO_DROPPED_EVENT } from "../../utils/roleAudioDrag";
import { useAudioFavorite } from "../../utils/useAudioFavorite";
import { voiceFavoriteStatus } from "../../utils/voiceFavoriteStatus";
import { MIMO_OFFICIAL_PRESET_GROUP_ID, MIMO_OFFICIAL_PRESET_GROUP_NAME, OFFICIAL_MIMO_PRESET_VOICES } from "../../studio/mimoPresetVoices";
import type { ReactNode } from "react";
import { Check, ChevronDown, Folder, FolderPlus, Pencil, Plus, Search, Save, Star, Trash2, Upload, Users, X } from "lucide-react";

type Asset = { id: string; name: string; description: string; naturalControl: string; voiceId: string; provider: string; voiceAssetMode?: "preset"; language?: string; gender?: string; builtIn?: boolean; subtitle?: string; favorite?: boolean; groupId?: string | null; localAudioFileName?: string; audio?: AudioAsset };
type AssetGroup = { id: string; name: string; builtIn?: boolean; displayName?: string };
const OFFICIAL_GROUP: AssetGroup = { id: MIMO_OFFICIAL_PRESET_GROUP_ID, name: MIMO_OFFICIAL_PRESET_GROUP_NAME, builtIn: true };
const OFFICIAL_ASSET_IDS = new Set<string>(OFFICIAL_MIMO_PRESET_VOICES.map(voice => voice.id));
const OFFICIAL_FAVORITES_KEY = "mimo-official-preset-favorites";
const VOICE_LIBRARY_PREFS_KEY = "mimo-role-voice-library-prefs";
type LibraryPrefs = { query?: string; groupFilter?: string; favoriteOnly?: boolean; languageFilter?: string; genderFilter?: string; groupSort?: "manual" | "name" | "count"; collapsedGroupIds?: string[] };
function readLibraryPrefs(): LibraryPrefs {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(VOICE_LIBRARY_PREFS_KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return {
      query: typeof value.query === "string" ? value.query.slice(0, 500) : undefined,
      groupFilter: typeof value.groupFilter === "string" ? value.groupFilter.slice(0, 128) : undefined,
      favoriteOnly: value.favoriteOnly === true,
      languageFilter: ["中文", "英文", "其他"].includes(value.languageFilter) ? value.languageFilter : "",
      genderFilter: ["女性", "男性", "其他"].includes(value.genderFilter) ? value.genderFilter : "",
      groupSort: ["manual", "name", "count"].includes(value.groupSort) ? value.groupSort : "manual",
      collapsedGroupIds: Array.isArray(value.collapsedGroupIds) ? value.collapsedGroupIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 500) : undefined,
    };
  }
  catch { return {}; }
}
function readOfficialFavorites() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(OFFICIAL_FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && OFFICIAL_ASSET_IDS.has(id)) : [];
  } catch { return []; }
}
function withOfficialAssets(userAssets: Asset[], favorites: string[]): Asset[] {
  const official = OFFICIAL_MIMO_PRESET_VOICES.map(voice => ({
    ...voice, naturalControl: "", provider: "mimo", voiceAssetMode: "preset" as const, builtIn: true,
    subtitle: `${voice.language} · ${voice.gender}`, favorite: favorites.includes(voice.id), groupId: MIMO_OFFICIAL_PRESET_GROUP_ID
  }));
  return [...userAssets.filter(asset => !OFFICIAL_ASSET_IDS.has(asset.id)), ...official];
}
function withOfficialGroup(userGroups: AssetGroup[]): AssetGroup[] {
  return [OFFICIAL_GROUP, ...userGroups.filter(group => group.id !== OFFICIAL_GROUP.id).map(group => group.name === OFFICIAL_GROUP.name ? { ...group, displayName: `${group.name}（自定义）` } : group)];
}
const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("音频读取失败")); reader.readAsDataURL(blob); });
export function RoleVoiceLibrary({ nodeId, data, label = "角色音色库", draft, iconOnly = false, allowOfficialPresets = false, allowPresetReference = false, openRequest }: { nodeId?: string; data?: NodeData; label?: ReactNode; iconOnly?: boolean; draft?: { name: string; audio: AudioAsset }; allowOfficialPresets?: boolean; allowPresetReference?: boolean; openRequest?: number }) {
  const [initialLibraryPrefs] = useState(readLibraryPrefs);
  const isFavorite = useAudioFavorite(iconOnly ? draft?.audio.dataUrl || "" : "");
  const favoriteLabel = isFavorite ? "已收藏到角色音色库" : "收藏到角色音色库";
  const [open, setOpen] = useState(false), [officialFavorites, setOfficialFavorites] = useState<string[]>(readOfficialFavorites), [assets, setAssets] = useState<Asset[]>(() => withOfficialAssets([], readOfficialFavorites())), [groups, setGroups] = useState<AssetGroup[]>(() => withOfficialGroup([]));
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [control, setControl] = useState(""), [voiceId, setVoiceId] = useState(""), [assetLanguage, setAssetLanguage] = useState(""), [assetGender, setAssetGender] = useState("");
  const [audio, setAudio] = useState<AudioAsset | undefined>(), [error, setError] = useState(""), [notice, setNotice] = useState(""), [requestBusy, setBusy] = useState(false), [query, setQuery] = useState(initialLibraryPrefs.query || "");
  const [migration, setMigration] = useState<{ running: boolean; remainingSeconds: number | null; phase: string; startedAt: number } | null>(null);
  const busy = requestBusy || !!migration?.running;
  const [favoriteOnly, setFavoriteOnly] = useState(initialLibraryPrefs.favoriteOnly || false), [directory, setDirectory] = useState("");
  const [groupFilter, setGroupFilter] = useState(initialLibraryPrefs.groupFilter ?? "all"), [assetGroupId, setAssetGroupId] = useState("");
  const [languageFilter, setLanguageFilter] = useState(initialLibraryPrefs.languageFilter || ""), [genderFilter, setGenderFilter] = useState(initialLibraryPrefs.genderFilter || "");
  const [groupSort, setGroupSort] = useState<NonNullable<LibraryPrefs["groupSort"]>>(initialLibraryPrefs.groupSort || "manual");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>(initialLibraryPrefs.collapsedGroupIds || []);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [newGroupOpen, setNewGroupOpen] = useState(false), [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState(""), [editingGroupName, setEditingGroupName] = useState("");
  const [assetRename, setAssetRename] = useState<{ id: string; name: string } | null>(null);
  const dialog = useRef<HTMLElement>(null), alive = useRef(true), selectionAnchor = useRef<string | null>(null);
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
  useEffect(() => {
    try { globalThis.localStorage?.setItem(VOICE_LIBRARY_PREFS_KEY, JSON.stringify({ query, groupFilter, favoriteOnly, languageFilter, genderFilter, groupSort, collapsedGroupIds } satisfies LibraryPrefs)); }
    catch { /* Preferences remain usable for the current session if storage is unavailable. */ }
  }, [query, groupFilter, favoriteOnly, languageFilter, genderFilter, groupSort, collapsedGroupIds]);
  const editableGroups = groups.filter(group => !group.builtIn);
  const filteredAssets = assets.filter(asset => {
    const searchable = `${asset.name} ${asset.description} ${asset.naturalControl} ${asset.voiceId} ${asset.subtitle || ""} ${asset.audio?.fileName || ""}`.toLowerCase();
    const languageText = `${asset.language || ""} ${asset.description} ${asset.naturalControl} ${asset.subtitle || ""}`.toLowerCase();
    const genderText = `${asset.gender || ""} ${asset.description} ${asset.naturalControl} ${asset.subtitle || ""}`.toLowerCase();
    const languageMatches = !languageFilter || (languageFilter === "中文" ? /中文|汉语|chinese|普通话/.test(languageText) : languageFilter === "英文" ? /英文|英语|english/.test(languageText) : !/中文|汉语|chinese|普通话|英文|英语|english/.test(languageText));
    const genderMatches = !genderFilter || (genderFilter === "女性" ? /女性|女声|female|woman/.test(genderText) : genderFilter === "男性" ? /男性|男声|male|man/.test(genderText) : !/女性|女声|female|woman|男性|男声|male|man/.test(genderText));
    return (!favoriteOnly || asset.favorite) && (groupFilter === "all" || (asset.groupId || "") === groupFilter) && searchable.includes(query.toLowerCase()) && languageMatches && genderMatches;
  });
  const selectableFilteredAssets = filteredAssets.filter(asset => !asset.builtIn);
  const ungroupedAssets = filteredAssets.filter(asset => !asset.groupId);
  const visibleGroupsUnsorted = groupFilter === "all"
    ? [...(ungroupedAssets.length ? [{ id: "", name: "未分组", assets: ungroupedAssets }] : []), ...groups.map(group => ({ ...group, assets: filteredAssets.filter(asset => asset.groupId === group.id) })).filter(group => group.assets.length)]
    : groups.filter(group => group.id === groupFilter).map(group => ({ ...group, assets: filteredAssets }));
  const visibleGroups = groupSort === "manual" ? visibleGroupsUnsorted : [...visibleGroupsUnsorted].sort((left, right) => {
    if (!left.id) return -1;
    if (!right.id) return 1;
    return groupSort === "name" ? (left.displayName || left.name).localeCompare(right.displayName || right.name, "zh-CN") : right.assets.length - left.assets.length;
  });
  const selectableAssetIds = visibleGroups.flatMap(group => collapsedGroupIds.includes(group.id || "unassigned") ? [] : group.assets.filter(asset => !asset.builtIn || allowPresetReference).map(asset => asset.id));
  const provider = globalThis.localStorage?.getItem("mimo-api-provider") || "mimo";
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
              else { await request(); await loadGroups(); if (!stopped) await refreshLocation(); }
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
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, select:not(:disabled)") || []).filter(element => element.getClientRects().length > 0);
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [open]);
  async function request(method = "GET", body?: Partial<Omit<Asset, "id">> | { favorite: boolean }, suffix = "") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/voice-library${suffix}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "角色库操作失败");
      migrationError.current = false;
      voiceFavoriteStatus.refresh();
      if (alive.current) {
        setAssets(withOfficialAssets(result, officialFavorites));
        setSelectedAssetIds(current => current.filter(id => result.some((asset: Asset) => asset.id === id)));
      }
      return true;
    } catch (reason) { if (reason instanceof Error && reason.message.includes('数据正在迁移')) migrationError.current = true; if (alive.current) setError(reason instanceof Error ? reason.message : "角色库操作失败"); return false; }
    finally { if (alive.current) setBusy(false); }
  }
  async function loadGroups(collapseAll = false) {
    try {
      const response = await fetch("/api/voice-library/groups", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "分组读取失败");
      if (alive.current) {
        const nextGroups = withOfficialGroup(result);
        setGroups(nextGroups);
        if (collapseAll) {
          const savedCollapsed = readLibraryPrefs().collapsedGroupIds;
          setCollapsedGroupIds(savedCollapsed || ["unassigned", ...nextGroups.map(group => group.id)]);
        }
      }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "分组读取失败"); }
  }
  async function changeGroups(method: "POST" | "PATCH" | "DELETE", groupId = "", name?: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/voice-library/groups${groupId ? `/${encodeURIComponent(groupId)}` : ""}`, {
        method, headers: { "Content-Type": "application/json" }, ...(name !== undefined ? { body: JSON.stringify({ name }) } : {})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "分组操作失败");
      if (alive.current) {
        if (method === "DELETE") { setGroups(withOfficialGroup(result.groups)); setAssets(withOfficialAssets(result.assets, officialFavorites)); }
        else setGroups(withOfficialGroup(result));
      }
      return result;
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes("数据正在迁移")) migrationError.current = true;
      if (alive.current) setError(reason instanceof Error ? reason.message : "分组操作失败");
      return null;
    } finally { if (alive.current) setBusy(false); }
  }
  async function createGroup() {
    const groupName = newGroupName.trim();
    if (!groupName) { setError("请填写分组名称。"); return; }
    if (groupName.toLocaleLowerCase() === MIMO_OFFICIAL_PRESET_GROUP_NAME.toLocaleLowerCase()) { setError(`“${MIMO_OFFICIAL_PRESET_GROUP_NAME}”是官方保留分组名称。`); return; }
    const result = await changeGroups("POST", "", groupName) as AssetGroup[] | null;
    if (result) {
      const group = result.find(item => item.name === groupName);
      if (group) { setGroupFilter(group.id); setAssetGroupId(group.id); }
      setNewGroupName(""); setNewGroupOpen(false);
    }
  }
  async function renameGroup(groupId: string) {
    const groupName = editingGroupName.trim();
    if (!groupName) { setError("请填写分组名称。"); return; }
    if (groupName.toLocaleLowerCase() === MIMO_OFFICIAL_PRESET_GROUP_NAME.toLocaleLowerCase()) { setError(`“${MIMO_OFFICIAL_PRESET_GROUP_NAME}”是官方保留分组名称。`); return; }
    const result = await changeGroups("PATCH", groupId, groupName) as AssetGroup[] | null;
    if (result) { setEditingGroupId(""); setEditingGroupName(""); }
  }
  async function deleteGroup(group: AssetGroup) {
    if (!window.confirm(`删除分组“${group.name}”？组内角色会移到“未分组”，音频文件不会删除。`)) return;
    const result = await changeGroups("DELETE", group.id) as { groups: AssetGroup[]; assets: Asset[] } | null;
    if (result && groupFilter === group.id) setGroupFilter("all");
    if (result && assetGroupId === group.id) setAssetGroupId("");
    if (!result) { await loadGroups(); await request(); }
  }
  async function changeAssetGroup(asset: Asset, groupId: string) {
    if (busy) return;
    const assetIds = selectedAssetIds.includes(asset.id) ? selectedAssetIds.filter(id => !assets.find(item => item.id === id)?.builtIn) : [asset.id];
    const destination = groupId ? groups.find(group => group.id === groupId)?.displayName || groups.find(group => group.id === groupId)?.name || "分组" : "未分组";
    setError(""); setNotice("");
    if (assetIds.length <= 1) {
      if (await request("PATCH", { groupId: groupId || null }, `/${encodeURIComponent(asset.id)}`)) {
        setNotice(`已将 ${assetIds.length} 个音色移至“${destination}”。`);
        setCollapsedGroupIds(current => current.filter(id => id !== (groupId || "unassigned")));
      }
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/voice-library/bulk-group", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds, groupId: groupId || null })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "批量移动分组失败。");
      if (alive.current) {
        setAssets(withOfficialAssets(result, officialFavorites));
        setNotice(`已将 ${assetIds.length} 个音色移至“${destination}”。`);
        setCollapsedGroupIds(current => current.filter(id => id !== (groupId || "unassigned")));
        if (groupFilter !== "all" && groupFilter !== (groupId || "")) setGroupFilter("all");
      }
      voiceFavoriteStatus.refresh();
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes("数据正在迁移")) migrationError.current = true;
      if (alive.current) setError(reason instanceof Error ? reason.message : "批量移动分组失败。");
    } finally { if (alive.current) setBusy(false); }
  }
  function selectAsset(assetId: string, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }, checkboxToggle = false) {
    const index = selectableAssetIds.indexOf(assetId);
    const anchorIndex = selectionAnchor.current ? selectableAssetIds.indexOf(selectionAnchor.current) : -1;
    if (event.shiftKey && index >= 0 && anchorIndex >= 0) {
      const range = selectableAssetIds.slice(Math.min(index, anchorIndex), Math.max(index, anchorIndex) + 1);
      setSelectedAssetIds(current => event.ctrlKey || event.metaKey ? [...new Set([...current, ...range])] : range);
      return;
    }
    selectionAnchor.current = assetId;
    if (event.ctrlKey || event.metaKey || checkboxToggle) {
      setSelectedAssetIds(current => current.includes(assetId) ? current.filter(id => id !== assetId) : [...current, assetId]);
      return;
    }
    setSelectedAssetIds([assetId]);
  }
  function initialize() {
    setQuickSave(!!draft);
    setFormExpanded(false);
    setCollapsedGroupIds(readLibraryPrefs().collapsedGroupIds || ["unassigned", ...groups.map(group => group.id)]);
    setSelectedAssetIds([]);
    setExpandedAssets([]);
    setNewGroupOpen(false); setNewGroupName(""); setEditingGroupId(""); setEditingGroupName("");
    setError(""); setNotice("");
    setName(draft?.name || data?.title || ""); setDescription(data?.voiceDescription || data?.instruction || ""); setControl(data?.naturalControl || ""); setVoiceId(data?.assetProvider && data.assetProvider !== provider ? "" : data?.voiceId || ""); setAudio(draft?.audio || data?.audio || data?.audioAssets?.[0]); setAssetGroupId(groupFilter === "all" || groupFilter === MIMO_OFFICIAL_PRESET_GROUP_ID ? "" : groupFilter); setOpen(true);
    void loadGroups(true);
    if (!draft) { void request(); void refreshLocation(); }
  }
  useEffect(() => { if (openRequest != null && openRequest > 0) initialize(); }, [openRequest]);
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
      const saved = await request("POST", { name: name.trim(), description, naturalControl: control, voiceId, provider, ...(assetLanguage ? { language: assetLanguage } : {}), ...(assetGender ? { gender: assetGender } : {}), voiceAssetMode: !draft && data?.voiceAssetMode === "preset" ? "preset" : undefined, audio: savedAudio, favorite: !!draft, groupId: assetGroupId || undefined });
      if (saved && quickSave && alive.current) setOpen(false);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  function apply(asset: Asset) {
    if (!nodeId || !data?.onPatch) return;
    if (asset.voiceId && asset.provider !== provider) { setError(`此 Voice ID 属于 ${asset.provider}，请先切换 API 服务商后再使用。`); return; }
    if (asset.voiceAssetMode === "preset" && !allowOfficialPresets && !allowPresetReference) { setError("MiMo 官方预置音色仅支持预置音色合成节点。"); return; }
    if (asset.voiceAssetMode === "preset" && allowPresetReference) {
      data.onPatch(nodeId, { title: asset.name, voiceId: asset.voiceId, assetProvider: asset.provider, voiceAssetMode: "preset", audio: undefined, audioAssets: [], refAudioUrl: undefined, refAudioName: undefined, error: undefined });
      setOpen(false);
      return;
    }
    const appliedDescription = asset.builtIn ? data.voiceDescription ?? data.instruction ?? "" : asset.description;
    const appliedControl = asset.builtIn ? data.naturalControl || "" : asset.naturalControl;
    data.onPatch(nodeId, { ...(allowPresetReference ? { title: asset.name, audio: asset.audio, audioAssets: asset.audio ? [asset.audio] : [], refAudioUrl: asset.audio?.dataUrl, refAudioName: asset.audio?.fileName } : {}), instruction: asset.provider === "minimax" && asset.voiceId ? "" : appliedDescription, voiceDescription: appliedDescription, naturalControl: appliedControl, voiceId: asset.voiceId, assetProvider: asset.provider, voiceAssetMode: asset.voiceAssetMode,
      vocalVoiceDescription: asset.builtIn ? data.vocalVoiceDescription ?? appliedDescription : asset.description,
      ...(data.batchRows ? { batchRows: data.batchRows.map(row => ({ ...row, instruction: asset.provider === "minimax" && asset.voiceId ? "" : asset.builtIn ? row.instruction : asset.description, naturalControl: asset.builtIn ? row.naturalControl : asset.naturalControl, refAudioUrl: asset.audio?.dataUrl, refAudioName: asset.audio?.fileName, referenceMode: asset.voiceId ? "inherit" : asset.audio ? "audio" : "none" })) } : {}),
      ...(!allowPresetReference && asset.audio ? { audio: asset.audio, audioAssets: [asset.audio], refAudioUrl: asset.audio.dataUrl, refAudioName: asset.audio.fileName } : {}), error: undefined });
    setOpen(false);
  }
  function toggleFavorite(asset: Asset) {
    if (!asset.builtIn) { void request("PATCH", { favorite: !asset.favorite }, `/${encodeURIComponent(asset.id)}`); return; }
    const nextFavorites = officialFavorites.includes(asset.id) ? officialFavorites.filter(id => id !== asset.id) : [...officialFavorites, asset.id];
    setOfficialFavorites(nextFavorites);
    try { globalThis.localStorage?.setItem(OFFICIAL_FAVORITES_KEY, JSON.stringify(nextFavorites)); } catch { /* The built-in voice remains usable when storage is unavailable. */ }
    setAssets(current => current.map(item => item.id === asset.id ? { ...item, favorite: nextFavorites.includes(asset.id) } : item));
  }
  const renderAsset = (asset: Asset) => <article key={asset.id} className={`${selectedAssetIds.includes(asset.id) ? "is-selected" : ""}${asset.builtIn ? " is-official-preset" : ""}`}
    draggable={!!asset.audio && !busy} title={nodeId && data?.onPatch ? allowPresetReference && asset.audio ? "点击应用为参考音频；也可拖到节点上传区域" : allowPresetReference && asset.voiceAssetMode === "preset" ? "点击应用此官方预置 Voice ID" : "点击应用到当前节点" : asset.audio ? "拖到参考音频区域，仅替换目标行音频" : undefined}
    onClick={event => {
      if ((event.target as HTMLElement).closest("button,input,select,textarea,a,[role='button'],label.voice-library-asset-group,.studio-player")) return;
      if (nodeId && data?.onPatch) { apply(asset); return; }
      if (asset.builtIn && !(allowPresetReference && asset.voiceAssetMode === "preset")) return;
      selectAsset(asset.id, event);
    }}
    onDragStart={event => {
      if (!asset.audio || (event.target as HTMLElement).closest("button,input,select")) { event.preventDefault(); return; }
      event.stopPropagation(); event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(ROLE_AUDIO_MIME, JSON.stringify(asset.audio)); setDraggingAudio(true);
    }}
    onDragEnd={() => setDraggingAudio(false)}>
    <div className="voice-library-asset-heading">
    <div className="voice-library-asset-title">
    <input className="voice-library-asset-select" type="checkbox" aria-label={`选择${asset.name}${asset.builtIn ? "以应用到节点" : "以批量移动分组"}`} checked={selectedAssetIds.includes(asset.id)} disabled={busy || (!!asset.builtIn && !allowPresetReference)}
      onClick={event => { event.stopPropagation(); event.preventDefault(); selectAsset(asset.id, event, true); }} />
    <strong title={asset.name}>{asset.name}</strong>
    <button type="button" className="voice-library-description-toggle" aria-label={`${expandedAssets.includes(asset.id) ? "收起" : "展开"}${asset.name}的音色描述`} title="音色描述" aria-expanded={expandedAssets.includes(asset.id)} aria-controls={`${formId}-${asset.id}`} onClick={() => setExpandedAssets(previous => previous.includes(asset.id) ? previous.filter(value => value !== asset.id) : [...previous, asset.id])}><ChevronDown size={14} /></button>
    </div>
    <div className="voice-library-asset-actions">
    {!asset.builtIn && <button className="voice-library-icon-button" type="button" aria-label={`重命名角色资产 ${asset.name}`} title="编辑名称" disabled={busy} onClick={event => { event.stopPropagation(); setAssetRename({ id: asset.id, name: asset.name }); }}><Pencil size={13} /></button>}
    <button className="voice-library-icon-button" type="button" title={asset.favorite ? "取消收藏" : "收藏角色"} aria-label={asset.favorite ? "取消收藏" : "收藏角色"} aria-pressed={!!asset.favorite} disabled={busy} onClick={() => toggleFavorite(asset)}><Star size={16} fill={asset.favorite ? "currentColor" : "none"} /></button>
    {!asset.builtIn && <button className="voice-library-icon-button" type="button" aria-label={`删除角色资产 ${asset.name}`} title="删除角色" disabled={busy} onClick={() => { if (window.confirm(`删除角色资产“${asset.name}”？已应用到画板的副本不会受影响。`)) void request("DELETE", undefined, `/${encodeURIComponent(asset.id)}`); }}><Trash2 size={14} /></button>}
    </div>
    </div>
    {assetRename?.id === asset.id && <form className="voice-library-new-group" onClick={event => event.stopPropagation()} onSubmit={async event => {
      event.preventDefault();
      const name = assetRename.name.trim();
      if (!name || busy) return;
      if (await request("PATCH", { name }, `/${encodeURIComponent(asset.id)}`)) setAssetRename(null);
    }}>
      <input aria-label="角色资产名称" value={assetRename.name} onChange={event => setAssetRename({ id: asset.id, name: event.target.value })} maxLength={120} autoFocus disabled={busy} />
      <button type="submit" aria-label="保存名称" disabled={busy || !assetRename.name.trim()}><Check size={13} /></button>
      <button type="button" aria-label="取消改名" disabled={busy} onClick={() => setAssetRename(null)}><X size={13} /></button>
    </form>}
    <div className={`voice-library-asset-preview${asset.voiceAssetMode === "preset" ? " is-preset" : ""}`}>
      {asset.voiceAssetMode === "preset" ? <><span className="voice-library-asset-kind">Voice ID 预置</span><small>{asset.subtitle || `Voice ID · ${asset.provider}`}</small></> : asset.audio ? <><span className="voice-library-asset-kind">本地参考音频</span><StudioAudioPlayer src={asset.audio.dataUrl} /></> : <small>{asset.subtitle || (asset.voiceId ? `Voice ID · ${asset.provider}` : "文字音色")}</small>}
    </div>
    {!asset.builtIn && <label className="voice-library-asset-group"><Folder size={12} /><StyledSelect ariaLabel={`设置${asset.name}的分组`} value={asset.groupId || ""} disabled={busy} onValueChange={value => void changeAssetGroup(asset, value)} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "", label: "未分组" }, ...editableGroups.map(group => ({ value: group.id, label: group.displayName || group.name }))]} /></label>}
    <div className="voice-library-asset-details" id={`${formId}-${asset.id}`} hidden={!expandedAssets.includes(asset.id)}>
      {(asset.language || asset.gender) && <p><span>语言 / 性别</span>{[asset.language, asset.gender].filter(Boolean).join(" · ")}</p>}
      <p>{asset.description || "未设置音色描述"}</p>
      {asset.naturalControl && <p><span>自然语言控制</span>{asset.naturalControl}</p>}
      {asset.voiceId && <p><span>Voice ID · {asset.provider}</span>{asset.voiceId}</p>}
      {asset.localAudioFileName && <p><span>本地音频文件</span>{asset.localAudioFileName}</p>}
      {nodeId && data?.onPatch && (!asset.builtIn || allowOfficialPresets || (asset.voiceAssetMode === "preset" && allowPresetReference))
        ? <button type="button" disabled={busy} title={allowPresetReference && asset.voiceAssetMode === "preset" ? "将 MiMo 预置音色应用到此参考节点，连接克隆节点后按该音色合成" : data?.batchRows ? "应用到当前节点所有行" : "应用到当前节点"} onClick={() => apply(asset)}>{allowPresetReference && asset.audio ? "应用为参考音频" : allowPresetReference ? "应用" : "应用到当前节点"}</button>
        : nodeId && data?.onPatch && asset.builtIn ? <small>仅支持 MiMo 预置音色合成节点或参考音频节点</small> : null}
    </div>
  </article>;
  return <>
    <button ref={trigger} type="button" className={`${iconOnly ? "favorite-icon-button" : "role-library-button"}${iconOnly && isFavorite ? " is-favorite" : ""} nodrag nopan`} title={iconOnly ? favoriteLabel : "角色音色库"} aria-label={iconOnly ? favoriteLabel : undefined} aria-pressed={iconOnly ? isFavorite : undefined} onClick={initialize}>{iconOnly ? <Star size={14} fill={isFavorite ? "currentColor" : "none"} /> : label}</button>
    {open && createPortal(<div className={`studio-about-overlay${quickSave ? " voice-favorite-overlay" : popover.overlayClass}${draggingAudio ? " voice-library-dragging" : ""}`} onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialog} className={`studio-about-dialog voice-library-dialog${nodeId && !quickSave ? " voice-library-node-dialog" : ""}${quickSave ? " voice-favorite-dialog" : popover.panelClass}`} style={quickSave ? undefined : popover.style} role="dialog" aria-modal="true" aria-label={quickSave ? "收藏音频" : "角色音色资产库"}>
        <header className="voice-library-header"><h3>{quickSave ? <Star size={16} /> : <Users size={17} />}{quickSave ? "收藏音频" : "角色音色资产库"}</h3><button className="settings-close-button" type="button" aria-label="关闭角色音色库" title="关闭" onClick={() => setOpen(false)}><X size={18} /></button></header>
        {quickSave ? <form className="voice-favorite-form" onSubmit={event => { event.preventDefault(); void save(); }}>
          <div className="voice-favorite-body">
            <label>角色名称<input className="voice-favorite-name" placeholder="输入角色名称" value={name} onChange={event => setName(event.target.value)} maxLength={120} disabled={busy} /></label>
            <label>分组<StyledSelect value={assetGroupId} onValueChange={setAssetGroupId} disabled={busy} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "", label: "未分组" }, ...editableGroups.map(group => ({ value: group.id, label: group.displayName || group.name }))]} /></label>
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
          <label>语言<StyledSelect ariaLabel="音色语言" value={assetLanguage} onValueChange={setAssetLanguage} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "", label: "未设置" }, { value: "中文", label: "中文" }, { value: "英文", label: "英文" }, { value: "其他", label: "其他" }]} /></label>
          <label>性别<StyledSelect ariaLabel="音色性别" value={assetGender} onValueChange={setAssetGender} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "", label: "未设置" }, { value: "女性", label: "女性" }, { value: "男性", label: "男性" }, { value: "其他", label: "其他" }]} /></label>
          <label className="voice-library-wide">所属分组<StyledSelect value={assetGroupId} onValueChange={setAssetGroupId} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "", label: "未分组" }, ...editableGroups.map(group => ({ value: group.id, label: group.displayName || group.name }))]} /></label>
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
        {!migration?.running && notice && <p className="voice-library-success" role="status">{notice}</p>}
        <div className="voice-library-list-heading"><h4>已保存的角色</h4><span>{filteredAssets.length} 个</span></div>
        <div className="voice-library-filters">
          <div className="voice-library-search"><Search size={15} /><input aria-label="搜索角色资产" placeholder="搜索名称或音色描述" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <button className="voice-library-favorite-filter" type="button" aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly(value => !value)}><Star size={14} fill={favoriteOnly ? "currentColor" : "none"} />仅显示收藏</button>
        </div>
        <div className="voice-library-metadata-filters">
          <StyledSelect ariaLabel="按语言筛选音色" value={languageFilter} onValueChange={setLanguageFilter} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "", label: "全部语言" }, { value: "中文", label: "中文" }, { value: "英文", label: "英文" }, { value: "其他", label: "其他" }]} />
          <StyledSelect ariaLabel="按性别筛选音色" value={genderFilter} onValueChange={setGenderFilter} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "", label: "全部性别" }, { value: "女性", label: "女性" }, { value: "男性", label: "男性" }, { value: "其他", label: "其他" }]} />
        </div>
        <div className="voice-library-group-tools">
          <Folder size={14} />
          <StyledSelect ariaLabel="按分组筛选角色" value={groupFilter} onValueChange={setGroupFilter} className="voice-library-select" triggerClassName="voice-library-select-trigger" options={[{ value: "all", label: "全部分组" }, { value: "", label: "未分组" }, ...groups.map(group => ({ value: group.id, label: group.displayName || group.name }))]} />
          <StyledSelect ariaLabel="分组排序" value={groupSort} onValueChange={value => setGroupSort(value as NonNullable<LibraryPrefs["groupSort"]>)} className="voice-library-select voice-library-sort" triggerClassName="voice-library-select-trigger" options={[{ value: "manual", label: "默认排序" }, { value: "name", label: "按名称" }, { value: "count", label: "按音色数量" }]} />
          <button type="button" onClick={() => { setNewGroupOpen(value => !value); setNewGroupName(""); }}><FolderPlus size={14} /><Plus size={12} />新建分组</button>
        </div>
        {selectableFilteredAssets.length > 0 && <button type="button" className="voice-library-select-visible" disabled={busy} onClick={() => { selectionAnchor.current = selectableFilteredAssets[0]?.id || null; setSelectedAssetIds(current => [...new Set([...current, ...selectableFilteredAssets.map(asset => asset.id)])]); }}>全选当前筛选结果（{selectableFilteredAssets.length}）</button>}
        {newGroupOpen && <form className="voice-library-new-group" onSubmit={event => { event.preventDefault(); void createGroup(); }}><input aria-label="新分组名称" placeholder="输入分组名称" value={newGroupName} onChange={event => setNewGroupName(event.target.value)} maxLength={60} autoFocus /><button type="submit" disabled={busy}><Check size={14} />创建</button><button type="button" disabled={busy} onClick={() => setNewGroupOpen(false)}>取消</button></form>}
        <p className="voice-library-drag-hint">{allowPresetReference ? "点击音色卡片直接应用到此参考音频节点并同步名称；官方预置仅配置 Voice ID，不包含音频文件。" : "顶部音色库：点击卡片多选（Shift 连选，Ctrl/⌘ 单选）；修改已选音色的分组会批量移动。带音频资产可拖至参考音频区。"}</p>
        <div className="voice-library-list">{visibleGroups.map(group => {
          const groupKey = group.id || "unassigned";
          const collapsed = collapsedGroupIds.includes(groupKey);
          const cardsId = `${formId}-group-${groupKey}`;
          return <section className="voice-library-group" key={groupKey}>
          <div className="voice-library-group-heading">
            {editingGroupId === group.id && group.id && !group.builtIn ? <form onSubmit={event => { event.preventDefault(); void renameGroup(group.id); }}><input aria-label="分组名称" value={editingGroupName} onChange={event => setEditingGroupName(event.target.value)} maxLength={60} /><button type="submit" disabled={busy} title="保存分组名称"><Check size={13} /></button><button type="button" disabled={busy} title="取消编辑" onClick={() => setEditingGroupId("")}><X size={13} /></button></form> : <><button type="button" className={`voice-library-group-toggle${collapsed ? " is-collapsed" : ""}`} aria-label={`${collapsed ? "展开" : "折叠"}分组 ${group.displayName || group.name}`} aria-expanded={!collapsed} aria-controls={cardsId} onClick={() => setCollapsedGroupIds(current => collapsed ? current.filter(id => id !== groupKey) : [...current, groupKey])}><ChevronDown size={14} className="voice-library-group-chevron" /><Folder size={14} /><strong>{group.displayName || group.name}</strong></button><span>{group.assets.length} 个</span>{group.id && !group.builtIn && <div><button type="button" title="重命名分组" aria-label={`重命名分组 ${group.displayName || group.name}`} disabled={busy} onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}><Pencil size={13} /></button><button type="button" title="删除分组" aria-label={`删除分组 ${group.displayName || group.name}`} disabled={busy} onClick={() => void deleteGroup(group)}><Trash2 size={13} /></button></div>}</>}
          </div>
          {!collapsed && <div className="voice-library-group-cards" id={cardsId}>{group.assets.map(renderAsset)}</div>}
        </section>;
        })}</div>
        {!busy && filteredAssets.length === 0 && <div className="voice-library-empty"><Users size={25} /><p>{assets.length === 0 ? "角色库为空，可从当前节点保存，也可以在这里新建。" : "没有匹配的角色，试试其他关键词或取消收藏筛选。"}</p></div>}
        {directory && <div className="voice-library-location"><Folder size={14} /><span title={directory}>本地文件夹：{directory}</span></div>}
        </div>}
      </section>
    </div>, document.body)}
  </>;
}
