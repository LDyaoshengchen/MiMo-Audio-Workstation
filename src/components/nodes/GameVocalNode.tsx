import type { AudioAsset } from "../../types/studioAudio";
import type { GameCharacterType } from "../../utils/gameVocalCharacterTags";
import type { NodeProps } from "@xyflow/react";
import type { SelectedVocalItem } from "../../utils/gameVocalLibrary";
import type { StudioNode, StudioEdge, NodeData } from "../../types/studio";
import { GAME_CHARACTER_TYPES, buildVoiceDescriptionFromTags, getRandomCharacterTags } from "../../utils/gameVocalCharacterTags";
import { GAME_VOCAL_CATEGORIES, getRandomItemsFromSubcategory } from "../../utils/gameVocalLibrary";
import { Gamepad2, Mic2, Sparkles, AlertTriangle, Check, Trash2, Zap, Plus, X, Loader2, Square } from "lucide-react";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { createId, formatBytes } from "../../studio/format";
import { memo, useState, useEffect, useMemo } from "react";
import { resolveGameVocalInputs } from "../../studio/graph";
import { useAutoUpdateNodeInternals } from "../../studio/nodeInternals";
import { useReactFlow, Handle, Position } from "@xyflow/react";

export const GameVocalNode = memo(function GameVocalNode({ id, data }: NodeProps<StudioNode>) {
  const { getNodes, getEdges } = useReactFlow();
  const [resolvedAudioInfo, setResolvedAudioInfo] = useState<{
    audio?: AudioAsset;
    sourceTitle?: string;
  }>({});

  useEffect(() => {
    const currentNodes = getNodes() as StudioNode[];
    const currentEdges = getEdges() as StudioEdge[];
    const currentNode = currentNodes.find((n) => n.id === id);
    if (currentNode) {
      const res = resolveGameVocalInputs(currentNode, currentNodes, currentEdges);
      setResolvedAudioInfo({ audio: res.audio, sourceTitle: res.sourceTitle });
    }
  }, [id, data, getNodes, getEdges]);

  const activeCategoryId = data.selectedCategoryId || GAME_VOCAL_CATEGORIES[0].id;
  const activeCategory = GAME_VOCAL_CATEGORIES.find((c) => c.id === activeCategoryId) || GAME_VOCAL_CATEGORIES[0];

  const activeSubcategoryId = data.selectedSubcategoryId || activeCategory.subcategories[0]?.id;
  const activeSubcategory =
    activeCategory.subcategories.find((s) => s.id === activeSubcategoryId) ||
    activeCategory.subcategories[0];

  const selectedVocals = data.selectedVocals || [];

  const refMode = data.vocalRefMode || "clone";
  const activeCharType = data.vocalCharacterType || "human";
  const currentCharCategory = GAME_CHARACTER_TYPES.find((c) => c.id === activeCharType) || GAME_CHARACTER_TYPES[0];
  const selectedCharTags = data.vocalSelectedTags ?? currentCharCategory.defaultSelectedTags;

  const generatedVoiceDesc = useMemo(() => {
    return buildVoiceDescriptionFromTags(activeCharType, selectedCharTags);
  }, [activeCharType, selectedCharTags]);

  useAutoUpdateNodeInternals(id, [selectedVocals.length, activeCategoryId, activeSubcategoryId, refMode, activeCharType, selectedCharTags.length]);

  const [customText, setCustomText] = useState("");

  function patchData(patch: Partial<NodeData>) {
    data.onPatch?.(id, patch);
  }

  function handleSelectCharType(newType: GameCharacterType) {
    const cat = GAME_CHARACTER_TYPES.find((c) => c.id === newType) || GAME_CHARACTER_TYPES[0];
    const newTags = cat.defaultSelectedTags;
    patchData({
      vocalCharacterType: newType,
      vocalSelectedTags: newTags,
      vocalVoiceDescription: buildVoiceDescriptionFromTags(newType, newTags)
    });
  }

  function toggleCharTag(tag: string) {
    const exists = selectedCharTags.includes(tag);
    const newTags = exists
      ? selectedCharTags.filter((t) => t !== tag)
      : [...selectedCharTags, tag];
    patchData({
      vocalSelectedTags: newTags,
      vocalVoiceDescription: buildVoiceDescriptionFromTags(activeCharType, newTags)
    });
  }

  function handleRandomCharacterTags() {
    const randomTags = getRandomCharacterTags(activeCharType);
    patchData({
      vocalSelectedTags: randomTags,
      vocalVoiceDescription: buildVoiceDescriptionFromTags(activeCharType, randomTags)
    });
  }

  function handleResetCharacterTags() {
    patchData({
      vocalSelectedTags: currentCharCategory.defaultSelectedTags,
      vocalVoiceDescription: buildVoiceDescriptionFromTags(activeCharType, currentCharCategory.defaultSelectedTags)
    });
  }

  function handleClearCharacterTags() {
    patchData({
      vocalSelectedTags: [],
      vocalVoiceDescription: buildVoiceDescriptionFromTags(activeCharType, [])
    });
  }

  function handleSelectCategory(catId: string) {
    const cat = GAME_VOCAL_CATEGORIES.find((c) => c.id === catId);
    if (!cat) return;
    const firstSub = cat.subcategories[0];
    patchData({
      selectedCategoryId: cat.id,
      selectedSubcategoryId: firstSub?.id,
      instruction: cat.defaultInstruction
    });
  }

  function handleSelectSubcategory(subId: string) {
    patchData({ selectedSubcategoryId: subId });
  }

  function isItemChecked(text: string) {
    return selectedVocals.some((v) => v.text.toLowerCase() === text.toLowerCase());
  }

  function toggleVocalItem(text: string) {
    const exists = selectedVocals.some((v) => v.text.toLowerCase() === text.toLowerCase());
    if (exists) {
      patchData({
        selectedVocals: selectedVocals.filter((v) => v.text.toLowerCase() !== text.toLowerCase())
      });
    } else {
      const newItem: SelectedVocalItem = {
        id: createId("vocal"),
        categoryId: activeCategory.id,
        categoryTitle: activeCategory.title,
        subcategoryId: activeSubcategory.id,
        subcategoryLabel: activeSubcategory.label,
        text
      };
      patchData({
        selectedVocals: [...selectedVocals, newItem]
      });
    }
  }

  function handleSelectAllCurrentSub() {
    const currentItems = activeSubcategory.items;
    const existingTexts = new Set(selectedVocals.map((v) => v.text.toLowerCase()));
    const newItems: SelectedVocalItem[] = [];
    currentItems.forEach((txt) => {
      if (!existingTexts.has(txt.toLowerCase())) {
        newItems.push({
          id: createId("vocal"),
          categoryId: activeCategory.id,
          categoryTitle: activeCategory.title,
          subcategoryId: activeSubcategory.id,
          subcategoryLabel: activeSubcategory.label,
          text: txt
        });
      }
    });
    patchData({ selectedVocals: [...selectedVocals, ...newItems] });
  }

  function handleRandomPick(count: number) {
    const picks = getRandomItemsFromSubcategory(activeSubcategory, count);
    const existingTexts = new Set(selectedVocals.map((v) => v.text.toLowerCase()));
    const newItems: SelectedVocalItem[] = [];
    picks.forEach((txt) => {
      if (!existingTexts.has(txt.toLowerCase())) {
        newItems.push({
          id: createId("vocal"),
          categoryId: activeCategory.id,
          categoryTitle: activeCategory.title,
          subcategoryId: activeSubcategory.id,
          subcategoryLabel: activeSubcategory.label,
          text: txt
        });
      }
    });
    patchData({ selectedVocals: [...selectedVocals, ...newItems] });
  }

  function handleClearAll() {
    patchData({ selectedVocals: [] });
  }

  function handleRemoveItem(itemId: string) {
    patchData({
      selectedVocals: selectedVocals.filter((v) => v.id !== itemId)
    });
  }

  function handleAddCustom() {
    const trimmed = customText.trim();
    if (!trimmed) return;
    const newItem: SelectedVocalItem = {
      id: createId("vocal"),
      categoryId: activeCategory.id,
      categoryTitle: activeCategory.title,
      subcategoryId: activeSubcategory.id,
      subcategoryLabel: activeSubcategory.label,
      text: trimmed
    };
    patchData({
      selectedVocals: [...selectedVocals, newItem]
    });
    setCustomText("");
  }

  return (
    <StudioNodeFrame id={id} data={data} icon={<Gamepad2 size={17} />} tone="game-vocal">
      <Handle type="target" position={Position.Left} id="voice" className="node-handle" style={{ top: 70 }} />
      <span className="input-handle-label" style={{ top: 70 }}>
        {refMode === "design" ? "参考(可选)" : "参考"}
      </span>

      <Handle type="target" position={Position.Left} id="instruction" className="node-handle" style={{ top: 130 }} />
      <span className="input-handle-label" style={{ top: 130 }}>风格</span>

      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />

      <div className="game-vocal-container nodrag">
        {/* 0. 模式选择：参考音频克隆 vs 免参考·角色特征生成 */}
        <div className="game-vocal-mode-tabs">
          <button
            type="button"
            className={`game-vocal-mode-tab ${refMode === "clone" ? "is-active" : ""}`}
            onClick={() => patchData({ vocalRefMode: "clone" })}
          >
            <Mic2 size={13} />
            <span>🎙️ 参考音频克隆</span>
          </button>
          <button
            type="button"
            className={`game-vocal-mode-tab ${refMode === "design" ? "is-active" : ""}`}
            onClick={() => patchData({ vocalRefMode: "design" })}
          >
            <Sparkles size={13} />
            <span>✨ 角色特征生成 (免参考)</span>
          </button>
        </div>

        {/* 1. 根据模式呈现：参考音频卡片 VS 角色形容词特征选择面板 */}
        {refMode === "clone" ? (
          resolvedAudioInfo.audio ? (
            <div className="game-vocal-ref-card">
              <Mic2 size={16} style={{ color: "#a78bfa", flexShrink: 0 }} />
              <div className="game-vocal-ref-info">
                <span className="game-vocal-ref-title">
                  {resolvedAudioInfo.sourceTitle ? `已连入【${resolvedAudioInfo.sourceTitle}】` : "已连接参考音频"}
                </span>
                <span className="game-vocal-ref-meta">
                  {resolvedAudioInfo.audio.fileName} · {formatBytes(resolvedAudioInfo.audio.size)}
                </span>
                <span className="game-vocal-ref-tip">
                  💡 建议使用 3~5 秒干声（无混响/无BGM），拟声短促精准度最高
                </span>
              </div>
              <StudioAudioPlayer src={resolvedAudioInfo.audio.dataUrl} />
            </div>
          ) : (
            <div className="game-vocal-ref-card is-empty">
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>尚未连入参考音频。支持从左侧接入【参考音频】、【音频整合】或【产物卡片】；若无需参考请切换为【免参考模式】。</span>
            </div>
          )
        ) : (
          <div className="game-vocal-design-panel">
            {/* 角色大类切换 Tabs */}
            <div className="game-vocal-char-type-tabs">
              {GAME_CHARACTER_TYPES.map((charType) => (
                <button
                  key={charType.id}
                  type="button"
                  className={`game-vocal-char-type-btn ${activeCharType === charType.id ? "is-active" : ""}`}
                  onClick={() => handleSelectCharType(charType.id)}
                >
                  <span>{charType.emoji}</span>
                  <span>{charType.nameZh}</span>
                </button>
              ))}
            </div>

            {/* 标签分组与形容词 Chips */}
            <div className="game-vocal-tag-groups">
              {currentCharCategory.groups.map((grp) => (
                <div key={grp.id} className="game-vocal-tag-group-row">
                  <span className="game-vocal-tag-group-label">{grp.nameZh}:</span>
                  <div className="game-vocal-tag-group-chips">
                    {grp.tags.map((tag) => {
                      const checked = selectedCharTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`game-vocal-tag-chip ${checked ? "is-active" : ""}`}
                          onClick={() => toggleCharTag(tag)}
                        >
                          {checked ? <Check size={11} strokeWidth={2.5} /> : null}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 快捷随机/清空与自定义角色特征文本框 */}
            <div className="game-vocal-design-summary-box">
              <div className="game-vocal-design-summary-header">
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={12} style={{ color: "#a78bfa" }} />
                  <span className="game-vocal-design-summary-title">已组合角色特征（无需参考音频）</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="game-vocal-quick-btn"
                    onClick={handleRandomCharacterTags}
                    title="随机摇出一套好玩的特色角色人设标签"
                  >
                    🎲 随机人设
                  </button>
                  <button
                    type="button"
                    className="game-vocal-quick-btn"
                    onClick={handleResetCharacterTags}
                    title="恢复当前类别的推荐预设特征"
                  >
                    ↺ 默认预设
                  </button>
                  {selectedCharTags.length > 0 ? (
                    <button
                      type="button"
                      className="game-vocal-quick-btn game-vocal-clear-btn"
                      onClick={handleClearCharacterTags}
                      title="清空已选特征"
                    >
                      <Trash2 size={11} /> 清空
                    </button>
                  ) : null}
                </div>
              </div>
              <textarea
                className="nodrag nopan nowheel game-vocal-design-textarea"
                value={data.vocalVoiceDescription !== undefined ? data.vocalVoiceDescription : generatedVoiceDesc}
                onChange={(e) => patchData({ vocalVoiceDescription: e.target.value })}
                placeholder="根据上方选中的人设形容词自动组装，亦可在此直接手动补充修改..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* 2. 10 大分类切换 */}
        <div className="game-vocal-category-bar">
          {GAME_VOCAL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`game-vocal-cat-btn ${cat.id === activeCategoryId ? "is-active" : ""}`}
              onClick={() => handleSelectCategory(cat.id)}
              title={cat.description}
            >
              <span>{cat.emoji}</span>
              <span>{cat.nameZh}</span>
            </button>
          ))}
        </div>

        {/* 3. 子类别 Pills 切换 */}
        <div className="game-vocal-sub-bar">
          {activeCategory.subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              className={`game-vocal-sub-btn ${sub.id === activeSubcategoryId ? "is-active" : ""}`}
              onClick={() => handleSelectSubcategory(sub.id)}
            >
              <span>{sub.nameZh}</span>
            </button>
          ))}
        </div>

        {/* 4. 工具栏快捷按钮 */}
        <div className="game-vocal-toolbar">
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <button
              type="button"
              className="game-vocal-quick-btn"
              onClick={handleSelectAllCurrentSub}
              title="全选当前子类别全部 20 个语气词"
            >
              <Zap size={12} style={{ color: "#facc15" }} /> 全选当前 (20)
            </button>
            <button
              type="button"
              className="game-vocal-quick-btn"
              onClick={() => handleRandomPick(3)}
              title="随机抽选 3 条语气词"
            >
              🎲 抽 3 条
            </button>
            <button
              type="button"
              className="game-vocal-quick-btn"
              onClick={() => handleRandomPick(5)}
              title="随机抽选 5 条语气词"
            >
              🎲 抽 5 条
            </button>
            <button
              type="button"
              className="game-vocal-quick-btn"
              onClick={() => handleRandomPick(10)}
              title="随机抽选 10 条语气词"
            >
              🎲 抽 10 条
            </button>
          </div>
          {selectedVocals.length > 0 ? (
            <button
              type="button"
              className="game-vocal-quick-btn game-vocal-clear-btn"
              onClick={handleClearAll}
              title="清空所有已选语气词"
            >
              <Trash2 size={12} /> 清空
            </button>
          ) : null}
        </div>

        {/* 5. 语气词选择池 (4列网格) */}
        <div className="game-vocal-items-grid">
          {activeSubcategory.items.map((item, idx) => {
            const checked = isItemChecked(item);
            return (
              <div
                key={`${activeSubcategory.id}_${idx}_${item}`}
                className={`game-vocal-item-chip ${checked ? "is-selected" : ""}`}
                onClick={() => toggleVocalItem(item)}
              >
                <span>{item}</span>
                {checked ? <Check size={13} style={{ color: "#a78bfa" }} /> : <Plus size={12} style={{ opacity: 0.4 }} />}
              </div>
            );
          })}
        </div>

        {/* 6. 已选语气词清单 */}
        <div className="game-vocal-selected-bar">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="game-vocal-selected-title">
              已选语气词队列 ({selectedVocals.length} 条)
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                className="nodrag game-vocal-custom-input"
                placeholder="自定义语气词..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustom();
                }}
              />
              <button
                type="button"
                className="game-vocal-quick-btn game-vocal-custom-add-btn"
                onClick={handleAddCustom}
                disabled={!customText.trim()}
              >
                + 添加
              </button>
            </div>
          </div>
          {selectedVocals.length > 0 ? (
            <div className="game-vocal-selected-pills">
              {selectedVocals.map((v) => (
                <span key={v.id} className="game-vocal-selected-pill">
                  <span>{v.text}</span>
                  <button
                    type="button"
                    className="game-vocal-pill-remove-btn"
                    onClick={() => handleRemoveItem(v.id)}
                    title="移除此项"
                  >
                    <X size={10} strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="game-vocal-empty-hint">
              点击上方词条或快速抽选按钮添加要生成的语气词。
            </span>
          )}
        </div>

        {/* 7. 发声与情绪风格指导 (Instruction) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="game-vocal-instruction-header">
            <span className="game-vocal-instruction-title">拟声发声指导 (Prompt / Instruction)</span>
            <span className="game-vocal-instruction-sub">切换分类自动推荐发声风格指导，亦可手动微调</span>
          </div>
          <textarea
            className="nodrag nopan nowheel game-vocal-instruction-textarea"
            value={data.instruction ?? ""}
            onChange={(e) => patchData({ instruction: e.target.value })}
            placeholder="例如：短促有力、爆发感强的战斗发力拟声，或机械合成质感、电子频响滤波..."
          />
        </div>

        {/* 8. 拟声防拖音与精准控制面板 */}
        <div className="game-vocal-precision-panel nodrag">
          <div className="game-vocal-precision-header">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Zap size={13} style={{ color: "#a78bfa" }} />
              <span className="game-vocal-precision-title">拟声精准控制 & 极速防拖音</span>
            </div>
            <span className="game-vocal-precision-badge">MiMo 独家瞬态调优</span>
          </div>

          <div className="game-vocal-precision-body">
            <div className="game-vocal-mode-group">
              <span className="game-vocal-control-label">发声时长倾向:</span>
              <div className="game-vocal-duration-pills">
                <button
                  type="button"
                  className={`game-vocal-duration-pill ${(data.vocalDurationMode || "standard") === "ultra_short" ? "is-active" : ""}`}
                  onClick={() => patchData({ vocalDurationMode: "ultra_short" })}
                  title="限制在0.2~0.6s内，超短爆发瞬态，专治轻受击、跳跃、轻打等拖长音"
                >
                  ⚡ 超短瞬态 (0.3~0.6s)
                </button>
                <button
                  type="button"
                  className={`game-vocal-duration-pill ${(data.vocalDurationMode || "standard") === "standard" ? "is-active" : ""}`}
                  onClick={() => patchData({ vocalDurationMode: "standard" })}
                  title="推荐默认：0.6~1.2s，干净利索，单次爆发即止"
                >
                  🎯 标准利落 (0.6~1.2s)
                </button>
                <button
                  type="button"
                  className={`game-vocal-duration-pill ${(data.vocalDurationMode || "standard") === "dramatic" ? "is-active" : ""}`}
                  onClick={() => patchData({ vocalDurationMode: "dramatic" })}
                  title="1.2~2.5s，适用于野兽咆哮、长声叹息、反派长笑等戏剧场景"
                >
                  🎭 戏剧延展 (1.2~2.5s)
                </button>
              </div>
            </div>

            <div className="game-vocal-switches-row">
              <label className="game-vocal-switch-label" title="自动向模型下达声带闭合与严禁拖长音的声学硬约束">
                <input
                  type="checkbox"
                  checked={data.antiDrone !== false}
                  onChange={(e) => patchData({ antiDrone: e.target.checked })}
                />
                <span>⚡ 极速防拖长</span>
              </label>

              <label className="game-vocal-switch-label" title="为英文拟声词自动注入声门/口型发声要领，消除模型生僻读音幻觉">
                <input
                  type="checkbox"
                  checked={data.phoneticAnchor !== false}
                  onChange={(e) => patchData({ phoneticAnchor: e.target.checked })}
                />
                <span>🗣️ 拟声发音强化</span>
              </label>

              <label className="game-vocal-switch-label" title="若模型偶发拖长声，在上限处平滑淡出截断，产物即拿即用">
                <input
                  type="checkbox"
                  checked={data.autoTrimTail !== false}
                  onChange={(e) => patchData({ autoTrimTail: e.target.checked })}
                />
                <span>✂️ 智能尾音截断</span>
              </label>
            </div>
          </div>
        </div>

        {/* 8. 错误提示与运行状态 */}
        {data.error ? <p className="node-error" style={{ margin: 0 }}>{data.error}</p> : null}

        {/* 9. 一键生成按钮 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className={data.isRunning ? "game-vocal-run-btn nodrag is-running is-generating" : "game-vocal-run-btn nodrag"}
            onClick={() => data.onRunGameVocalClone?.(id)}
            disabled={data.isRunning || selectedVocals.length === 0}
          >
            {data.isRunning ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
            <span>
              {data.isRunning
                ? (data.vocalProgressText || `正在生成 (${selectedVocals.length} 条)...`)
                : refMode === "design"
                  ? `🎮 免参考·直接生成语气词 (共 ${selectedVocals.length} 条)`
                  : `🎮 一键生成语气词 (共 ${selectedVocals.length} 条)`}
            </span>
          </button>
          {data.isRunning ? (
            <button
              type="button"
              className="batch-abort-btn nodrag"
              style={{ height: 42, flexShrink: 0, padding: "0 12px" }}
              onClick={() => {
                data.onPatch?.(id, { isRunning: false, error: "用户已手动暂停语气词生成。" });
              }}
              title="暂停生成"
            >
              <Square size={13} /> 暂停
            </button>
          ) : null}
        </div>
      </div>
    </StudioNodeFrame>
  );
});
