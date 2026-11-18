import WebSocket from "ws";
import { gunzipSync } from "node:zlib";

const MAX_BYTES = 32 * 1024 * 1024;

export async function readVolcResponse(response: Response): Promise<string> {
  if (!response.body) throw new Error("火山引擎响应为空。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error("火山引擎响应超过 32 MB。");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function decodeVolcStream(text: string, sse: boolean): Buffer {
  const chunks: Buffer[] = [];
  let finished = false;
  const frames = sse
    ? text.split(/\r?\n\r?\n/).map(event => event.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n"))
    : text.split(/\r?\n/);
  for (const frame of frames) {
    if (!frame.trim()) continue;
    const value = JSON.parse(frame);
    if (value.code !== 0 && value.code !== 20000000) throw new Error(`火山引擎合成失败（${value.code}）：${String(value.message || "").slice(0, 300)}`);
    if (value.data) chunks.push(Buffer.from(value.data, "base64"));
    if (value.code === 20000000) finished = true;
  }
  if (!finished || !chunks.length) throw new Error("火山引擎流式响应中断，未收到完整音频结束标记。");
  return Buffer.concat(chunks);
}

function word(value: number) {
  const bytes = Buffer.alloc(4);
  bytes.writeInt32BE(value);
  return bytes;
}

export function encodeVolcFrame(payload: object, event?: number, sessionId?: string): Buffer {
  const body = Buffer.from(JSON.stringify(payload));
  return Buffer.concat([
    Buffer.from([0x11, event === undefined ? 0x10 : 0x14, 0x10, 0]),
    ...(event === undefined ? [] : [word(event)]),
    ...(sessionId ? [word(Buffer.byteLength(sessionId)), Buffer.from(sessionId)] : []),
    word(body.length), body
  ]);
}

export function decodeVolcFrame(bytes: Buffer) {
  if (bytes.length < 8 || bytes[0] >> 4 !== 1) throw new Error("火山引擎 WebSocket 协议头无效。");
  const type = bytes[1] >> 4;
  const flags = bytes[1] & 15;
  let offset = (bytes[0] & 15) * 4;
  const integer = () => {
    if (offset + 4 > bytes.length) throw new Error("火山引擎 WebSocket 帧不完整。");
    const value = bytes.readInt32BE(offset);
    offset += 4;
    return value;
  };
  const skipString = () => {
    const length = integer();
    if (length < 0 || offset + length > bytes.length) throw new Error("火山引擎会话标识无效。");
    offset += length;
  };
  const sequence = flags & 1 ? integer() : undefined;
  const event = flags & 4 ? integer() : undefined;
  const errorCode = type === 15 ? integer() : undefined;
  if (event !== undefined && event >= 50) skipString();
  const size = integer();
  if (size < 0 || offset + size !== bytes.length) throw new Error("火山引擎 WebSocket 数据长度无效。");
  let payload = bytes.subarray(offset);
  if ((bytes[2] & 15) === 1) payload = gunzipSync(payload, { maxOutputLength: MAX_BYTES });
  return { type, event, sequence, errorCode, payload };
}

export function synthesizeVolcWebSocket(url: string, headers: Record<string, string>, payload: object,
  sessionId: string, bidirectional: boolean, legacy: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers, maxPayload: MAX_BYTES, handshakeTimeout: 15_000, followRedirects: false });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const timer = setTimeout(() => fail(new Error("火山引擎 WebSocket 合成超过 120 秒。")), 120_000);
    function fail(error: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.terminate();
      reject(error);
    }
    function finish() {
      if (!size) return fail(new Error("火山引擎未返回音频。"));
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(Buffer.concat(chunks));
    }
    socket.on("open", () => socket.send(bidirectional ? encodeVolcFrame({}, 1) : encodeVolcFrame(payload)));
    socket.on("error", () => fail(new Error("火山引擎 WebSocket 连接失败，请检查鉴权及服务权限。")));
    socket.on("unexpected-response", (_request, response) => {
      response.destroy();
      fail(new Error(`火山引擎 WebSocket 鉴权失败（HTTP ${response.statusCode}）。`));
    });
    socket.on("close", () => { if (!settled) fail(new Error("火山引擎 WebSocket 提前断开。")); });
    socket.on("message", data => {
      if (settled) return;
      try {
        const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        const frame = decodeVolcFrame(bytes);
        if (frame.errorCode) throw new Error(`火山引擎错误 ${frame.errorCode}。`);
        if (frame.type === 11) {
          size += frame.payload.length;
          if (size > MAX_BYTES) throw new Error("火山引擎音频超过 32 MB。");
          chunks.push(frame.payload);
          if (legacy && frame.sequence !== undefined && frame.sequence < 0) finish();
          return;
        }
        const meta = frame.payload.length ? JSON.parse(frame.payload.toString("utf8")) : {};
        if ([51, 153].includes(frame.event ?? 0) || (meta.status_code && meta.status_code !== 20000000)) {
          throw new Error(`火山引擎会话失败（${meta.status_code || frame.event}）。`);
        }
        if (bidirectional && frame.event === 50) {
          const { text: _text, ...sessionParams } = (payload as { req_params: Record<string, unknown> }).req_params;
          socket.send(encodeVolcFrame({ ...payload, req_params: sessionParams, event: 100, namespace: "BidirectionalTTS" }, 100, sessionId));
        }
        if (bidirectional && frame.event === 150) {
          socket.send(encodeVolcFrame({ ...payload, event: 200, namespace: "BidirectionalTTS" }, 200, sessionId));
          socket.send(encodeVolcFrame({}, 102, sessionId));
        }
        if (frame.event === 152) {
          if (meta.status_code !== 20000000) throw new Error("火山引擎会话未确认成功。");
          finish();
        }
      } catch (error) { fail(error instanceof Error ? error : new Error("火山引擎协议解析失败。")); }
    });
  });
}
