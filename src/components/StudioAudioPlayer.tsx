import { memo, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { getAudioDurationFast, getCachedAudioDuration, setCachedAudioDuration, resolveAudioDuration } from "../utils/audioDuration";
import { activateAudio, releaseAudio, formatAudioTime as formatTime } from "../utils/audioPlayback";
import { prepareAudioPlayback } from "../utils/playbackSettings";

function clearNodePlayback(audio: HTMLAudioElement) {
  const node = audio.closest(".studio-node");
  if (node && !Array.from(node.querySelectorAll("audio")).some(other => other !== audio && !other.paused)) {
    node.classList.remove("has-audio-playing");
  }
}

export const StudioAudioPlayer = memo(function StudioAudioPlayer({ src, accentColor }: { src: string; accentColor?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const isDraggingRef = useRef(false);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  // 首屏同步获取时长：优先从全局时长缓存或微秒级 WAV 快速解析中同步取得真实时长，彻底告别 0:00 闪烁
  const [duration, setDuration] = useState<number>(() => {
    if (!src) return 0;
    const cached = getCachedAudioDuration(src);
    if (cached && cached > 0) return cached;
    const fast = getAudioDurationFast(src);
    if (fast && fast > 0) return fast;
    return 0;
  });

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    isDraggingRef.current = false;

    // 优先读取已缓存或快速解析的时长
    const known = getCachedAudioDuration(src) || getAudioDurationFast(src) || 0;
    if (known > 0) {
      setDuration(known);
    } else {
      setDuration(0);
    }

    const audio = audioRef.current;
    if (audio) {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        setCachedAudioDuration(src, audio.duration);
      }
      // 强制启动多媒体管线解析
      audio.load();
    }

    // 若依然未知（如网络音频或非 WAV base64），启动异步探测兜底
    let isCancelled = false;
    if (!known && src) {
      void resolveAudioDuration(src).then((d) => {
        if (!isCancelled && d && d > 0) {
          setDuration(d);
        }
      });
    }

    return () => {
      isCancelled = true;
      if (audio) { audio.pause(); releaseAudio(audio); clearNodePlayback(audio); }
    };
  }, [src]);

  // 高帧率 (60fps) 实时同步播放进度，彻底消除 HTML5 onTimeUpdate 250ms 节流导致的卡顿与跳跃
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastTime = -1;

    const tick = () => {
      const audio = audioRef.current;
      if (audio && !isDraggingRef.current) {
        const ct = audio.currentTime;
        if (Math.abs(ct - lastTime) > 0.005) {
          lastTime = ct;
          setCurrentTime(ct);
        }
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration !== duration) {
          setDuration(audio.duration);
          setCachedAudioDuration(src, audio.duration);
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, duration, src]);

  // 全局 pointerup 监听，防止用户拖动滑块至视口外部释放时卡住拖拽锁
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (audioRef.current) {
          audioRef.current.currentTime = currentTimeRef.current;
        }
      }
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      if (prepareAudioPlayback(audio)) { currentTimeRef.current = 0; setCurrentTime(0); }
      activateAudio(audio);
      audio.playbackRate = playbackRate;
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function cycleSpeed() {
    const rates = [1.0, 1.25, 1.5, 2.0, 0.75];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  }

  function seek(value: string | number, commitToAudio = true) {
    const nextTime = Number(value);
    if (Number.isNaN(nextTime)) {
      return;
    }
    setCurrentTime(nextTime);
    const audio = audioRef.current;
    if (audio && commitToAudio) {
      audio.currentTime = nextTime;
    }
  }

  const handleMetadata = (a: HTMLAudioElement) => {
    if (Number.isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
      setCachedAudioDuration(src, a.duration);
    } else if (a.duration === Infinity) {
      // 触发 Chromium seek 探针规避 data URL Infinity 限制
      try {
        a.currentTime = 1e10;
      } catch {}
    }
  };

  return (
    <div
      className="studio-player nodrag"
      style={accentColor ? ({ "--player-accent": accentColor } as React.CSSProperties) : undefined}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(event) => {
          handleMetadata(event.currentTarget);
          event.currentTarget.playbackRate = playbackRate;
        }}
        onDurationChange={(event) => {
          handleMetadata(event.currentTarget);
        }}
        onCanPlay={(event) => {
          handleMetadata(event.currentTarget);
        }}
        onLoadedData={(event) => {
          handleMetadata(event.currentTarget);
        }}
        onSeeked={(event) => {
          const a = event.currentTarget;
          if (a.currentTime >= 1e9) {
            const resolvedDur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : a.currentTime;
            if (Number.isFinite(resolvedDur) && resolvedDur > 0 && resolvedDur < 1e9) {
              setDuration(resolvedDur);
              setCachedAudioDuration(src, resolvedDur);
            }
            a.currentTime = 0;
          }
        }}
        onTimeUpdate={(event) => {
          const a = event.currentTarget;
          if (a.currentTime >= 1e9) {
            const resolvedDur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : a.currentTime;
            if (Number.isFinite(resolvedDur) && resolvedDur > 0 && resolvedDur < 1e9) {
              setDuration(resolvedDur);
              setCachedAudioDuration(src, resolvedDur);
            }
            a.currentTime = 0;
            return;
          }
          if (!isDraggingRef.current && !isPlaying) {
            setCurrentTime(a.currentTime);
          }
          if (Number.isFinite(a.duration) && a.duration > 0 && a.duration !== duration) {
            setDuration(a.duration);
            setCachedAudioDuration(src, a.duration);
          }
        }}
        onPlay={(event) => {
          activateAudio(event.currentTarget);
          event.currentTarget.closest(".studio-node")?.classList.add("has-audio-playing");
          setIsPlaying(true);
        }}
        onPause={(event) => {
          clearNodePlayback(event.currentTarget);
          setIsPlaying(false);
        }}
        onEnded={(event) => {
          clearNodePlayback(event.currentTarget);
          setIsPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }}
        onError={(event) => { clearNodePlayback(event.currentTarget); setIsPlaying(false); }}
      />
      <button className="player-button" type="button" onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
        {isPlaying ? <Pause size={15} /> : <Play size={15} style={{ margin: 0 }} />}
      </button>
      <span className="player-time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <input
        aria-label="播放进度"
        className="player-range player-progress"
        max={duration > 0 ? duration : 1}
        min={0}
        step="any"
        onPointerDown={() => {
          isDraggingRef.current = true;
        }}
        onPointerUp={(event) => {
          isDraggingRef.current = false;
          seek(event.currentTarget.value, true);
        }}
        onChange={(event) => {
          seek(event.target.value, !isDraggingRef.current);
        }}
        style={{ "--progress": `${progress}%`, "--player-progress-pct": `${progress}%` } as React.CSSProperties}
        type="range"
        value={duration > 0 ? Math.min(currentTime, duration) : 0}
      />
      <button
        className="player-speed-btn"
        type="button"
        onClick={cycleSpeed}
        title="点击切换播放倍速 (1.0x -> 1.25x -> 1.5x -> 2.0x -> 0.75x)"
      >
        {playbackRate === 1 ? "1x" : playbackRate === 2 ? "2x" : playbackRate === 0.75 ? ".75" : playbackRate}
      </button>
    </div>
  );
});
