import type { AudioAsset } from "../../types/studioAudio";
import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { FileAudio, Trash2, Mic2, Square } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { RoleVoiceLibrary } from "../studio/RoleVoiceLibrary";
import { readRoleAudioDrag, ROLE_AUDIO_DROPPED_EVENT } from "../../utils/roleAudioDrag";
import { allowedAudioTypes, maxAudioBytes } from "../../studio/config";
import { fileToAudioAsset, getSupportedRecordingMimeType, convertRecordedBlobToWav, blobToDataUrl } from "../../studio/audio";
import { formatBytes, formatDateForFile, formatTime } from "../../studio/format";
import { memo, useState, useRef, useEffect, ChangeEvent } from "react";

export const ReferenceAudioNode = memo(function ReferenceAudioNode({ id, data }: NodeProps<StudioNode>) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      stopRecordingStream();
    };
  }, []);

  function processAudioFiles(files: File[]) {
    if (files.length === 0) return;
    const validFiles = files.filter(
      (file) =>
        allowedAudioTypes.has(file.type) ||
        /\.(mp3|m4a|mp4|wav|aac|ogg|flac)$/i.test(file.name)
    );
    const oversized = validFiles.find((file) => file.size > maxAudioBytes);
    if (oversized) {
      data.onPatch?.(id, { error: `${oversized.name} 超过 ${formatBytes(maxAudioBytes)}，未添加。` });
      return;
    }
    if (validFiles.length === 0) {
      data.onPatch?.(id, { error: "仅支持 mp3、m4a/mp4 或 wav 参考音频文件。" });
      return;
    }
    void Promise.all(validFiles.map(fileToAudioAsset)).then((assets) => {
      const audioAssets = [...(data.audioAssets ?? (data.audio ? [data.audio] : [])), ...assets];
      data.onPatch?.(id, {
        audio: audioAssets[0],
        audioAssets,
        error: validFiles.length === files.length ? undefined : "部分不支持的文件未添加。"
      });
    });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    processAudioFiles(files);
  }

  function removeAudio(index: number) {
    const audioAssets = (data.audioAssets ?? (data.audio ? [data.audio] : [])).filter((_, itemIndex) => itemIndex !== index);
    data.onPatch?.(id, { audio: audioAssets[0], audioAssets, error: undefined });
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      data.onPatch?.(id, { error: "当前浏览器不支持录音，请改用上传音频文件。" });
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
      data.onPatch?.(id, { error: undefined });

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
    } catch (error) {
      stopRecordingStream();
      setIsRecording(false);
      data.onPatch?.(id, { error: error instanceof Error ? error.message : "录音启动失败。" });
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
      data.onPatch?.(id, { error: "没有录到有效音频。" });
      return;
    }

    try {
      const recordedBlob = new Blob(chunks, { type: mimeType });
      const wavBlob = await convertRecordedBlobToWav(recordedBlob);

      if (wavBlob.size > maxAudioBytes) {
        data.onPatch?.(id, { error: `录音文件不能超过 ${formatBytes(maxAudioBytes)}。请缩短录制时长。` });
        return;
      }

      const fileName = `recorded-reference-${formatDateForFile(new Date())}.wav`;
      const dataUrl = await blobToDataUrl(wavBlob);
      const asset: AudioAsset = {
        fileName,
        mimeType: "audio/wav",
        size: wavBlob.size,
        dataUrl
      };
      const audioAssets = [...(data.audioAssets ?? (data.audio ? [data.audio] : [])), asset];
      data.onPatch?.(id, {
        audio: audioAssets[0],
        audioAssets,
        error: undefined
      });
    } catch (error) {
      data.onPatch?.(id, { error: error instanceof Error ? error.message : "录音处理失败。" });
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

  return (
    <StudioNodeFrame id={id} data={data} icon={<FileAudio size={17} />} tone="audio">
      <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} />
      <div className="reference-tools-row nodrag"><RoleVoiceLibrary nodeId={id} data={data} /></div>
      <label
        className={`file-picker nodrag ${isDraggingOver ? "dragging-over" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current += 1;
          setIsDraggingOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          if (!isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
          if (dragCounterRef.current === 0) {
            setIsDraggingOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current = 0;
          setIsDraggingOver(false);
          const roleAudio = readRoleAudioDrag(e.dataTransfer);
          if (roleAudio) {
            const audioAssets = [...(data.audioAssets ?? (data.audio ? [data.audio] : [])), roleAudio];
            data.onPatch?.(id, { audio: audioAssets[0], audioAssets, error: undefined });
            window.dispatchEvent(new Event(ROLE_AUDIO_DROPPED_EVENT));
            return;
          }
          const files = Array.from(e.dataTransfer.files ?? []);
          processAudioFiles(files);
        }}
      >
        <input accept="audio/*,video/mp4,.mp3,.m4a,.mp4,.wav,.flac,.aac,.ogg" type="file" multiple onChange={onFileChange} />
        <span>{data.audioAssets?.length ? `已添加 ${data.audioAssets.length} 段参考音频` : "上传 / 拖入参考音频"}</span>
        <small>{data.audioAssets?.length ? "可继续拖入添加，连接至整合节点后按顺序输出" : "可直接拖入或选择多个 MP3、M4A、MP4 或 WAV"}</small>
      </label>
      {(data.audioAssets ?? (data.audio ? [data.audio] : [])).map((audio, index) => (
        <div className="reference-audio-card nodrag" key={`${audio.fileName}-${index}`}>
          <div className="reference-audio-card-header">
            <span title={audio.fileName}>{index + 1}. {audio.fileName}</span>
            <button className="icon-button" type="button" onClick={() => removeAudio(index)} title="移除此参考音频">
              <Trash2 size={13} />
            </button>
          </div>
          <StudioAudioPlayer src={audio.dataUrl} />
        </div>
      ))}
      <div className="recording-panel nodrag">
        <button className={isRecording ? "record-button recording" : "record-button"} type="button" onClick={() => void startRecording()} disabled={isRecording}>
          <Mic2 size={15} />
          录制
        </button>
        <button className="record-stop-button" type="button" onClick={stopRecording} disabled={!isRecording}>
          <Square size={13} />
          停止
        </button>
        <span>{isRecording ? `录制中 ${formatTime(recordingSeconds)}` : "当场录制参考音频"}</span>
      </div>
      {data.error ? <p className="node-error">{data.error}</p> : null}
    </StudioNodeFrame>
  );
});
