export const MIMO_WORKFLOW_NOTICE = "智能规划、小说切分、角色分析、音色生成及 AI 标注暂仅接入 MiMo 协议。请切换至 MiMo 或自定义 mimo-chat；其他厂商的已接入语音合成功能不受影响。";
export function supportsMimoWorkflow(provider: string, protocol?: string) {
  return provider === "mimo" || (provider === "custom" && protocol === "mimo-chat");
}
