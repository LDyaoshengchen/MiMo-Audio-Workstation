import type { SelectedVocalItem } from "../utils/gameVocalLibrary";
import type { StudioNodeType, NodeData, ApiProviderPreset } from "../types/studio";
import { GAME_CHARACTER_PRESETS, getFormattedNaturalControl } from "../utils/gamePresets";
import { GAME_CHARACTER_TYPES } from "../utils/gameVocalCharacterTags";
import { GAME_VOCAL_CATEGORIES } from "../utils/gameVocalLibrary";
import { createId } from "./format";
import { getThemeNodeColors, lightPresets, darkPresets } from "./theme";

export const LIGHT_NODE_COLOR_MAP = getThemeNodeColors({ preset: "default", ...lightPresets.default }, true, "apple");
export const DARK_NODE_COLOR_MAP = getThemeNodeColors({ preset: "default", ...darkPresets.default }, false, "apple");

export const NODE_COLOR_MAP: Record<string, string> = DARK_NODE_COLOR_MAP;

export function getNodeDefaultData(type: StudioNodeType): NodeData {
  const p1 = GAME_CHARACTER_PRESETS[0]; // 深海狂鲨
  switch (type) {
    case "integratedStudio":
      return {
        title: "全能综合工作台",
        exportPrefixName: "游戏交战语音导出",
        batchRows: [
          {
            id: createId("row"),
            title: `${p1.nameZh} (${p1.categoryZh})`,
            instruction: p1.directionEn,
            text: p1.dialogueZh,
            artifacts: []
          }
        ]
      };
    case "batchVoiceClone":
      return {
        title: "批量音频克隆",
        exportPrefixName: "游戏批量克隆导出",
        batchRows: [
          {
            id: createId("row"),
            title: `${p1.nameZh} (${p1.categoryZh})`,
            instruction: p1.directionEn,
            text: p1.dialogueZh
          }
        ]
      };
    case "voiceClone":
      return {
        title: `音频克隆 (${p1.nameZh})`,
        instruction: p1.directionEn,
        text: p1.dialogueZh
      };
    case "voiceDesign":
      return {
        title: `音色创造 (${p1.nameZh})`,
        instruction: p1.voiceDescriptionEn,
        naturalControl: getFormattedNaturalControl(p1),
        text: p1.dialogueZh
      };
    case "batchVoiceDesign":
      return {
        title: "批量音色创造",
        exportPrefixName: "游戏音色设计导出",
        batchRows: [
          {
            id: createId("row"),
            title: p1.nameZh,
            instruction: p1.voiceDescriptionEn,
            naturalControl: getFormattedNaturalControl(p1),
            text: p1.dialogueZh
          }
        ]
      };
    case "prompt":
      return {
        title: `提示词 (${p1.nameZh})`,
        text: p1.dialogueZh
      };
    case "voiceStyle":
      return {
        title: `语音风格 (${p1.nameZh})`,
        text: p1.directionEn
      };
    case "referenceAudio":
      return { title: "参考音频", text: "声音样本" };
    case "audioMerge":
      return { title: "参考音频整合" };
    case "gameVocal": {
      const defaultCat = GAME_VOCAL_CATEGORIES[0];
      const defaultSub = defaultCat.subcategories[0];
      const defaultItems: SelectedVocalItem[] = defaultSub.items.slice(0, 3).map((txt) => ({
        id: createId("vocal"),
        categoryId: defaultCat.id,
        categoryTitle: defaultCat.title,
        subcategoryId: defaultSub.id,
        subcategoryLabel: defaultSub.label,
        text: txt
      }));
      return {
        title: "游戏语气词生成",
        vocalRefMode: "clone",
        vocalCharacterType: "human",
        vocalSelectedTags: GAME_CHARACTER_TYPES[0].defaultSelectedTags,
        vocalVoiceDescription: "",
        selectedCategoryId: defaultCat.id,
        selectedSubcategoryId: defaultSub.id,
        instruction: defaultCat.defaultInstruction,
        selectedVocals: defaultItems,
        antiDrone: true,
        vocalDurationMode: "standard",
        phoneticAnchor: true,
        autoTrimTail: true
      };
    }
    case "artifact":
      return { title: "音频产物" };
    case "batchArtifact":
      return { title: "批量音频克隆产物", batchArtifacts: [] };
    case "comment":
      return { title: "注释", text: "" };
    default:
      return { title: type };
  }
}

export const nodeCatalog: Record<
  StudioNodeType,
  {
    label: string;
    description: string;
    defaultData: () => NodeData;
  }
> = {
  integratedStudio: {
    label: "全能综合工作台",
    description: "参考音频、批量克隆与多轨产物三合一综合工作台",
    defaultData: () => getNodeDefaultData("integratedStudio")
  },
  gameVocal: {
    label: "游戏语气词",
    description: "基于官方语气词库一键批量合成各类拟声、战斗与状态发声",
    defaultData: () => getNodeDefaultData("gameVocal")
  },
  referenceAudio: {
    label: "参考音频",
    description: "上传声音样本，输出给克隆节点",
    defaultData: () => getNodeDefaultData("referenceAudio")
  },
  audioMerge: {
    label: "参考音频整合",
    description: "按顺序拼接连入的多个参考音频，输出 WAV 文件",
    defaultData: () => getNodeDefaultData("audioMerge")
  },
  voiceClone: {
    label: "音频克隆",
    description: "读取输入并生成克隆音频",
    defaultData: () => getNodeDefaultData("voiceClone")
  },
  batchVoiceClone: {
    label: "批量音频克隆",
    description: "只用一个参考音频，批量编辑与生成多段声音",
    defaultData: () => getNodeDefaultData("batchVoiceClone")
  },
  voiceDesign: {
    label: "音色创造",
    description: "用文字设计与自然语言控制音色并直接合成音频",
    defaultData: () => getNodeDefaultData("voiceDesign")
  },
  batchVoiceDesign: {
    label: "批量音色创造",
    description: "无参考音频，批量用文字描述设计多种音色并合成多段音频",
    defaultData: () => getNodeDefaultData("batchVoiceDesign")
  },
  batchArtifact: {
    label: "批量产物",
    description: "聚合并批量打包下载多条生成音频",
    defaultData: () => getNodeDefaultData("batchArtifact")
  },
  voiceStyle: {
    label: "语音风格",
    description: "导演文本，控制声音情绪和表达",
    defaultData: () => getNodeDefaultData("voiceStyle")
  },
  prompt: {
    label: "提示词",
    description: "要生成成音频的文本内容",
    defaultData: () => getNodeDefaultData("prompt")
  },
  comment: {
    label: "文本注释",
    description: "画布上的备注说明",
    defaultData: () => getNodeDefaultData("comment")
  },
  artifact: {
    label: "产物",
    description: "保存生成结果和下载入口",
    defaultData: () => getNodeDefaultData("artifact")
  }
};

export const autoSaveDelayMs = 30000;

export const DEFAULT_API_KEY = "";

export const DEFAULT_API_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";

export const API_KEY_STORAGE_KEY = "mimo-api-key";

export const API_ENDPOINT_STORAGE_KEY = "mimo-api-endpoint";

export const API_PROVIDER_STORAGE_KEY = "mimo-api-provider";

export const API_PROVIDERS: ApiProviderPreset[] = [
  {
    id: "mimo",
    name: "MiMo 官方 API",
    badge: "默认/推荐",
    endpoint: "https://api.xiaomimimo.com/v1/chat/completions",
    description: "小米 MiMo 语音与大模型平台，支持高保真音色克隆、自然语言音色设计与多情感演绎",
    getKeyUrl: "https://platform.xiaomimimo.com/",
    hint: "注册即可获取 API Key，支持导演音色风格控制与音频文本驱动",
    capabilities: {
      textOptimization: true,
      presetTTS: false,
      voiceDesign: true,
      instantClone: true,
      trainedClone: false,
      asr: false
    },
    subEndpoints: [
      { label: "默认官方地址", url: "https://api.xiaomimimo.com/v1/chat/completions" },
      { label: "Token 套餐地址", url: "https://token-plan-cn.xiaomimimo.com/v1/chat/completions" }
    ]
  },
  {
    id: "siliconflow",
    name: "SiliconFlow 硅基流动",
    badge: "主流模型集",
    endpoint: "https://api.siliconflow.cn/v1/audio/speech",
    description: "汇聚 CosyVoice、FishSpeech、SenseVoice 等主流语音与音色克隆大模型 API",
    getKeyUrl: "https://cloud.siliconflow.cn/",
    hint: "支持 CosyVoice 零样本声纹复刻与预置声音合成，兼容 OpenAI 格式中转",
    capabilities: {
      textOptimization: true,
      presetTTS: true,
      voiceDesign: false,
      instantClone: true,
      trainedClone: false,
      asr: false
    },
    subEndpoints: [
      { label: "Speech 官方地址", url: "https://api.siliconflow.cn/v1/audio/speech" }
    ]
  },
  {
    id: "fishaudio",
    name: "Fish Audio / Fish Speech",
    badge: "Zero-Shot 克隆",
    endpoint: "https://api.fish.audio/v1/tts",
    description: "专注于极简短声纹高保真零样本克隆与超自然语音合成",
    getKeyUrl: "https://fish.audio/",
    hint: "仅需短音频样本或参考模型 ID 即可快速完成生动音色复刻",
    capabilities: {
      textOptimization: false,
      presetTTS: true,
      voiceDesign: false,
      instantClone: true,
      trainedClone: true,
      asr: false
    }
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    badge: "全球顶尖音色",
    endpoint: "https://api.elevenlabs.io/v1/text-to-speech",
    description: "全球领先的 AI 语音生成与极速多语言声音合成平台",
    getKeyUrl: "https://elevenlabs.io/",
    hint: "支持 30+ 种语言朗读与已训练 Voice ID 微调",
    capabilities: {
      textOptimization: false,
      presetTTS: true,
      voiceDesign: false,
      instantClone: false,
      trainedClone: true,
      asr: false
    }
  },
  {
    id: "openai",
    name: "OpenAI Audio / 兼容中转",
    badge: "标准 TTS 协议",
    endpoint: "https://api.openai.com/v1/audio/speech",
    description: "OpenAI 官方语音 API (alloy/echo/fable/onyx/nova/shimmer) 或兼容 audio/speech 格式 API",
    getKeyUrl: "https://platform.openai.com/api-keys",
    hint: "官方标准 TTS 协议与 Whisper ASR，不开放公共即时克隆",
    capabilities: {
      textOptimization: true,
      presetTTS: true,
      voiceDesign: false,
      instantClone: false,
      trainedClone: false,
      asr: false
    }
  },
  {
    id: "volcengine",
    name: "火山引擎 (豆包语音)",
    badge: "字节豆包",
    endpoint: "https://openspeech.bytedance.com/api/v1/tts",
    description: "字节跳动商业级豆包大模型语音合成与多角色声音演播",
    getKeyUrl: "https://www.volcengine.com/product/speech",
    hint: "需配置 AppID 与 AccessToken，支持小说有声书、广播剧与角色演播",
    capabilities: {
      textOptimization: false,
      presetTTS: true,
      voiceDesign: false,
      instantClone: false,
      trainedClone: true,
      asr: false
    }
  },
  {
    id: "custom",
    name: "自定义 API 中转",
    badge: "自定义协议",
    endpoint: "",
    description: "手动配置第三方中转站、自建大模型代理或专有服务器 Endpoint（需声明协议）",
    getKeyUrl: "",
    hint: "请根据中转服务商提供的协议类型（MiMo/OpenAI/Fish/SiliconFlow）正确配置",
    capabilities: {
      textOptimization: true,
      presetTTS: true,
      voiceDesign: true,
      instantClone: true,
      trainedClone: true,
      asr: false
    }
  }
];

export const allowedAudioTypes = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"]);

export const maxAudioBytes = Math.floor(7.5 * 1024 * 1024);
