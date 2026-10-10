import type { AudiobookWorkspacePayload, AudiobookCharacter } from "../../types/studio";
import { BookOpen, Loader2, BookPlus, FileAudio, Plus, Wand2, Trash2, AudioLines, Sparkles, Download, Play, RefreshCw } from "lucide-react";
import { ProviderWorkflowNotice } from "../ProviderWorkflowNotice";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { createZipInstance, getUniqueFileName } from "../../utils/zipUtils";
import { fetchAudioUint8Array } from "../../studio/audio";
import { formatDateForFile } from "../../studio/format";
import { sanitizeFileName, getArtifactDownloadFileName, getAudioFileExtension } from "../../utils/audioNaming";
import { useState, useRef, useEffect } from "react";

// ====== 有声书控制台组件 ======
export function AudiobookConsole({
  mimoWorkflowSupported,
  workspace,
  apiKey,
  apiEndpoint,
  onPatch,
  onAddChapter,
  onActivateChapter,
  onCreateCharacter,
  onAnalyze,
  onGenerateVoice,
  onDeleteVoice,
  onAutoAnnotate,
  onUpdateSegment,
  onSaveWorkspace,
  onGenerate,
  onRetryProduct
}: {
  mimoWorkflowSupported: boolean;
  workspace: AudiobookWorkspacePayload;
  apiKey: string;
  apiEndpoint: string;
  onPatch: (patch: Partial<AudiobookWorkspacePayload>) => void;
  onAddChapter: (data: { title: string; novelText: string; characterHints: string }) => Promise<void>;
  onActivateChapter: (chapterId: string) => void;
  onCreateCharacter: (formData: FormData) => Promise<void>;
  onAnalyze: () => Promise<void>;
  onGenerateVoice: (charId: string) => void;
  onDeleteVoice: (charId: string) => void;
  onAutoAnnotate: () => Promise<void>;
  onUpdateSegment: (segId: string, patch: { characterId: string | null; characterName: string; emotion: string }) => void;
  onSaveWorkspace: () => Promise<void>;
  onGenerate: () => Promise<void>;
  onRetryProduct: (productId: string) => Promise<void>;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeText, setAnalyzeText] = useState("");
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editCharId, setEditCharId] = useState<string>("");
  const [editEmotion, setEditEmotion] = useState("");
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotateProgress, setAnnotateProgress] = useState(0);
  const [annotateText, setAnnotateText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterText, setChapterText] = useState("");
  const [chapterHints, setChapterHints] = useState("");
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [characterRoleType, setCharacterRoleType] = useState<AudiobookCharacter["roleType"]>("supporting");
  const [characterVoiceMode, setCharacterVoiceMode] = useState<AudiobookCharacter["voiceMode"]>("designed");
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterTraits, setCharacterTraits] = useState("");
  const [characterAliases, setCharacterAliases] = useState("");
  const [characterVoiceFile, setCharacterVoiceFile] = useState<File | null>(null);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const productSectionRef = useRef<HTMLDivElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const runningActionRef = useRef<"analyze" | "annotate" | "generate" | null>(null);

  const allVoicesReady = workspace.characters.length > 0 && workspace.characters.every((c) => c.voiceStatus === "ready");
  const hasAnnotations = workspace.segments.some((s) => s.characterId || s.characterName);
  const hasUsedAutoAnnotation = workspace.segments.some((s) => s.isAutoAnnotated);
  const showProductSection = isGenerating || workspace.phase === "generation" || workspace.products.length > 0;
  const allProductsReady = workspace.products.length > 0 && workspace.products.every((product) => product.status === "ready" && product.audioDataUrl);
  const activeChapter = workspace.chapters.find((chapter) => chapter.id === workspace.activeChapterId) ?? workspace.chapters[0];
  const narrator = workspace.characters.find((character) => character.roleType === "narrator");

  useEffect(() => {
    if (!isGenerating) {
      return;
    }
    window.requestAnimationFrame(() => {
      productSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isGenerating]);

  function startProgress(
    setProgress: (v: number) => void,
    setText: (v: string) => void,
    stages: { percent: number; text: string }[]
  ) {
    let stageIndex = 0;
    let currentPercent = 5;
    setProgress(5);
    setText(stages[0]?.text || "处理中...");
    function advance() {
      if (stageIndex < stages.length) {
        currentPercent = stages[stageIndex].percent;
        setProgress(currentPercent);
        setText(stages[stageIndex].text);
        stageIndex++;
        progressTimerRef.current = window.setTimeout(advance, 2000 + Math.random() * 2000);
      } else {
        // 模拟阶段结束，继续缓慢脉冲动画直到 stopProgress 被调用
        const base = currentPercent;
        const pulse = Math.min(base + 2 + Math.random() * 3, 95);
        setProgress(pulse);
        progressTimerRef.current = window.setTimeout(() => {
          setProgress(base);
          progressTimerRef.current = window.setTimeout(advance, 3000 + Math.random() * 2000);
        }, 1500);
      }
    }
    progressTimerRef.current = window.setTimeout(advance, 800);
  }

  function stopProgress(finalProgress: number, setProgress: (v: number) => void) {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(finalProgress);
  }

  async function handleAnalyze() {
    if (runningActionRef.current) {
      return;
    }
    runningActionRef.current = "analyze";
    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    startProgress(setAnalyzeProgress, setAnalyzeText, [
      { percent: 15, text: "正在连接 AI 服务..." },
      { percent: 35, text: "正在阅读小说原文..." },
      { percent: 55, text: "识别出场人物..." },
      { percent: 75, text: "生成角色描述..." },
      { percent: 90, text: "生成音色描述..." },
      { percent: 95, text: "即将完成..." }
    ]);
    try {
      await onAnalyze();
      stopProgress(100, setAnalyzeProgress);
      setAnalyzeText("分析完成！");
    } catch {
      stopProgress(0, setAnalyzeProgress);
      setAnalyzeText("分析失败，请重试");
    } finally {
      setTimeout(() => {
        runningActionRef.current = null;
        setIsAnalyzing(false);
      }, 500);
    }
  }

  async function handleAutoAnnotate() {
    if (runningActionRef.current || hasUsedAutoAnnotation) {
      return;
    }
    runningActionRef.current = "annotate";
    setIsAnnotating(true);
    setAnnotateProgress(0);
    startProgress(setAnnotateProgress, setAnnotateText, [
      { percent: 15, text: "正在连接 AI 服务..." },
      { percent: 35, text: "分析段落内容..." },
      { percent: 55, text: "识别对话角色..." },
      { percent: 75, text: "生成朗读情绪..." },
      { percent: 90, text: "整理标注结果..." },
      { percent: 95, text: "即将完成..." }
    ]);
    try {
      await onAutoAnnotate();
      stopProgress(100, setAnnotateProgress);
      setAnnotateText("标注完成！");
    } catch {
      stopProgress(0, setAnnotateProgress);
      setAnnotateText("标注失败，请重试");
    } finally {
      setTimeout(() => {
        runningActionRef.current = null;
        setIsAnnotating(false);
      }, 500);
    }
  }

  async function handleGenerate() {
    if (runningActionRef.current) {
      return;
    }
    runningActionRef.current = "generate";
    setIsGenerating(true);
    try {
      await onSaveWorkspace();
      await onGenerate();
    } catch (error) {
      console.error("[audiobook:generate] failed", error);
    } finally {
      setTimeout(() => {
        runningActionRef.current = null;
        setIsGenerating(false);
      }, 500);
    }
  }

  async function handleRetryProduct(productId: string) {
    await onRetryProduct(productId);
  }

  async function handleAddChapter() {
    if (!chapterText.trim() || isAddingChapter) {
      return;
    }
    setIsAddingChapter(true);
    try {
      await onAddChapter({
        title: chapterTitle.trim() || `章节 ${workspace.chapters.length + 1}`,
        novelText: chapterText,
        characterHints: chapterHints
      });
      setChapterTitle("");
      setChapterText("");
      setChapterHints("");
    } finally {
      setIsAddingChapter(false);
    }
  }

  async function handleCreateCharacter() {
    if (!characterName.trim() || isCreatingCharacter) {
      return;
    }
    setIsCreatingCharacter(true);
    try {
      const formData = new FormData();
      formData.append("name", characterName.trim());
      formData.append("roleType", characterRoleType);
      formData.append("aliases", characterAliases);
      formData.append("voiceTraits", characterTraits);
      formData.append("voiceDescription", characterDescription);
      formData.append("personality", characterTraits || characterDescription);
      if (characterVoiceMode === "cloned" && characterVoiceFile) {
        formData.append("voice", characterVoiceFile);
      }
      await onCreateCharacter(formData);
      setCharacterName("");
      setCharacterRoleType("supporting");
      setCharacterVoiceMode("designed");
      setCharacterDescription("");
      setCharacterTraits("");
      setCharacterAliases("");
      setCharacterVoiceFile(null);
    } finally {
      setIsCreatingCharacter(false);
    }
  }

  async function downloadAudiobookProductsZip() {
    if (!allProductsReady) {
      return;
    }

    const zip = await createZipInstance();
    const usedNames = new Map<string, number>();
    for (let index = 0; index < workspace.products.length; index++) {
      const product = workspace.products[index];
      if (!product.audioDataUrl) {
        continue;
      }
      const indexLabel = String(index + 1).padStart(2, "0");
      const characterName = sanitizeFileName(product.characterName || "旁白").replace(/\.[a-z0-9]{1,8}$/i, "");
      const fileName = getUniqueFileName(getArtifactDownloadFileName(`segment-${indexLabel}-${characterName}`, `output${getAudioFileExtension(product.audioDataUrl)}`, workspace.name), usedNames);
      const audioBytes = await fetchAudioUint8Array(product.audioDataUrl);
      zip.file(fileName, audioBytes);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(workspace.name)}-${formatDateForFile(new Date())}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function startEditSegment(segId: string) {
    const seg = workspace.segments.find((s) => s.id === segId);
    if (seg) {
      setEditingSegId(segId);
      setEditCharId(seg.characterId || narrator?.id || "");
      setEditEmotion(seg.emotion);
    }
  }

  function saveEditSegment() {
    if (!editingSegId) return;
    const char = workspace.characters.find((c) => c.id === editCharId);
    onUpdateSegment(editingSegId, {
      characterId: editCharId || narrator?.id || null,
      characterName: char?.name || "旁白",
      emotion: editEmotion
    });
    setEditingSegId(null);
  }

  return (
    <section className="audiobook-panel">
      <div className="audiobook-titlebar">
        <BookOpen size={16} />
        <input
          value={workspace.name}
          onChange={(event) => onPatch({ name: event.target.value })}
          placeholder="未命名有声书"
        />
        <span className="audiobook-phase-badge">
          {workspace.phase === "character-creation" ? "角色创建" : workspace.phase === "annotation" ? "文本标注" : "语音生成"}
        </span>
      </div>

      <div className="audiobook-body">
        <div className="audiobook-section">
          <div className="section-header">
            <h3>章节项目</h3>
            <span className="section-hint inline">当前：{activeChapter?.title || "未命名章节"}</span>
          </div>
          <div className="chapter-tabs">
            {workspace.chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                type="button"
                className={chapter.id === workspace.activeChapterId ? "chapter-tab active" : "chapter-tab"}
                onClick={() => onActivateChapter(chapter.id)}
              >
                <BookOpen size={13} />
                {chapter.title || `章节 ${index + 1}`}
              </button>
            ))}
          </div>
          <div className="chapter-create-panel">
            <input
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              placeholder={`章节 ${workspace.chapters.length + 1}`}
            />
            <textarea
              value={chapterText}
              onChange={(event) => setChapterText(event.target.value)}
              placeholder="粘贴下一章或新的小说片段，系统会加入当前书籍项目并复用音色库"
              rows={4}
            />
            <textarea
              value={chapterHints}
              onChange={(event) => setChapterHints(event.target.value)}
              placeholder="可选：本章新增人物说明，每行一个角色"
              rows={2}
            />
            <button className="run-button" type="button" onClick={() => void handleAddChapter()} disabled={isAddingChapter || !chapterText.trim() || !mimoWorkflowSupported}>
              {isAddingChapter ? <Loader2 className="spin" size={14} /> : <BookPlus size={14} />}
              {isAddingChapter ? "新增中..." : "添加章节"}
            </button>
          </div>
        </div>

        <div className="audiobook-section">
          <div className="section-header">
            <h3>书籍音色库</h3>
            {narrator ? <span className="section-hint inline">旁白：{narrator.voiceStatus === "ready" ? "已准备" : "待生成"}</span> : null}
          </div>
          <div className="manual-character-panel">
            <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} placeholder="音色角色名称，如：主角 / 特邀主播A" />
            <select value={characterRoleType} onChange={(event) => setCharacterRoleType(event.target.value as AudiobookCharacter["roleType"])}>
              <option value="protagonist">主角</option>
              <option value="supporting">配角</option>
              <option value="narrator">旁白</option>
              <option value="custom">自定义</option>
            </select>
            <select value={characterVoiceMode} onChange={(event) => setCharacterVoiceMode(event.target.value as AudiobookCharacter["voiceMode"])}>
              <option value="designed">自然语言音色设计</option>
              <option value="cloned">上传参考音频克隆</option>
            </select>
            <input value={characterAliases} onChange={(event) => setCharacterAliases(event.target.value)} placeholder="别名/称呼，可用逗号分隔" />
            <textarea value={characterTraits} onChange={(event) => setCharacterTraits(event.target.value)} placeholder="性格、身份、声音特点" rows={2} />
            {characterVoiceMode === "designed" ? (
              <textarea value={characterDescription} onChange={(event) => setCharacterDescription(event.target.value)} placeholder="音色描述：男女老少、声音质感、气质等" rows={2} />
            ) : (
              <label className="upload-row">
                <FileAudio size={14} />
                <span>{characterVoiceFile ? characterVoiceFile.name : "上传参考音频"}</span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/wav,audio/wave,video/mp4"
                  onChange={(event) => setCharacterVoiceFile(event.target.files?.[0] ?? null)}
                />
              </label>
            )}
            <button className="run-button" type="button" onClick={() => void handleCreateCharacter()} disabled={isCreatingCharacter || !characterName.trim()}>
              {isCreatingCharacter ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
              {isCreatingCharacter ? "创建中..." : "创建音色角色"}
            </button>
          </div>
        </div>

        {/* 角色创造区域 */}
        <div className="audiobook-section">
          <div className="section-header">
            <h3>角色创造</h3>
            <ProviderWorkflowNotice supported={mimoWorkflowSupported} />
            {workspace.phase === "character-creation" && (
              <button className="run-button" type="button" onClick={() => void handleAnalyze()} disabled={isAnalyzing || !mimoWorkflowSupported}>
                {isAnalyzing ? <Loader2 className="spin" size={14} /> : <Wand2 size={14} />}
                {isAnalyzing ? "分析中..." : "开始分析"}
              </button>
            )}
          </div>

          {isAnalyzing && (
            <div className="smart-progress">
              <div className="smart-progress-bar">
                <div className="smart-progress-fill" style={{ width: `${analyzeProgress}%` }} />
              </div>
              <p className="smart-progress-text">{analyzeText}</p>
            </div>
          )}

          {workspace.characters.length === 0 && !isAnalyzing && (
            <p className="section-hint">点击"开始分析"，AI将从小说原文中识别角色并生成音色描述。</p>
          )}

          <div className="character-grid">
            {workspace.characters.map((char) => (
              <div key={char.id} className="character-card">
                <div className="character-info">
                  <strong>{char.name}</strong>
                  {char.gender && <span className="char-tag">{char.gender}</span>}
                  {char.age && <span className="char-tag">{char.age}</span>}
                  <p className="char-personality">{char.personality}</p>
                  <p className="char-voice-desc">{char.voiceDescription}</p>
                  {char.voiceSampleText && <p className="char-voice-sample">试听：{char.voiceSampleText}</p>}
                </div>
                <div className="character-voice">
                  {char.voiceStatus === "ready" && char.voiceDataUrl ? (
                    <>
                      <StudioAudioPlayer src={char.voiceDataUrl} />
                      <button className="icon-button" type="button" onClick={() => void onDeleteVoice(char.id)} title="重新生成">
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : char.voiceStatus === "generating" ? (
                    <span className="voice-status generating"><Loader2 className="spin" size={14} /> 生成中...</span>
                  ) : char.voiceStatus === "error" ? (
                    <span className="voice-status error">{char.voiceError || "生成失败"}</span>
                  ) : (
                    <button className="run-button" type="button" onClick={() => onGenerateVoice(char.id)} disabled={!mimoWorkflowSupported}>
                      <AudioLines size={14} />
                      生成音色
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {workspace.phase === "character-creation" && allVoicesReady && (
            <button
              className="run-button phase-advance"
              type="button"
              onClick={() => onPatch({ phase: "annotation" })}
            >
              确认并进入标注
            </button>
          )}
        </div>

        {/* 标注区域 */}
        {workspace.phase !== "character-creation" && (
          <div className="audiobook-section">
            <div className="section-header">
              <h3>文本标注</h3>
              <div className="annotation-controls">
                <button
                  className="run-button"
                  type="button"
                  onClick={() => void handleAutoAnnotate()}
                  disabled={isAnnotating || hasUsedAutoAnnotation || !mimoWorkflowSupported}
                  title={hasUsedAutoAnnotation ? "AI auto annotation can only be used once. Please edit manually." : undefined}
                >
                  {isAnnotating ? <Loader2 className="spin" size={14} /> : <Wand2 size={14} />}
                  {isAnnotating ? "标注中..." : "AI 自动标注"}
                </button>
              </div>
            </div>

            {isAnnotating && (
              <div className="smart-progress">
                <div className="smart-progress-bar">
                  <div className="smart-progress-fill" style={{ width: `${annotateProgress}%` }} />
                </div>
                <p className="smart-progress-text">{annotateText}</p>
              </div>
            )}

            <div className="segment-list">
              {workspace.segments.map((seg, index) => (
                <div key={seg.id} className="segment-block" onDoubleClick={() => startEditSegment(seg.id)}>
                  <div className="segment-header">
                    <span className="seg-index">#{index + 1}</span>
                    {seg.characterName && (
                      <span className="annotation-badge">
                        {seg.characterName}
                        {seg.emotion && ` · ${seg.emotion}`}
                      </span>
                    )}
                  </div>
                  <p className="segment-text">{seg.text}</p>
                  {editingSegId === seg.id && (
                    <div className="segment-editor">
                      <select value={editCharId} onChange={(e) => setEditCharId(e.target.value)}>
                        {workspace.characters.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editEmotion}
                        onChange={(e) => setEditEmotion(e.target.value)}
                        placeholder="朗读情绪（如：温柔地、焦急地）"
                      />
                      <button type="button" onClick={saveEditSegment}>确定</button>
                      <button type="button" onClick={() => setEditingSegId(null)}>取消</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {workspace.phase === "annotation" && hasAnnotations && !isGenerating && (
              <>
                <button className="run-button phase-advance" type="button" onClick={() => void handleGenerate()} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                  {isGenerating ? "生成中..." : "一键生成"}
                </button>
              </>
            )}
          </div>
        )}

        {/* 产物列表区域 */}
        {showProductSection && (
          <div className="audiobook-section" ref={productSectionRef}>
            <div className="section-header">
              <h3>产物列表</h3>
              <div className="product-toolbar">
                {allProductsReady && (
                  <button className="run-button" type="button" onClick={() => void downloadAudiobookProductsZip()}>
                    <Download size={14} />
                    批量下载 ZIP
                  </button>
                )}
                <button
                  className="run-button"
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
                  {isGenerating ? "生成中..." : "重新生成"}
                </button>
              </div>
            </div>
            <div className="product-list">
              {workspace.products.map((prod, index) => (
                <div key={prod.id} className="product-item">
                  <div className="product-info">
                    <span className="product-index">#{index + 1}</span>
                    <span className="product-char">{prod.characterName}</span>
                    <span className="product-text">{prod.text.slice(0, 50)}{prod.text.length > 50 ? "..." : ""}</span>
                  </div>
                  {prod.status === "ready" && prod.audioDataUrl ? (
                    <div className="product-actions">
                      <StudioAudioPlayer src={prod.audioDataUrl} />
                      <a
                        className="icon-button product-download-button"
                        href={prod.audioDataUrl}
                        download={getArtifactDownloadFileName(`segment-${index + 1}`, `segment${getAudioFileExtension(prod.audioDataUrl)}`, workspace.name)}
                        title="下载"
                      >
                        <Download size={14} />
                      </a>
                      <button className="icon-button" type="button" onClick={() => void handleRetryProduct(prod.id)} title="重新生成">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  ) : prod.status === "generating" ? (
                    <span className="voice-status generating"><Loader2 className="spin" size={14} /> 合成中...</span>
                  ) : prod.status === "error" ? (
                    <div className="product-actions">
                      <span className="voice-status error">{prod.error || "失败"}</span>
                      <button className="icon-button" type="button" onClick={() => void handleRetryProduct(prod.id)} title="重试生成">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="product-actions">
                      <span className="voice-status">等待中</span>
                      <button className="icon-button" type="button" onClick={() => void handleRetryProduct(prod.id)} title="生成当前片段">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
