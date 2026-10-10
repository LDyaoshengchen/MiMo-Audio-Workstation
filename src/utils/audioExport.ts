import { assertAudioFormat } from "../../shared/audioValidation";

export async function fetchAudioBytes(source: string, signal?: AbortSignal): Promise<Uint8Array> {
  if (!source) throw new Error("音频地址为空，无法导出。");
  const response = await fetch(source, { signal: signal || AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`音频读取失败（HTTP ${response.status}）：${source.split("?")[0]}`);
  const contentType = response.headers.get("content-type") || "";
  if (/text\/|json|xml/i.test(contentType)) throw new Error("音频读取返回了错误页面，已停止导出。");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const expected = source.split(/[?#]/)[0].match(/\.(wav|mp3)$/i)?.[1]?.toLowerCase()
    || (/^data:audio\/(?:wav|x-wav|wave)/i.test(source) ? "wav" : /^data:audio\/(?:mpeg|mp3)/i.test(source) ? "mp3" : undefined);
  assertAudioFormat(bytes, expected);
  return bytes;
}
