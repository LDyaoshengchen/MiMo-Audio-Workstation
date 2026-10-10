import type { AudioAsset } from "../types/studioAudio";
import type { GameVocalDurationMode } from "../utils/gameVocalOptimizer";
import { fetchAudioBytes } from "../utils/audioExport";
import { formatDateForFile } from "./format";
import { smartTrimGameVocalAudioBuffer } from "../utils/gameVocalOptimizer";

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels: Float32Array[] = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);

  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([outBuffer], { type: "audio/wav" });
}

export async function mergeAudioFiles(files: File[]): Promise<{ dataUrl: string; fileName: string }> {
  if (files.length === 1) {
    const dataUrl = await blobToDataUrl(files[0]);
    return { dataUrl, fileName: files[0].name };
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffers: AudioBuffer[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers.push(decoded);
  }

  const numberOfChannels = Math.max(...audioBuffers.map((b) => b.numberOfChannels));
  const sampleRate = audioBuffers[0].sampleRate;
  const totalLength = audioBuffers.reduce((sum, b) => sum + b.length, 0);

  const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;
  for (const b of audioBuffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const outputData = mergedBuffer.getChannelData(channel);
      const inputData = b.getChannelData(Math.min(channel, b.numberOfChannels - 1));
      outputData.set(inputData, offset);
    }
    offset += b.length;
  }

  const wavBlob = audioBufferToWavBlob(mergedBuffer);
  const dataUrl = await blobToDataUrl(wavBlob);
  const combinedName = `整合参考音频_${files.length}个文件_${new Date().toLocaleTimeString().replace(/:/g, "")}.wav`;

  return { dataUrl, fileName: combinedName };
}

export async function mergeAudioAssets(assets: AudioAsset[]): Promise<AudioAsset> {
  const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("当前浏览器不支持本地音频整合。");
  const context = new AudioContextConstructor();
  try {
    const decoded = await Promise.all(
      assets.map(async (asset) => {
        const u8 = await fetchAudioUint8Array(asset.dataUrl);
        const arrayBuf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
        return context.decodeAudioData(arrayBuf);
      })
    );
    const sampleRate = decoded[0].sampleRate;
    const channelCount = Math.max(...decoded.map((audio) => audio.numberOfChannels));
    const normalized = await Promise.all(decoded.map((audio) => resampleAudioBuffer(audio, sampleRate, channelCount)));
    const totalFrames = normalized.reduce((sum, audio) => sum + audio.length, 0);
    const output = context.createBuffer(channelCount, totalFrames, sampleRate);
    let offset = 0;
    for (const audio of normalized) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        output.getChannelData(channel).set(audio.getChannelData(Math.min(channel, audio.numberOfChannels - 1)), offset);
      }
      offset += audio.length;
    }
    const blob = encodeAudioBufferToWav(output);
    return {
      fileName: `merged-reference-${formatDateForFile(new Date())}.wav`,
      mimeType: "audio/wav",
      size: blob.size,
      dataUrl: await blobToDataUrl(blob)
    };
  } finally {
    await context.close();
  }
}

export async function resampleAudioBuffer(input: AudioBuffer, sampleRate: number, channelCount: number): Promise<AudioBuffer> {
  if (input.sampleRate === sampleRate && input.numberOfChannels === channelCount) return input;
  const OfflineAudioContextConstructor = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OfflineAudioContextConstructor) return input;
  const offline = new OfflineAudioContextConstructor(channelCount, Math.ceil(input.duration * sampleRate), sampleRate);
  const source = offline.createBufferSource();
  source.buffer = input;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

export async function trimVocalAudioDataUrl(
  dataUrl: string,
  mode: GameVocalDurationMode
): Promise<{ dataUrl: string; size: number }> {
  const AudioContextConstructor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return { dataUrl, size: 0 };
  const context = new AudioContextConstructor();
  try {
    const u8 = await fetchAudioUint8Array(dataUrl);
    const arrayBuf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    const decoded = await context.decodeAudioData(arrayBuf);

    let maxSec = mode === "ultra_short" ? 0.75 : mode === "dramatic" ? 2.6 : 1.35;
    if (decoded.duration <= maxSec) {
      return { dataUrl, size: u8.byteLength };
    }

    const trimmedBuffer = smartTrimGameVocalAudioBuffer(decoded, context, mode);
    const blob = encodeAudioBufferToWav(trimmedBuffer);
    const trimmedDataUrl = await blobToDataUrl(blob);
    return { dataUrl: trimmedDataUrl, size: blob.size };
  } finally {
    await context.close();
  }
}

export async function fileToAudioAsset(file: File): Promise<AudioAsset> {
  return {
    fileName: file.name,
    mimeType: file.type || guessMimeFromName(file.name),
    size: file.size,
    dataUrl: await blobToDataUrl(file)
  };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl) {
    return new Blob([], { type: "audio/wav" });
  }
  if (dataUrl.startsWith("data:")) {
    const [meta, base64] = dataUrl.split(",");
    const mimeType = meta.match(/data:(.*);base64/)?.[1] || "audio/wav";
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([], { type: "audio/wav" });
}

export async function fetchAudioUint8Array(urlOrData: string): Promise<Uint8Array> {
  return fetchAudioBytes(urlOrData);
}

export function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string): File {
  if (!dataUrl) {
    return new File([], fileName, { type: mimeType || "audio/wav" });
  }
  if (dataUrl.startsWith("data:")) {
    const [meta, base64] = dataUrl.split(",");
    const resolvedMime = mimeType || meta.match(/data:(.*);base64/)?.[1] || "audio/mpeg";
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], fileName, { type: resolvedMime });
  }
  return new File([], fileName, { type: mimeType || "audio/wav" });
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  if (!dataUrl) return new Uint8Array(0);
  if (dataUrl.startsWith("data:")) {
    const base64 = dataUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return new Uint8Array(0);
}

export function getSupportedRecordingMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

export async function convertRecordedBlobToWav(blob: Blob): Promise<Blob> {
  const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("当前浏览器无法处理录音，请改用上传音频文件。");
  }

  const audioContext = new AudioContextConstructor();
  try {
    const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    return encodeAudioBufferToWav(audioBuffer);
  } finally {
    await audioContext.close();
  }
}

export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取录音失败。"));
    reader.readAsDataURL(blob);
  });
}

export function guessMimeFromName(fileName: string): string {
  if (/\.wav$/i.test(fileName)) {
    return "audio/wav";
  }
  if (/\.(m4a|mp4)$/i.test(fileName)) {
    return "audio/m4a";
  }
  return "audio/mp3";
}
