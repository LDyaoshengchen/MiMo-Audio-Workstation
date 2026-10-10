/** ElevenLabs PCM 输出为单声道、16-bit little-endian；添加标准 RIFF/WAVE 容器。 */
export function pcm16ToWav(pcm: Buffer, sampleRate: number): Buffer {
  if (!pcm.length || pcm.length % 2 !== 0) throw new Error("厂商返回的 PCM 音频为空或不完整。");
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || pcm.length > 0xffffffff - 36) throw new Error("非法的 WAV 音频参数。");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
