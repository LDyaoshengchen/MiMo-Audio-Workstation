import type { TemplateSummary } from "../../types/studio";
import { PanelTop, LayoutTemplate, Sparkles, BookOpen, FileJson, Loader2, Plus, Trash2, Mic2, Square } from "lucide-react";
import { ProviderWorkflowNotice } from "../ProviderWorkflowNotice";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { allowedAudioTypes, maxAudioBytes } from "../../studio/config";
import { blobToDataUrl, getSupportedRecordingMimeType, convertRecordedBlobToWav } from "../../studio/audio";
import { formatBytes, formatDateForFile, splitScriptInput, formatTime } from "../../studio/format";
import { showAppleConfirm } from "../../studio/confirmation";
import { useState, useRef, useEffect, ChangeEvent } from "react";

export function BoardCreateDialog({
  mimoWorkflowSupported,
  mode,
  onClose,
  onCreateBlank,
  onCreateSmart,
  onCreateAudiobook,
  onImportFile,
  onUseTemplate,
  onSwitchMode
}: {
  mimoWorkflowSupported: boolean;
  mode: "choice" | "templates" | "smart" | "audiobook";
  onClose: () => void;
  onCreateBlank: () => void;
  onCreateSmart: (formData: FormData) => Promise<void>;
  onCreateAudiobook: (data: { novelText: string; characterHints: string }) => Promise<void>;
  onImportFile: (file: File) => void;
  onUseTemplate: (templateId: string) => Promise<void>;
  onSwitchMode: (mode: "choice" | "templates" | "smart" | "audiobook") => void;
}) {
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [sceneDescription, setSceneDescription] = useState("");
  const [script, setScript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [isCreatingAudiobook, setIsCreatingAudiobook] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  // 有声书表单状态
  const [novelText, setNovelText] = useState("");
  const [characterHints, setCharacterHints] = useState("");
  // 模板管理状态
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode === "templates") {
      setLoadingTemplates(true);
      void fetch("/api/templates")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setTemplates(data);
        })
        .finally(() => setLoadingTemplates(false));
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      stopRecordingStream();
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  const progressStages = [
    { percent: 15, text: "正在读取..." },
    { percent: 35, text: "正在分析情感..." },
    { percent: 55, text: "正在规划画板..." },
    { percent: 75, text: "画板创建中..." },
    { percent: 90, text: "正在收尾..." },
    { percent: 95, text: "马上就好了..." }
  ];

  const audiobookProgressStages = [
    { percent: 12, text: "正在连接文段切分模型..." },
    { percent: 28, text: "正在阅读小说原文..." },
    { percent: 45, text: "正在识别旁白和角色对话..." },
    { percent: 62, text: "正在拆分单一说话人片段..." },
    { percent: 82, text: "正在整理有声书结构..." },
    { percent: 95, text: "即将创建画板..." }
  ];

  function startProgressSimulation(stages = progressStages, initialText = "正在连接 AI 服务...") {
    setProgress(0);
    setProgressText(initialText);
    let stageIndex = 0;

    function advance() {
      if (stageIndex < stages.length) {
        const stage = stages[stageIndex];
        setProgress(stage.percent);
        setProgressText(stage.text);
        stageIndex++;
        const delay = 3000 + Math.random() * 2000;
        progressTimerRef.current = window.setTimeout(advance, delay);
      }
    }

    progressTimerRef.current = window.setTimeout(advance, 500);
  }

  function stopProgressSimulation(finalProgress: number) {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(finalProgress);
  }

  async function setSmartVoiceFile(file: File) {
    if (!allowedAudioTypes.has(file.type) && !/\.(mp3|m4a|mp4|wav)$/i.test(file.name)) {
      setError("仅支持 mp3、m4a/mp4 或 wav 参考音频。");
      return;
    }

    if (file.size > maxAudioBytes) {
      setError(`参考音频不能超过 ${formatBytes(maxAudioBytes)}。`);
      return;
    }

    setVoiceFile(file);
    setVoicePreviewUrl(await blobToDataUrl(file));
    setError(null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void setSmartVoiceFile(file);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持录音，请改用上传音频文件。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsRecording(true);
      setError(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        void commitRecording(recorder.mimeType || mimeType || "audio/webm");
      };
      recorder.start();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);
    } catch (recordingError) {
      stopRecordingStream();
      setIsRecording(false);
      setError(recordingError instanceof Error ? recordingError.message : "录音启动失败。");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
    stopRecordingTimer();
  }

  async function commitRecording(mimeType: string) {
    const chunks = recordingChunksRef.current;
    recordingChunksRef.current = [];
    stopRecordingStream();

    if (chunks.length === 0) {
      setError("没有录到有效音频。");
      return;
    }

    try {
      const recordedBlob = new Blob(chunks, { type: mimeType });
      const wavBlob = await convertRecordedBlobToWav(recordedBlob);
      const fileName = `smart-reference-${formatDateForFile(new Date())}.wav`;
      const file = new File([wavBlob], fileName, { type: "audio/wav" });
      await setSmartVoiceFile(file);
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : "录音处理失败。");
    }
  }

  function stopRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  }

  async function submitSmartWorkspace() {
    const paragraphs = splitScriptInput(script);
    if (!sceneDescription.trim()) {
      setError("请填写场景描述。");
      return;
    }
    if (paragraphs.length === 0) {
      setError("请填写台词文稿，并使用 ---- 分隔独立段落。");
      return;
    }

    setIsGenerating(true);
    setError(null);
    startProgressSimulation();
    try {
      const formData = new FormData();
      if (voiceFile) {
        formData.append("voice", voiceFile);
      }
      formData.append("sceneDescription", sceneDescription.trim());
      formData.append("script", script.trim());
      await onCreateSmart(formData);
      stopProgressSimulation(100);
      setProgressText("我正在全速处理");
      await new Promise((resolve) => setTimeout(resolve, 500));
      onClose();
    } catch (submitError) {
      stopProgressSimulation(0);
      setError(submitError instanceof Error ? submitError.message : "智能画板生成失败。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitAudiobookWorkspace() {
    if (!novelText.trim()) {
      setError("请输入小说原文。");
      return;
    }

    setIsCreatingAudiobook(true);
    setError(null);
    startProgressSimulation(audiobookProgressStages, "正在连接文段切分模型...");
    try {
      await onCreateAudiobook({ novelText: novelText.trim(), characterHints: characterHints.trim() });
      stopProgressSimulation(100);
      setProgressText("有声书创建完成");
      await new Promise((resolve) => setTimeout(resolve, 500));
      onClose();
    } catch (submitError) {
      stopProgressSimulation(0);
      setError(submitError instanceof Error ? submitError.message : "创建有声书失败。");
    } finally {
      setIsCreatingAudiobook(false);
    }
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          if (!isGenerating && !isCreatingAudiobook) onClose();
        }
      }}
    >
      <section className="board-modal" onClick={(event) => event.stopPropagation()}>
        {(mode === "smart" || mode === "audiobook") && <ProviderWorkflowNotice supported={mimoWorkflowSupported} />}
        <header className="modal-header">
          <div>
            <strong>{mode === "choice" ? "新建画板" : mode === "templates" ? "模板库建板" : mode === "smart" ? "智能画板" : "智能有声书"}</strong>
            <span>{mode === "choice" ? "选择创建方式或导入文件" : mode === "templates" ? "从预置模板或自定义模板直接快速创建工作流" : mode === "smart" ? "根据场景、文稿和可选参考音频生成工作流" : "输入小说原文和人物信息，AI自动创建角色音色并生成有声书"}</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭" disabled={isGenerating || isCreatingAudiobook}>
            ×
          </button>
        </header>

        {mode === "choice" ? (
          <div className="create-choice-grid">
            <button type="button" onClick={onCreateBlank}>
              <PanelTop size={18} />
              <span>空白画板</span>
              <small>创建一个全新的空白画板</small>
            </button>
            <button type="button" onClick={() => onSwitchMode("templates")}>
              <LayoutTemplate size={18} />
              <span>从模板新建</span>
              <small>选择广播剧、情绪测试等预置/自定义模板</small>
            </button>
            <button type="button" onClick={() => onSwitchMode("smart")}>
              <Sparkles size={18} />
              <span>智能画板</span>
              <small>有参考音频生成克隆，无参考音频生成设计</small>
            </button>
            <button type="button" onClick={() => onSwitchMode("audiobook")}>
              <BookOpen size={18} />
              <span>智能有声书</span>
              <small>自动分析小说文案角色音色并连贯生成</small>
            </button>
            <label className="create-choice-import-button">
              <input
                type="file"
                accept=".json,.mimotts.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportFile(file);
                }}
              />
              <FileJson size={18} />
              <span>导入画板文件</span>
              <small>从 .mimotts.json 文件导入项目</small>
            </label>
          </div>
        ) : mode === "templates" ? (
          <div className="templates-modal-panel">
            {loadingTemplates ? (
              <p className="node-muted"><Loader2 className="spin" size={16} /> 正在加载模板库...</p>
            ) : templates.length === 0 ? (
              <p className="node-muted">暂无模版</p>
            ) : (
              <div className="template-grid">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="template-card">
                    <div className="template-card-header">
                      <strong>{tpl.name}</strong>
                      <span className="template-badge">{tpl.isBuiltIn ? "内置预设" : "自定义模板"}</span>
                    </div>
                    <p>{tpl.description}</p>
                    <div className="template-card-actions">
                      <button className="run-button" type="button" onClick={() => void onUseTemplate(tpl.id)}>
                        <Plus size={14} />
                        使用此模板
                      </button>
                      {!tpl.isBuiltIn && (
                        <button
                          className="icon-button"
                          type="button"
                          onClick={async () => {
                            const confirmed = await showAppleConfirm({
                              title: "删除模板",
                              message: `确定要删除自定义模板「${tpl.name}」吗？此操作不可逆。`,
                              confirmLabel: "删除",
                              cancelLabel: "取消",
                              isDestructive: true,
                              icon: "trash"
                            });
                            if (confirmed) {
                              void fetch(`/api/templates/${tpl.id}`, { method: "DELETE" }).then(() => {
                                setTemplates((list) => list.filter((t) => t.id !== tpl.id));
                              });
                            }
                          }}
                          title="删除模板"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => onSwitchMode("choice")}>
                返回
              </button>
            </div>
          </div>
        ) : mode === "smart" ? (
          <div className="smart-board-form">
            <label className="file-picker nodrag">
              <input accept="audio/*,video/mp4,.mp3,.m4a,.mp4,.wav" type="file" onChange={onFileChange} />
              <span>{voiceFile ? voiceFile.name : "上传参考音频（可选）"}</span>
              <small>{voiceFile ? `${voiceFile.type || "audio"} · ${formatBytes(voiceFile.size)}` : "不上传时，将使用音色创造节点生成每段音频"}</small>
            </label>
            <div className="recording-panel nodrag">
              <button className={isRecording ? "record-button recording" : "record-button"} type="button" onClick={() => void startRecording()} disabled={isRecording || isGenerating}>
                <Mic2 size={15} />
                开始录制
              </button>
              <button className="record-stop-button" type="button" onClick={stopRecording} disabled={!isRecording || isGenerating}>
                <Square size={13} />
                停止
              </button>
              <span>{isRecording ? `录制中 ${formatTime(recordingSeconds)}` : "当场录制参考音频"}</span>
            </div>
            {voicePreviewUrl ? <StudioAudioPlayer src={voicePreviewUrl} /> : null}
            <label className="node-field">
              <span>场景描述</span>
              <textarea value={sceneDescription} onChange={(event) => setSceneDescription(event.target.value)} rows={4} placeholder="用简单的关键词去描述这段文本的语境语气并补充必要的信息，帮助模型理解需求" />
            </label>
            <label className="node-field">
              <span>完整台词文稿</span>
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                rows={8}
                placeholder="这里输入需要模型朗读的内容，段落使用 ---- 分割，每段建议小于100字"
              />
            </label>
            {error ? <p className="node-error">{error}</p> : null}
            {isGenerating && (
              <div className="smart-progress">
                <div className="smart-progress-bar">
                  <div className="smart-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="smart-progress-text">{progressText}</p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => onSwitchMode("choice")} disabled={isGenerating}>
                返回
              </button>
              <button className="run-button" type="button" onClick={() => void submitSmartWorkspace()} disabled={isGenerating || isRecording || !mimoWorkflowSupported}>
                {isGenerating ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                {isGenerating ? "生成中" : "生成智能画板"}
              </button>
            </div>
          </div>
        ) : (
          <div className="smart-board-form">
            <label className="node-field">
              <span>小说原文</span>
              <textarea
                value={novelText}
                onChange={(event) => setNovelText(event.target.value)}
                rows={10}
                placeholder="粘贴小说原文，AI 会按旁白和角色对话切分片段"
                disabled={isCreatingAudiobook}
              />
            </label>
            <label className="node-field">
              <span>关键人物背景信息</span>
              <textarea
                value={characterHints}
                onChange={(event) => setCharacterHints(event.target.value)}
                rows={4}
                placeholder={"每行一个角色，格式：角色名，性别，年龄，声音特点\n例如：林黛玉，女，16岁，声音清脆柔弱，略带哀愁"}
                disabled={isCreatingAudiobook}
              />
            </label>
            {error ? <p className="node-error">{error}</p> : null}
            {isCreatingAudiobook && (
              <div className="smart-progress">
                <div className="smart-progress-bar">
                  <div className="smart-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="smart-progress-text">{progressText}</p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => onSwitchMode("choice")} disabled={isCreatingAudiobook}>
                返回
              </button>
              <button
                className="run-button"
                type="button"
                onClick={() => void submitAudiobookWorkspace()}
                disabled={isCreatingAudiobook || !mimoWorkflowSupported}
              >
                {isCreatingAudiobook ? <Loader2 className="spin" size={16} /> : <BookOpen size={16} />}
                {isCreatingAudiobook ? "切分中..." : "创建有声书"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
