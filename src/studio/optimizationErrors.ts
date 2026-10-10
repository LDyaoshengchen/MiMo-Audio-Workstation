/** Keep upstream failures honest; do not retry or switch paid providers implicitly. */
export function formatOptimizationError(message: string): string {
  if (/insufficient\s+(?:account\s+)?balance|余额不足/i.test(message)) {
    const provider = message.match(/^(MiMo|OpenAI|SiliconFlow)\b/i)?.[1] || "当前服务商";
    return `AI 润色暂不可用：${provider} API 账户余额不足。请检查该 API Key 对应账户的余额，或在 API 设置中切换支持文本润色的服务商后重试。原始描述已保留。`;
  }
  return message;
}
