/** 校验容器而非只看后缀；支持常见 RIFF/WAVE（含流式长度）和 MP3。 */
export function detectAudioFormat(bytes: Uint8Array): "wav" | "mp3" {
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length >= 44 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const size = view.getUint32(4, true);
    if (size !== 0xffffffff && size + 8 > bytes.length) throw new Error("WAV 音频数据不完整。");
    const end = size === 0xffffffff ? bytes.length : size + 8;
    let hasFormat = false;
    let hasAudio = false;
    for (let offset = 12; offset + 8 <= end;) {
      const id = ascii(offset, 4);
      const declared = view.getUint32(offset + 4, true);
      const length = declared === 0xffffffff && id === "data" ? end - offset - 8 : declared;
      if (offset + 8 + length > end) throw new Error("WAV 音频块不完整。");
      if (id === "fmt ") {
        if (length < 16 || !view.getUint16(offset + 8, true) || !view.getUint16(offset + 10, true) || !view.getUint32(offset + 12, true)) throw new Error("WAV 格式信息无效。");
        hasFormat = true;
      }
      if (id === "data" && length > 0) hasAudio = true;
      offset += 8 + length + (length % 2);
    }
    if (hasFormat && hasAudio) return "wav";
    throw new Error("WAV 缺少格式信息或有效音频数据。");
  }
  let offset = 0;
  if (bytes.length >= 10 && ascii(0, 3) === "ID3") {
    if (bytes.subarray(6, 10).some(n => n > 127)) throw new Error("MP3 ID3 信息无效。");
    offset = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
    if (bytes[5] & 0x10) offset += 10;
  }
  // 至少包含一个有效 MPEG 音频帧头，不能将只有 ID3 标签的文件当作音频。
  if (offset + 4 < bytes.length && bytes[offset] === 0xff && (bytes[offset + 1] & 0xe0) === 0xe0
    && (bytes[offset + 1] & 0x18) !== 0x08 && (bytes[offset + 1] & 0x06) !== 0
    && (bytes[offset + 2] & 0xf0) !== 0xf0 && (bytes[offset + 2] & 0x0c) !== 0x0c) return "mp3";
  throw new Error("返回内容不是有效 WAV/MP3 音频，已停止保存或打包。");
}

export function assertAudioFormat(bytes: Uint8Array, expected?: string) {
  const format = detectAudioFormat(bytes);
  if (expected && format !== expected.toLowerCase()) throw new Error(`音频格式不匹配：要求 ${expected}，实际为 ${format}。`);
  return format;
}
