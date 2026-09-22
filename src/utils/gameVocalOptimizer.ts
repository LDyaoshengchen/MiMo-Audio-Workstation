/**
 * Game Vocal Audio & Prompt Optimization Engine
 * 专为 MiMo 语音大模型游戏语气词生成打造的发声控制与防拖长音引擎
 */

export type GameVocalDurationMode = "ultra_short" | "standard" | "dramatic";

export interface GameVocalPromptOptions {
  baseInstruction: string;
  vocalText: string;
  categoryTitle?: string;
  subcategoryLabel?: string;
  durationMode?: GameVocalDurationMode;
  antiDrone?: boolean;
  phoneticAnchor?: boolean;
}

/**
 * 常见游戏语气词的发音器官与口型动作声学特征映射表
 * 彻底解决大模型对无元音或特殊外语拼写（如 Ngh!, Hrk!, Ghk!, Tch!）的 G2P 发音幻觉与死循环拖长
 */
export const VOCAL_PHONETIC_ANCHOR_MAP: Record<string, string> = {
  // --- 1. 受击与痛苦反应 (Hit & Pain) ---
  "ack!": "声门被卡骤然呛咳的受挫短音“咳！”",
  "ugh!": "腹部受创急促排气的沉重短闷哼“呃！”",
  "ow!": "遭受刺痛瞬态的极短痛呼“嗷！”",
  "ouch!": "受尖锐刺击的短促痛呼“哎哟！”",
  "unh!": "紧闭口鼻受挫忍痛的短促闷哼“唔！”",
  "gah!": "喉部受创骤然爆破声“嘎！”",
  "hn!": "鼻腔紧闭受挫的短闭阻音“哼！”",
  "tch!": "舌尖弹击牙齿的短促轻蔑咂舌声“嘁！”",
  "urk!": "喉管受阻被扼住的极短窒息憋音“呃！”",
  "oof!": "胸腹受重击猛烈排气的沉重短闷声“唔！”",
  "hey!": "受创错愕的短促惊呼“嘿！”",
  "ah!": "极短促受挫痛呼，0.4秒内迅速闭口收音，严禁拖长",
  "ngh!": "牙关紧咬用力屏息忍痛的短闭气音“嗯！”",
  "hrk!": "受创短促气逆吸气卡喉音",
  "huh!": "短促错愕抽气呼音“哈！”",
  "ghk!": "喉部受击瞬态闭锁爆破短音",
  "tsk!": "轻快短促的咂舌声",
  "nn!": "闭口短促轻哼“嗯”",
  "hk!": "声门短促痉挛卡顿音",
  "gck!": "喉部短促闭锁爆破音",

  // --- 2. 攻击与发力发声 (Attack & Exertion) ---
  "hah!": "短促刀剑劈砍发力爆发呼喝“哈！”",
  "ha!": "短促有力的出招发力音“哈！”",
  "hyah!": "凌厉冲刺劈砍爆发音“呀！”",
  "hya!": "短促敏捷的近战发力声“呀！”",
  "hup!": "轻快起步弹射发力音“喝！”",
  "yah!": "迎头挥斩爆发呼喝“呀！”",
  "sei!": "格斗直拳干脆爆发呼喝“喝！”",
  "tei!": "利落回旋击打呼喝“呔！”",
  "hwah!": "双手重刀破风呼喝“嚯！”",
  "tyah!": "高速突刺凌厉短喝“嚓！”",
  "hiyah!": "经典双音节爆发击打喝声“嗨呀！”",
  "shhh!": "高速穿梭呼气声",
  "hoo!": "短促吐气发力音“呼！”",
  "tah!": "干脆短促击打音“哒！”",
  "yaa!": "短促冲击发力喝声“呀！”",
  "dah!": "重脚踏地爆发踢击音“哒！”",
  "chah!": "利落武术出拳呼喝“嚓！”",
  "hraah!": "重型蓄力猛烈重砍咆哮“喝啊！”",
  "graah!": "狂暴全力下砸发力咆哮“哇啊！”",
  "hyaaah!": "终极蓄力爆发突进长喝“呀啊！”",
  "urgh!": "重物负荷持续发力短音“呃！”",
  "hrrraah!": "丹田深吸发力蓄力爆发呼喝",

  // --- 3. 移动与机动 (Movement) ---
  "yoop!": "轻快踩踏起跳跃升音“唷！”",
  "hop!": "轻盈踏步跳跃音“霍！”",
  "up!": "简短冲天跃起音“起！”",
  "leap!": "腾空飞跃呼喝",
  "hold on!": "攀紧岩壁抓握发力声",
  "heave!": "抓取重物向上拉拽发声“嗨！”",
  "pull!": "用力拽拉动作发音“拉！”",
  "swift!": "疾走突进穿梭拟声",
  "dash!": "瞬身突刺闪避口令“冲！”",

  // --- 4. 野兽与怪物 (Beast & Monster) ---
  "gnarl...": "猛兽喉底齿缝低吼",
  "grrr...": "喉咙深处的低沉兽吼，带有颤动共鸣",
  "grrrr!": "凶猛齿音低吼",
  "rawr!": "猛兽短促扑咬狂啸",
  "roaaar!": "爆发性野兽怒吼咆哮",
  "vraaaargh!": "远古巨兽深沉长啸咆哮",
  "skraaa!": "狂暴飞禽猛兽扑击尖啸",

  // --- 5. 机械与合成 (Mechanical) ---
  "beep.": "纯净电子提示短音",
  "bweep!": "升调合成器轻快脉冲",
  "confirmed.": "清晰无感情的合成人声“确认”",
  "warning.": "警报系统冷静广播“警告”",

  // --- 6. 人类台词 (Human) ---
  "down you go!": "击倒敌人的自信终结语",
  "take this!": "出招呼喝“接招！”",
  "too slow!": "嘲讽轻蔑语“太慢了！”"
};

/**
 * 获取语气词的发音要领提示
 */
export function getVocalPhoneticHint(text: string): string {
  const clean = text.toLowerCase().trim();
  if (VOCAL_PHONETIC_ANCHOR_MAP[clean]) {
    return VOCAL_PHONETIC_ANCHOR_MAP[clean];
  }

  // 泛化正则匹配
  if (clean.endsWith("!")) {
    return `极短促瞬态爆发音，爆发后立即收音断音`;
  }
  if (clean.endsWith("...")) {
    return `低沉胸腔/喉音，收音利落，避免长鸣拖音`;
  }

  return `短促清晰的发音，单次利落发声`;
}

/**
 * 组装专为 MiMo 大模型优化的游戏语气词声学提示词
 * 融合基础风格、发音器官锚点与核心防拖音声学约束
 */
export function buildOptimizedGameVocalPrompt(options: GameVocalPromptOptions): string {
  const {
    baseInstruction,
    vocalText,
    durationMode = "standard",
    antiDrone = true,
    phoneticAnchor = true
  } = options;

  const parts: string[] = [];

  // 1. 基础发声风格描述
  if (baseInstruction.trim()) {
    parts.push(baseInstruction.trim());
  }

  // 2. 发音锚点与读音特征（消除生僻拟声词 G2P 幻觉）
  if (phoneticAnchor) {
    const hint = getVocalPhoneticHint(vocalText);
    if (hint) {
      parts.push(`【发声动作要领】：拟声词「${vocalText}」发音为${hint}。`);
    }
  }

  // 3. 强力防拖音与收音刹车硬约束（切断模型长音死循环）
  if (antiDrone) {
    if (durationMode === "ultra_short") {
      parts.push(
        "【声学时长极速刹车约束】：此声音为极短促游戏瞬态音，整体时长必须控制在0.2秒至0.5秒之间！单次爆发后声带立即闭合并完全静音！绝对严禁拖长音、严禁长声呻吟、严禁长啸延音！"
      );
    } else if (durationMode === "standard") {
      parts.push(
        "【声学时长严格约束】：发音干脆短促，整体时长控制在0.5秒至1.0秒以内。发声结束后立即紧闭声带完全静音，尾音无任何多余拖沓，严禁持续长鸣或无意义拖长音！"
      );
    } else if (durationMode === "dramatic") {
      parts.push(
        "【声学表现与收尾要求】：富有戏剧张力，时长控制在1.2秒至2.2秒以内，发音完毕后自然收音渐隐，严禁失控延音。"
      );
    }
  }

  return parts.join("\n");
}

/**
 * 智能音频尾音截断与衰减函数 (客户端 AudioBuffer 级处理)
 * 当模型产生超过设定上限的长尾拖音时，进行毫秒级平滑淡出截断，彻底避免破音爆音
 */
export function smartTrimGameVocalAudioBuffer(
  audioBuffer: AudioBuffer,
  context: BaseAudioContext,
  mode: GameVocalDurationMode
): AudioBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const channelCount = audioBuffer.numberOfChannels;
  const totalFrames = audioBuffer.length;
  const totalDuration = totalFrames / sampleRate;

  let maxAllowedSeconds = 1.35;
  if (mode === "ultra_short") {
    maxAllowedSeconds = 0.75;
  } else if (mode === "standard") {
    maxAllowedSeconds = 1.35;
  } else if (mode === "dramatic") {
    maxAllowedSeconds = 2.6;
  }

  // 若音频时长已在合格范围内，直接返回原始音频
  if (totalDuration <= maxAllowedSeconds) {
    return audioBuffer;
  }

  // 截断到 maxAllowedSeconds，并在尾部应用 45ms 余弦平滑淡出 (Fade-Out)，杜绝音频爆音
  const targetFrames = Math.min(totalFrames, Math.floor(sampleRate * maxAllowedSeconds));
  const fadeDuration = 0.045; // 45ms
  const fadeFrames = Math.min(targetFrames, Math.floor(sampleRate * fadeDuration));
  const fadeStart = targetFrames - fadeFrames;

  const outputBuffer = context.createBuffer(channelCount, targetFrames, sampleRate);

  for (let c = 0; c < channelCount; c++) {
    const inputData = audioBuffer.getChannelData(c);
    const outputData = outputBuffer.getChannelData(c);
    outputData.set(inputData.subarray(0, targetFrames));

    for (let f = 0; f < fadeFrames; f++) {
      const idx = fadeStart + f;
      const progress = f / fadeFrames;
      const gain = 0.5 * (1 + Math.cos(Math.PI * progress));
      outputData[idx] *= gain;
    }
  }

  return outputBuffer;
}
