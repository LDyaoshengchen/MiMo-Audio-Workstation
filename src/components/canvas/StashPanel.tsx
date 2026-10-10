import type { AudioAsset } from "../../types/studioAudio";
import type { StashItem } from "../../types/studio";
import { ChevronDown, Download, Trash2, Pause, Play } from "lucide-react";
import { activateAudio, releaseAudio } from "../../utils/audioPlayback";
import { useState, useRef, useEffect } from "react";

export function StashPanel({
  isOpen,
  items,
  workspaceName,
  onBatchDownload,
  onDelete,
  onToggle,
  onConvertToRefAudio
}: {
  isOpen: boolean;
  items: StashItem[];
  workspaceName?: string;
  onBatchDownload: () => void;
  onDelete: (itemId: string) => void;
  onToggle: () => void;
  onConvertToRefAudio?: (title: string, audioAsset: AudioAsset) => void;
}) {
  return (
    <section className="stash-panel">
      <button className="stash-header" type="button" onClick={onToggle} aria-expanded={isOpen}>
        <span>
          <ChevronDown className={isOpen ? "stash-chevron open" : "stash-chevron"} size={14} />
          暂存 {items.length}
        </span>
      </button>
      {isOpen ? (
        <div
          className="stash-body nodrag nopan nowheel"
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="stash-toolbar">
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-color, #0a84ff)" }}>共暂存 {items.length} 个音效产物</span>
            <button className="stash-download-all" type="button" onClick={onBatchDownload} title="打包下载全部 ZIP">
              <Download size={13} />
              ZIP 打包
            </button>
          </div>
          {items.map((item) => (
            <StashItemCard key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function StashItemCard({
  item,
  onDelete
}: {
  item: StashItem;
  onDelete: (itemId: string) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <article
      className={`stash-item ${isPlaying ? "is-playing" : ""}`}
      style={{
        background: isPlaying
          ? `linear-gradient(90deg, rgba(197, 164, 93, 0.35) 0%, rgba(197, 164, 93, 0.35) ${progress.toFixed(1)}%, rgba(24, 23, 19, 0.92) ${progress.toFixed(1)}%, rgba(24, 23, 19, 0.92) 100%)`
          : undefined
      }}
    >
      <div className="stash-item-info">
        <strong title={item.sourceNodeName || item.fileName}>{item.sourceNodeName || item.fileName}</strong>
      </div>
      <div className="stash-item-actions">
        <StashMiniPlayer
          src={item.audioDataUrl}
          onProgressChange={(p, playing) => {
            setProgress(p);
            setIsPlaying(playing);
          }}
        />
        <button className="stash-square-btn nodrag" type="button" onClick={() => onDelete(item.id)} title="删除暂存">
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

export function StashMiniPlayer({
  src,
  onProgressChange
}: {
  src: string;
  onProgressChange?: (progressPercent: number, isPlaying: boolean) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    const tick = () => {
      const audio = audioRef.current;
      if (audio && audio.duration > 0) {
        const p = (audio.currentTime / audio.duration) * 100;
        onProgressChange?.(p, true);
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, onProgressChange]);

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLAudioElement>) {
    if (isPlaying) return;
    const audio = event.currentTarget;
    if (audio.duration > 0) {
      const p = (audio.currentTime / audio.duration) * 100;
      onProgressChange?.(p, isPlaying);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      activateAudio(audio);
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    audio?.load();
    return () => { if (audio) { audio.pause(); releaseAudio(audio); } };
  }, [src]);

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => {
          setIsPlaying(true);
          onProgressChange?.(0, true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onProgressChange?.(0, false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          onProgressChange?.(0, false);
        }}
      />
      <button className="stash-square-btn nodrag" type="button" onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </button>
    </>
  );
}
