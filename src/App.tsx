import "@xyflow/react/dist/style.css";
import {
  addEdge,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type NodeTypes,
  type NodeChange,
  type FinalConnectionState,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
  useUpdateNodeInternals
} from "@xyflow/react";
import {
  AlertTriangle,
  Archive,
  AudioLines,
  BookOpen,
  BookPlus,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Download,
  FileAudio,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  Grid,
  GripVertical,
  Key,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Mic2,
  Pause,
  PanelTop,
  Palette,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Share2,
  Sparkles,
  Square,
  Sun,
  Moon,
  Monitor,
  Table,
  Trash2,
  Wand2,
  Undo2,
  Redo2,
  Upload,
  Mic,
  Zap,
  X
} from "lucide-react";
import { ChangeEvent, MouseEvent, ReactNode, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getBezierPath, useReactFlow } from "@xyflow/react";
import JSZip from "jszip";

type StatusResponse = {
  ok: boolean;
  model: string;
  apiKeyConfigured: boolean;
  maxAudioBytes: number;
  allowedMimeTypes: string[];
};

const NODE_COLOR_MAP: Record<string, string> = {
  referenceAudio: "#f59e0b",
  audioMerge: "#fb923c",
  voiceStyle: "#c084fc",
  prompt: "#34d399",
  voiceClone: "#facc15",
  voiceDesign: "#38bdf8",
  artifact: "#fef08a",
  batchVoiceClone: "#facc15",
  batchVoiceDesign: "#38bdf8",
  batchArtifact: "#fef08a",
  integratedStudio: "#f8fafc",
  comment: "#94a3b8"
};

type ApiSettingsResponse = {
  apiKey: string;
  apiEndpoint: string;
  apiProvider?: string;
  configured: boolean;
};

type WorkspaceSummary = {
  id: string;
  name: string;
  type: "board" | "audiobook";
  createdAt: string;
  updatedAt: string;
  nodeCount?: number;
  edgeCount?: number;
  stashCount?: number;
  characterCount?: number;
  segmentCount?: number;
  phase?: string;
};

type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  type: "board" | "audiobook";
  isBuiltIn?: boolean;
  createdAt: string;
};

type BoardWorkspacePayload = {
  id: string;
  type: "board";
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: StudioNode[];
  edges: StudioEdge[];
  stashItems: StashItem[];
};

type AudiobookCharacter = {
  id: string;
  name: string;
  roleType: "narrator" | "protagonist" | "supporting" | "custom";
  aliases: string[];
  voiceSource: "analysis" | "manualDesign" | "manualClone";
  voiceMode: "designed" | "cloned";
  isSystem?: boolean;
  isVoiceLocked?: boolean;
  gender: string;
  age: string;
  voiceTraits: string;
  personality: string;
  voiceDescription: string;
  voiceSampleText?: string;
  voiceDataUrl: string | null;
  voiceStatus: "pending" | "generating" | "ready" | "error";
  voiceError?: string;
  referenceAudioDataUrl?: string;
  referenceAudioFileName?: string;
  referenceAudioMimeType?: string;
};

type AudiobookSegment = {
  id: string;
  text: string;
  characterId: string | null;
  characterName: string;
  emotion: string;
  isAutoAnnotated: boolean;
};

type AudiobookProduct = {
  id: string;
  segmentId: string;
  characterId: string | null;
  characterName: string;
  text: string;
  instruction: string;
  audioDataUrl: string | null;
  status: "pending" | "generating" | "ready" | "error";
  error?: string;
  elapsedMs?: number;
  createdAt: string;
  synthesisMethod: "voiceClone" | "voiceDesign";
};

type AudiobookChapter = {
  id: string;
  title: string;
  novelText: string;
  characterHints: string;
  segments: AudiobookSegment[];
  products: AudiobookProduct[];
  phase: "character-creation" | "annotation" | "generation";
  createdAt: string;
  updatedAt: string;
};

type AudiobookWorkspacePayload = {
  id: string;
  type: "audiobook";
  name: string;
  createdAt: string;
  updatedAt: string;
  activeChapterId: string;
  novelText: string;
  characterHints: string;
  characters: AudiobookCharacter[];
  segments: AudiobookSegment[];
  products: AudiobookProduct[];
  phase: "character-creation" | "annotation" | "generation";
  chapters: AudiobookChapter[];
};

type WorkspacePayload = BoardWorkspacePayload | AudiobookWorkspacePayload;

type WorkspacesResponse = {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceSummary[];
};

export interface IntegratedRowArtifact {
  id: string;
  seqIndex?: number;
  fileName: string;
  audioDataUrl: string;
  elapsedMs: number;
  createdAt: string;
}

export interface BatchVoiceCloneRow {
  id: string;
  title: string;
  instruction: string;
  naturalControl?: string;
  voiceStyle?: string;
  text: string;
  refAudioUrl?: string;
  refAudioName?: string;
  artifacts?: IntegratedRowArtifact[];
}

export interface BatchArtifactItem {
  id: string;
  seqIndex?: number;
  rowTitle: string;
  fileName: string;
  audioDataUrl: string;
  elapsedMs: number;
  createdAt: string;
}

type StudioNodeType = "referenceAudio" | "audioMerge" | "voiceStyle" | "prompt" | "voiceClone" | "voiceDesign" | "artifact" | "batchVoiceClone" | "batchVoiceDesign" | "batchArtifact" | "integratedStudio" | "comment";
type StudioNode = Node<NodeData, StudioNodeType>;
type StudioEdge = Edge<{ onDeleteEdge?: (edgeId: string) => void }>;

type AudioAsset = {
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

type ArtifactData = {
  fileName: string;
  audioDataUrl: string;
  elapsedMs: number;
  createdAt: string;
  sourceNodeName: string;
  sourceNodeId?: string;
  sourceRowId?: string;
  mimeType?: string;
  size?: number;
};

type StashItem = ArtifactData & {
  id: string;
  timestamp?: number;
};

type NodeData = {
  title: string;
  text?: string;
  instruction?: string;
  naturalControl?: string;
  voiceDescription?: string;
  audio?: AudioAsset;
  /** A reference node may hold several samples; the first one remains available as audio for compatibility. */
  audioAssets?: AudioAsset[];
  artifact?: ArtifactData;
  exportPrefixName?: string;
  parentTitle?: string;
  seqIndex?: number;
  batchRowId?: string;
  batchRows?: BatchVoiceCloneRow[];
  batchArtifacts?: BatchArtifactItem[];
  refAudioUrl?: string;
  refAudioName?: string;
  refAudioDuration?: number;
  isRunning?: boolean;
  singleRunningRowId?: string;
  error?: string;
  workspaceName?: string;
  onPatch?: (nodeId: string, patch: Partial<NodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onRunClone?: (nodeId: string) => void;
  onRunBatchVoiceClone?: (nodeId: string) => void;
  onRunSingleRowBatchVoiceClone?: (nodeId: string, rowId: string) => void;
  onRunBatchVoiceDesign?: (nodeId: string) => void;
  onRunSingleRowBatchVoiceDesign?: (nodeId: string, rowId: string) => void;
  onRunIntegratedBatch?: (nodeId: string) => void;
  onRunIntegratedSingleRow?: (nodeId: string, rowId: string) => void;
  onDeleteIntegratedArtifactItem?: (nodeId: string, rowId: string, itemId: string) => void;
  onDeleteBatchArtifactItem?: (nodeId: string, itemId: string) => void;
  onRunVoiceDesign?: (nodeId: string, count?: number) => void;
  onOptimizeStyle?: (nodeId: string) => void;
  onOptimizeVoiceDesign?: (nodeId: string) => void;
  onStashArtifact?: (artifact: ArtifactData) => void;
  onToggleStashArtifact?: (artifact: ArtifactData) => void;
  onRunAudioMerge?: (nodeId: string) => void;
  onCreateReferenceFromAudio?: (title: string, audioAsset: AudioAsset) => void;
  isArtifactStashed?: (artifact: ArtifactData) => boolean;
};

type DebugResponse = {
  audioDataUrl: string;
  fileName: string;
  elapsedMs: number;
};

type StyleOptimizeResponse = {
  optimizedText: string;
  elapsedMs: number;
  error?: string;
};

function formatHierarchyName(parentTitle?: string, nodeTitle?: string, seqIndex?: number): string {
  const p = (parentTitle || "").trim();
  const n = (nodeTitle || "").trim();
  const seq = seqIndex !== undefined ? String(seqIndex).padStart(2, "0") : "";

  let resultName = p;

  if (n) {
    if (!resultName) {
      resultName = n;
    } else if (resultName === n || resultName.endsWith(`_${n}`) || resultName.endsWith(` ${n}`)) {
      // Node title is already included in parent title
    } else {
      resultName = `${resultName}_${n}`;
    }
  }

  if (seq) {
    resultName = `${resultName}_${seq}`;
  }

  return resultName.replace(/[:：\s]+/g, "_");
}

const nodeCatalog: Record<
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
    defaultData: () => ({
      title: "全能综合工作台",
      exportPrefixName: "综合工作台导出",
      batchRows: [
        { id: "row_1", title: "句段 1", instruction: "自然、清晰的讲述感", text: "今天我们使用全能综合工作台验证第一条音频。", artifacts: [] },
        { id: "row_2", title: "句段 2", instruction: "轻松自然的语调", text: "这是全能综合工作台的第二条生成句段，自动分行对应产物。", artifacts: [] }
      ]
    })
  },
  referenceAudio: {
    label: "参考音频",
    description: "上传声音样本，输出给克隆节点",
    defaultData: () => ({ title: "参考音频", text: "声音样本" })
  },
  audioMerge: {
    label: "参考音频整合",
    description: "按顺序拼接连入的多个参考音频，输出 WAV 文件",
    defaultData: () => ({ title: "参考音频整合" })
  },
  voiceClone: {
    label: "音频克隆",
    description: "读取输入并生成克隆音频",
    defaultData: () => ({
      title: "音频克隆",
      instruction: "自然、清晰、略带播客讲述感，语速中等，语气友好但不过分夸张。",
      text: "今天我们完成了铸光音频工作站的第一条生成链路，现在用这段声音检查相似度、节奏和情绪表现。"
    })
  },
  batchVoiceClone: {
    label: "批量音频克隆",
    description: "只用一个参考音频，批量编辑与生成多段声音",
    defaultData: () => ({
      title: "批量音频克隆",
      exportPrefixName: "批量克隆导出",
      batchRows: [
        { id: "row_1", title: "句段 1", instruction: "自然、清晰的讲述感", text: "今天我们验证批量音频克隆的第一条生成句段。" },
        { id: "row_2", title: "句段 2", instruction: "轻松自然的语调", text: "这是批量生成的第二条句段，声音连贯稳定。" }
      ]
    })
  },
  voiceDesign: {
    label: "音色创造",
    description: "用文字设计与自然语言控制音色并直接合成音频",
    defaultData: () => ({
      title: "音色创造",
      instruction: "如\"一位年迈的老先生，说带北方口音的普通话，语速缓慢而沉稳，嗓音略带沙哑和沧桑感，仿佛一位饱经风霜的老爷爷在讲故事，充满岁月的智慧。\"",
      naturalControl: "角色：百年门阀岑家的现任大当家。自出生便被过继给祖庙的守门老人抚养，被塑造性成一尊完美无瑕、绝情断欲的家族图腾。常年深居简出，对人有着极强的阶级疏离感。\n场景：在祠堂的阴影里，看着那个不顾一切冲破保安防线来找她、企图带她私奔的男人。她要用最冷硬的阶级壁垒，绞杀对方，也绞杀自己刚刚萌芽、却足以燎原的感情。\n指导：冰冷、慵懒却极具威压的低音御姐。发声通道非常松弛，没有任何剑拔弩张，却有着让人骨里生寒的压迫感。",
      text: "这是一段使用文字设计与自然语言控制生成的示范文本。"
    })
  },
  batchVoiceDesign: {
    label: "批量音色创造",
    description: "无参考音频，批量用文字描述设计多种音色并合成多段音频",
    defaultData: () => ({
      title: "批量音色创造",
      exportPrefixName: "批量音色导出",
      batchRows: [
        { id: "row_1", title: "句段 1", instruction: "30岁成熟女性，声音温润清亮，具有优雅自然的旁白质感", naturalControl: "角色：旁白/讲述人\n指导：沉静自然", text: "今天我们验证批量音色创造的第一条生成句段。" },
        { id: "row_2", title: "句段 2", instruction: "40岁中年男性，嗓音低沉有磁性，语气稳重沉稳", naturalControl: "角色：老掌柜\n指导：温和沧桑", text: "这是批量生成的第二条音色创造句段。" }
      ]
    })
  },
  batchArtifact: {
    label: "批量产物",
    description: "聚合并批量打包下载多条生成音频",
    defaultData: () => ({ title: "批量音频克隆产物", batchArtifacts: [] })
  },
  voiceStyle: {
    label: "语音风格",
    description: "导演文本，控制声音情绪和表达",
    defaultData: () => ({ title: "语音风格", text: "自然、清晰、略带播客讲述感，语速中等，语气友好但不过分夸张。" })
  },
  prompt: {
    label: "提示词",
    description: "要生成成音频的文本内容",
    defaultData: () => ({ title: "提示词", text: "今天我们完成了铸光音频工作站的第一条生成链路，现在用这段声音检查相似度、节奏和情绪表现。" })
  },
  comment: {
    label: "文本注释",
    description: "画布上的备注说明",
    defaultData: () => ({ title: "注释", text: "" })
  },
  artifact: {
    label: "产物",
    description: "保存生成结果和下载入口",
    defaultData: () => ({ title: "音频产物" })
  }
};

const autoSaveDelayMs = 30000;
const DEFAULT_API_KEY = "sk-c082b7jneccm1zjoacep5mwy6kgwpw3votc8dqr2we9zy2sr";
const DEFAULT_API_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const API_KEY_STORAGE_KEY = "mimo-api-key";
const API_ENDPOINT_STORAGE_KEY = "mimo-api-endpoint";
const API_PROVIDER_STORAGE_KEY = "mimo-api-provider";

interface ApiProviderPreset {
  id: string;
  name: string;
  badge: string;
  endpoint: string;
  description: string;
  getKeyUrl?: string;
  hint?: string;
  subEndpoints?: Array<{ label: string; url: string }>;
}

const API_PROVIDERS: ApiProviderPreset[] = [
  {
    id: "mimo",
    name: "MiMo 官方 API",
    badge: "默认/推荐",
    endpoint: "https://api.xiaomimimo.com/v1/chat/completions",
    description: "小米 MiMo 语音与大模型平台，支持高保真音色克隆与多情感演绎",
    getKeyUrl: "https://platform.xiaomimimo.com/",
    hint: "注册即可获取 API Key，支持导演音色风格控制与音频文本驱动",
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
    hint: "支持 CosyVoice 零样本声纹复刻，兼容 OpenAI 格式中转",
    subEndpoints: [
      { label: "Speech 官方地址", url: "https://api.siliconflow.cn/v1/audio/speech" },
      { label: "Chat Completions 代理", url: "https://api.siliconflow.cn/v1/chat/completions" }
    ]
  },
  {
    id: "fishaudio",
    name: "Fish Audio / Fish Speech",
    badge: "Zero-Shot 克隆",
    endpoint: "https://api.fish.audio/v1/tts",
    description: "专注于极简短声纹高保真零样本克隆与超自然语音合成",
    getKeyUrl: "https://fish.audio/",
    hint: "仅需 5 秒参考音频即可快速完成生动音色复刻"
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    badge: "全球顶尖音色",
    endpoint: "https://api.elevenlabs.io/v1/text-to-speech",
    description: "全球领先的 AI 语音生成与极速多语言声音克隆平台",
    getKeyUrl: "https://elevenlabs.io/",
    hint: "支持 30+ 种语言朗读与精细化声线情感微调"
  },
  {
    id: "openai",
    name: "OpenAI Audio / 兼容中转",
    badge: "标准 TTS 协议",
    endpoint: "https://api.openai.com/v1/audio/speech",
    description: "OpenAI 官方语音 API 或兼容 OpenAI audio/speech 格式的 API 站",
    getKeyUrl: "https://platform.openai.com/api-keys",
    hint: "通用 OpenAI 协议，支持绝大多数 One-API / New-API 中转服务"
  },
  {
    id: "volcengine",
    name: "火山引擎 (豆包语音)",
    badge: "字节豆包",
    endpoint: "https://openspeech.bytedance.com/api/v1/tts",
    description: "字节跳动商业级豆包大模型语音合成与多角色声音定制",
    getKeyUrl: "https://www.volcengine.com/product/speech",
    hint: "适合小说有声书、广播剧与角色演播生成"
  },
  {
    id: "custom",
    name: "自定义 API 中转",
    badge: "自定义",
    endpoint: "",
    description: "手动配置第三方中转站、自建大模型代理或专有服务器 Endpoint",
    getKeyUrl: "",
    hint: "请根据中转服务商提供的 Endpoint 格式正确配置"
  }
];

const allowedAudioTypes = new Set(["audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/wav", "audio/x-wav", "audio/wave", "video/mp4"]);
const maxAudioBytes = Math.floor(7.5 * 1024 * 1024);
function ensureArtifactSeqIndexes(node: StudioNode, allNodes?: StudioNode[], allEdges?: StudioEdge[]): StudioNode {
  let nodeMutated = false;

  if (node.type === "batchArtifact" && allNodes && allEdges) {
    const parentEdge = allEdges.find((e) => e.target === node.id);
    if (parentEdge) {
      const parentNode = allNodes.find((n) => n.id === parentEdge.source);
      if (parentNode && parentNode.data.title && node.data.parentTitle !== parentNode.data.title) {
        nodeMutated = true;
        node = {
          ...node,
          data: {
            ...node.data,
            parentTitle: parentNode.data.title
          }
        };
      }
    }
  }

  if (node.type === "integratedStudio" && node.data.batchRows) {
    const updatedRows = node.data.batchRows.map((row) => {
      if (!row.artifacts || row.artifacts.length === 0) return row;
      let rowMutated = false;
      const updatedArtifacts = row.artifacts.map((art, idx) => {
        if (art.seqIndex === undefined) {
          rowMutated = true;
          nodeMutated = true;
          return { ...art, seqIndex: idx + 1 };
        }
        return art;
      });
      return rowMutated ? { ...row, artifacts: updatedArtifacts } : row;
    });
    if (nodeMutated) {
      return { ...node, data: { ...node.data, batchRows: updatedRows } };
    }
  }

  if (node.type === "batchArtifact" && node.data.batchArtifacts) {
    const updatedList = node.data.batchArtifacts.map((item, idx) => {
      if (item.seqIndex === undefined) {
        nodeMutated = true;
        return { ...item, seqIndex: idx + 1 };
      }
      return item;
    });
    if (nodeMutated) {
      return { ...node, data: { ...node.data, batchArtifacts: updatedList } };
    }
  }

  return node;
}

export default function App() {
  return (
    <ReactFlowProvider>
      <StudioApp />
    </ReactFlowProvider>
  );
}

interface ThemeColorSet {
  preset: string;
  bgColor: string;
  fgColor: string;
  accentColor: string;
  nodeColor?: string;
}

interface ThemeConfig {
  mode: "dark" | "light" | "system";
  lightTheme: ThemeColorSet;
  darkTheme: ThemeColorSet;
  brandTitleZh?: string;
  brandTitleEn?: string;
  autoHideTopbar?: boolean;
}

const lightPresets: Record<string, { label: string; bgColor: string; fgColor: string; accentColor: string; nodeColor: string }> = {
  default: { label: "Default Light", bgColor: "#f8fafc", fgColor: "#0f172a", accentColor: "#2563eb", nodeColor: "#ffffff" },
  catppuccin: { label: "Catppuccin", bgColor: "#eff1f5", fgColor: "#4c4f69", accentColor: "#8839ef", nodeColor: "#ffffff" },
  onelight: { label: "One Light", bgColor: "#fafafa", fgColor: "#383a42", accentColor: "#4078f2", nodeColor: "#ffffff" },
  solarized: { label: "Solarized Light", bgColor: "#fdf6e3", fgColor: "#657b83", accentColor: "#268bd2", nodeColor: "#eee8d5" }
};

const darkPresets: Record<string, { label: string; bgColor: string; fgColor: string; accentColor: string; nodeColor: string }> = {
  default: { label: "Default Dark", bgColor: "#0a0b0d", fgColor: "#f8fafc", accentColor: "#007acc", nodeColor: "#121216" },
  catppuccin: { label: "Catppuccin", bgColor: "#1e1e2e", fgColor: "#cdd6f4", accentColor: "#cba6f7", nodeColor: "#181825" },
  dracula: { label: "Dracula", bgColor: "#282a36", fgColor: "#f8f8f2", accentColor: "#bd93f9", nodeColor: "#21222c" },
  monokai: { label: "Monokai", bgColor: "#272822", fgColor: "#f8f8f2", accentColor: "#f92672", nodeColor: "#1e1f1c" },
  onedark: { label: "One Dark Pro", bgColor: "#282c34", fgColor: "#abb2bf", accentColor: "#61afef", nodeColor: "#21252b" },
  tokyonight: { label: "Tokyo Night", bgColor: "#1a1b26", fgColor: "#a9b1d6", accentColor: "#7aa2f7", nodeColor: "#16161e" },
  solarized: { label: "Solarized Dark", bgColor: "#002b36", fgColor: "#839496", accentColor: "#268bd2", nodeColor: "#073642" }
};

function resolveSystemMode(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): ThemeConfig {
  const defaultLight = { preset: "default", ...lightPresets.default };
  const defaultDark = { preset: "default", ...darkPresets.default };

  try {
    const saved = localStorage.getItem("mimo_theme_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lightTheme && parsed.darkTheme && parsed.mode) {
        return {
          ...parsed,
          lightTheme: { ...defaultLight, ...parsed.lightTheme },
          darkTheme: { ...defaultDark, ...parsed.darkTheme },
          brandTitleZh: parsed.brandTitleZh ?? "铸光音频工作站",
          brandTitleEn: parsed.brandTitleEn ?? "ZHUGUANG AUDIO WORKSTATION",
          autoHideTopbar: parsed.autoHideTopbar ?? true
        };
      }
      if (parsed.mode) {
        return {
          mode: parsed.mode,
          lightTheme: defaultLight,
          darkTheme: parsed.preset === "custom" || parsed.bgColor
            ? { preset: "custom", bgColor: parsed.bgColor || defaultDark.bgColor, fgColor: parsed.fgColor || defaultDark.fgColor, accentColor: parsed.accentColor || defaultDark.accentColor, nodeColor: defaultDark.nodeColor }
            : defaultDark,
          brandTitleZh: parsed.brandTitleZh ?? "铸光音频工作站",
          brandTitleEn: parsed.brandTitleEn ?? "ZHUGUANG AUDIO WORKSTATION",
          autoHideTopbar: parsed.autoHideTopbar ?? true
        };
      }
    }
  } catch { /* fallback */ }

  return {
    mode: "system",
    lightTheme: defaultLight,
    darkTheme: defaultDark,
    brandTitleZh: "铸光音频工作站",
    brandTitleEn: "ZHUGUANG AUDIO WORKSTATION",
    autoHideTopbar: true
  };
}

function StudioApp() {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(getInitialTheme);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showLightCustomColors, setShowLightCustomColors] = useState(false);
  const [showDarkCustomColors, setShowDarkCustomColors] = useState(false);
  const [showStoragePathModal, setShowStoragePathModal] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });
  const [appToast, setAppToast] = useState<{
    id: number;
    text: string;
    actionText?: string;
    onAction?: () => void;
  } | null>(null);

  const modalBackdropMouseDownRef = useRef<EventTarget | null>(null);

  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    modalBackdropMouseDownRef.current = e.target;
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>, onClose: () => void) {
    if (e.target === e.currentTarget && modalBackdropMouseDownRef.current === e.currentTarget) {
      onClose();
    }
  }

  const showToast = useCallback((text: string, actionText?: string, onAction?: () => void) => {
    const id = Date.now();
    setAppToast({ id, text, actionText, onAction });
    window.setTimeout(() => {
      setAppToast((curr) => (curr?.id === id ? null : curr));
    }, 5000);
  }, []);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspacePayload | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<StudioEdge>([]);
  const selectedNodesCount = useMemo(() => nodes.filter((n) => n.selected).length, [nodes]);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
    sourceNodeId?: string;
    sourceHandleId?: string | null;
    sourceHandleType?: "source" | "target";
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStashOpen, setIsStashOpen] = useState(false);
  const [boardDialog, setBoardDialog] = useState<"choice" | "templates" | "smart" | "audiobook" | null>(null);
  const flowRef = useRef<ReactFlowInstance<StudioNode, StudioEdge> | null>(null);
  const clipboardRef = useRef<{ nodes: StudioNode[]; edges: StudioEdge[] } | null>(null);

  const undoStackRef = useRef<{ nodes: StudioNode[]; edges: StudioEdge[] }[]>([]);
  const redoStackRef = useRef<{ nodes: StudioNode[]; edges: StudioEdge[] }[]>([]);
  const isUndoingRef = useRef<boolean>(false);
  const lastRecordedRef = useRef<string>("");

  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastRecordedRef.current = "";
  }, [activeWorkspace?.id]);

  const saveTimerRef = useRef<number | null>(null);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const rightDragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(API_KEY_STORAGE_KEY) || DEFAULT_API_KEY);
  const [apiEndpoint, setApiEndpoint] = useState<string>(() => localStorage.getItem(API_ENDPOINT_STORAGE_KEY) || DEFAULT_API_ENDPOINT);
  const [apiProvider, setApiProvider] = useState<string>(() => localStorage.getItem(API_PROVIDER_STORAGE_KEY) || "mimo");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const [apiEndpointInput, setApiEndpointInput] = useState(apiEndpoint);
  const [apiProviderInput, setApiProviderInput] = useState(apiProvider);
  const [topbarCollapsed, setTopbarCollapsed] = useState(false);
  const [showDefaultKeyWarning, setShowDefaultKeyWarning] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("mimo_sidebar_width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 200 && parsed <= 700) {
        return parsed;
      }
    }
    return 280;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(700, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setSidebarWidth((latestWidth) => {
        localStorage.setItem("mimo_sidebar_width", String(latestWidth));
        return latestWidth;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  const handleSidebarResetWidth = useCallback(() => {
    setSidebarWidth(280);
    localStorage.setItem("mimo_sidebar_width", "280");
  }, []);
  const [saveAsTargetWorkspace, setSaveAsTargetWorkspace] = useState<WorkspaceSummary | null>(null);
  const [saveAsTemplateWorkspace, setSaveAsTemplateWorkspace] = useState<WorkspaceSummary | null>(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportInitialTargetId, setExportInitialTargetId] = useState<string | undefined>(undefined);
  const [isDraggingJson, setIsDraggingJson] = useState(false);
  const [storagePathInfo, setStoragePathInfo] = useState<{ dataDir: string; workspaceFilePath: string; isCustom: boolean } | null>(null);
  const [customPathInput, setCustomPathInput] = useState("");
  const [bgVariant, setBgVariant] = useState<"dots" | "lines" | "cross" | "none">(
    () => (localStorage.getItem("mimo_bg_variant") as "dots" | "lines" | "cross" | "none") || "dots"
  );
  const [showNodeSearchModal, setShowNodeSearchModal] = useState(false);

  function updateBgVariant(variant: "dots" | "lines" | "cross" | "none") {
    setBgVariant(variant);
    localStorage.setItem("mimo_bg_variant", variant);
  }

  useEffect(() => {
    if (activeWorkspace?.name) {
      document.title = `${activeWorkspace.name} - MiMo 音色复刻调试台`;
    } else {
      document.title = "MiMo 音色复刻调试台";
    }
  }, [activeWorkspace?.name]);

  const tidyWorkspaceNodes = useCallback((onlySelected?: boolean) => {
    const allNodes = nodesRef.current;
    const allEdges = edgesRef.current;
    if (!allNodes || allNodes.length === 0) return;

    // Check if user has selected multiple nodes
    const selectedNodesList = allNodes.filter((n) => n.selected);
    const isSelectionMode = (onlySelected === true || (selectedNodesList.length >= 2 && onlySelected !== false)) && selectedNodesList.length < allNodes.length;

    const targetNodes = isSelectionMode ? selectedNodesList : allNodes;
    const targetNodeIds = new Set(targetNodes.map((n) => n.id));
    const targetEdges = allEdges.filter((e) => targetNodeIds.has(e.source) && targetNodeIds.has(e.target));

    function getNodeWidth(node: StudioNode): number {
      if (node.measured?.width && node.measured.width > 50) {
        return node.measured.width;
      }
      const t = node.type as StudioNodeType;
      if (t === "batchVoiceDesign") return 880;
      if (t === "batchVoiceClone" || t === "integratedStudio") return 640;
      if (t === "batchArtifact") return 440;
      if (t === "voiceDesign" || t === "voiceClone") return 360;
      if (t === "referenceAudio" || t === "audioMerge") return 340;
      if (t === "comment") return 280;
      return 340;
    }

    function getNodeHeight(node: StudioNode): number {
      if (node.measured?.height && node.measured.height > 50) {
        return node.measured.height;
      }
      const t = node.type as StudioNodeType;
      if (t === "batchVoiceDesign" || t === "batchVoiceClone") {
        const rowCount = node.data.batchRows?.length || 1;
        return Math.max(460, 180 + rowCount * 75);
      }
      if (t === "integratedStudio") {
        const rowCount = node.data.batchRows?.length || 1;
        return Math.max(640, 240 + rowCount * 75);
      }
      if (t === "batchArtifact") {
        const count = node.data.batchArtifacts?.length || 1;
        return Math.max(280, 140 + count * 70);
      }
      if (t === "artifact") return 145;
      if (t === "voiceDesign") return 640;
      if (t === "voiceClone") return 380;
      if (t === "referenceAudio" || t === "audioMerge") return 220;
      if (t === "comment") return 200;
      return 260;
    }

    // 1. Group target nodes into Connected Components (Disjoint Blocks)
    const adjMap = new Map<string, Set<string>>();
    targetNodes.forEach((n) => adjMap.set(n.id, new Set()));

    targetEdges.forEach((e) => {
      if (adjMap.has(e.source)) adjMap.get(e.source)!.add(e.target);
      if (adjMap.has(e.target)) adjMap.get(e.target)!.add(e.source);
    });

    const visited = new Set<string>();
    const blocks: StudioNode[][] = [];

    // Sort initial nodes by Y position to maintain user's natural top-to-bottom order
    const sortedNodes = [...targetNodes].sort((a, b) => a.position.y - b.position.y);

    sortedNodes.forEach((n) => {
      if (visited.has(n.id)) return;
      const component: StudioNode[] = [];
      const queue = [n.id];
      visited.add(n.id);

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currNode = targetNodes.find((cn) => cn.id === currId);
        if (currNode) component.push(currNode);

        const neighbors = adjMap.get(currId) || new Set();
        neighbors.forEach((nbrId) => {
          if (!visited.has(nbrId)) {
            visited.add(nbrId);
            queue.push(nbrId);
          }
        });
      }

      if (component.length > 0) {
        blocks.push(component);
      }
    });

    // Sort blocks by their minimum original Y position (top-to-bottom reading order)
    blocks.sort((a, b) => {
      const minYA = Math.min(...a.map((n) => n.position.y));
      const minYB = Math.min(...b.map((n) => n.position.y));
      return minYA - minYB;
    });

    const nodePositions = new Map<string, { x: number; y: number }>();
    const BLOCKS_PER_COLUMN = 5;

    // Starting origin:
    // If in selection mode, use the minimum top-left position of the selected nodes!
    const originBaseX = isSelectionMode ? Math.min(...targetNodes.map((n) => n.position.x)) : 80;
    const originBaseY = isSelectionMode ? Math.min(...targetNodes.map((n) => n.position.y)) : 80;

    // Split blocks into columns of 5 blocks each (数列超过5个工作流自动往右排一列)
    const blockColumns: StudioNode[][][] = [];
    for (let i = 0; i < blocks.length; i += BLOCKS_PER_COLUMN) {
      blockColumns.push(blocks.slice(i, i + BLOCKS_PER_COLUMN));
    }

    let globalColStartX = originBaseX;

    blockColumns.forEach((columnBlocks) => {
      let currentBlockStartY = originBaseY;
      let maxColWidth = 400;

      columnBlocks.forEach((blockNodes) => {
        const nodeMap = new Map<string, StudioNode>();
        blockNodes.forEach((n) => nodeMap.set(n.id, n));

        // Build adjacency and parent-child mapping
        const allChildrenMap = new Map<string, string[]>();
        const allParentsMap = new Map<string, string[]>();
        blockNodes.forEach((n) => {
          allChildrenMap.set(n.id, []);
          allParentsMap.set(n.id, []);
        });

        targetEdges.forEach((e) => {
          if (allChildrenMap.has(e.source) && allChildrenMap.has(e.target)) {
            if (!allChildrenMap.get(e.source)!.includes(e.target)) {
              allChildrenMap.get(e.source)!.push(e.target);
            }
            if (!allParentsMap.get(e.target)!.includes(e.source)) {
              allParentsMap.get(e.target)!.push(e.source);
            }
          }
        });

        // Separate direct artifact children from downstream logic children for every node
        const nodeArtifactChildren = new Map<string, StudioNode[]>();
        const nodeLogicChildren = new Map<string, string[]>();

        blockNodes.forEach((n) => {
          const rawChildren = allChildrenMap.get(n.id) || [];
          const arts: StudioNode[] = [];
          const logic: string[] = [];

          rawChildren.forEach((cId) => {
            const cNode = nodeMap.get(cId);
            if (cNode && (cNode.type === "artifact" || cNode.type === "batchArtifact")) {
              arts.push(cNode);
            } else {
              logic.push(cId);
            }
          });

          // Sort artifacts by seqIndex if available
          arts.sort((a, b) => {
            const seqA = a.data.seqIndex ?? 999;
            const seqB = b.data.seqIndex ?? 999;
            if (seqA !== seqB) return seqA - seqB;
            return a.position.y - b.position.y;
          });

          nodeArtifactChildren.set(n.id, arts);
          nodeLogicChildren.set(n.id, logic);
        });

        // Also if an artifact connects to a downstream logic node (e.g. artifact -> audioMerge),
        // attribute that logic node to the parent generator
        blockNodes.forEach((n) => {
          const arts = nodeArtifactChildren.get(n.id) || [];
          const logic = nodeLogicChildren.get(n.id) || [];
          arts.forEach((art) => {
            const artChildren = allChildrenMap.get(art.id) || [];
            artChildren.forEach((acId) => {
              const acNode = nodeMap.get(acId);
              if (acNode && acNode.type !== "artifact" && acNode.type !== "batchArtifact") {
                if (!logic.includes(acId)) {
                  logic.push(acId);
                }
              }
            });
          });
        });

        // Identify primary root nodes of this block (nodes with no upstream non-artifact parents in target set)
        let rootIds = blockNodes
          .filter((n) => {
            if (n.type === "artifact" || n.type === "batchArtifact") return false;
            const parents = allParentsMap.get(n.id) || [];
            const nonArtParents = parents.filter((pId) => {
              const p = nodeMap.get(pId);
              return p && p.type !== "artifact" && p.type !== "batchArtifact";
            });
            return nonArtParents.length === 0;
          })
          .map((n) => n.id);

        if (rootIds.length === 0) {
          const nonArtNodes = blockNodes.filter((n) => n.type !== "artifact" && n.type !== "batchArtifact");
          rootIds = nonArtNodes.length > 0
            ? [nonArtNodes.reduce((min, n) => (n.position.x < min.position.x ? n : min), nonArtNodes[0]).id]
            : [blockNodes[0].id];
        }

        rootIds.sort((a, b) => (nodeMap.get(a)?.position.y || 0) - (nodeMap.get(b)?.position.y || 0));

        const placedNodes = new Set<string>();

        // Recursive Subtree Layout function with 5-branch & height limit column wrapping
        function layoutPipelineSubtree(
          nodeId: string,
          originX: number,
          originY: number,
          isTopLevelRoot: boolean = false
        ): { width: number; height: number; endX: number } {
          placedNodes.add(nodeId);
          const node = nodeMap.get(nodeId);
          if (!node) return { width: 0, height: 0, endX: originX };

          const nodeW = getNodeWidth(node);
          const nodeH = getNodeHeight(node);

          nodePositions.set(nodeId, { x: originX, y: originY });

          const arts = (nodeArtifactChildren.get(nodeId) || []).filter((a) => !placedNodes.has(a.id));
          arts.forEach((a) => placedNodes.add(a.id));

          let artGridW = 0;
          let artGridH = 0;
          let nextLogicStartX = originX + nodeW + 60;

          if (arts.length > 0) {
            const isSingle = arts.every((a) => a.type === "artifact");
            const maxCols = 3;
            const colGap = isSingle ? 60 : 40;
            const rowGap = isSingle ? 60 : 40;
            const itemW = isSingle ? 340 : 440;
            const itemH = isSingle ? 145 : 280;

            const artStartX = originX + nodeW + 60;

            arts.forEach((artNode, idx) => {
              const cIdx = idx % maxCols;
              const rIdx = Math.floor(idx / maxCols);
              const ax = artStartX + cIdx * (itemW + colGap);
              const ay = originY + rIdx * (itemH + rowGap);
              nodePositions.set(artNode.id, { x: ax, y: ay });
            });

            const numCols = Math.min(arts.length, maxCols);
            const numRows = Math.ceil(arts.length / maxCols);
            artGridW = numCols * itemW + (numCols - 1) * colGap;
            artGridH = numRows * itemH + (numRows - 1) * rowGap;
            nextLogicStartX = artStartX + artGridW + 60;
          }

          const selfTotalW = arts.length > 0 ? nodeW + 60 + artGridW : nodeW;
          const selfTotalH = Math.max(nodeH, artGridH);

          // Get downstream logic children
          const rawLogicChildren = (nodeLogicChildren.get(nodeId) || []).filter((cId) => !placedNodes.has(cId));

          if (rawLogicChildren.length === 0) {
            return { width: selfTotalW, height: selfTotalH, endX: originX + selfTotalW };
          }

          // Sort downstream logic children by original Y position
          rawLogicChildren.sort((a, b) => (nodeMap.get(a)?.position.y || 0) - (nodeMap.get(b)?.position.y || 0));

          if (isTopLevelRoot && rawLogicChildren.length > 1) {
            // 每 5 个分支或高度超过限制自动换至右侧新一列，Y轴回到顶部 originBaseY
            let branchColX = nextLogicStartX;
            let branchColY = originBaseY;
            let currentBranchColMaxW = 0;
            let currentBranchColHeight = 0;
            let currentBranchCount = 0;
            let maxOverallX = nextLogicStartX;

            rawLogicChildren.forEach((childId) => {
              // 如果超过 5 个分支或者纵向高度超过限制，自动换至右侧新一列
              if (
                currentBranchCount >= 5 ||
                (currentBranchCount > 0 && currentBranchColHeight >= 2200)
              ) {
                branchColX += currentBranchColMaxW + 280; // X 轴自动右移留出 280px 通道
                branchColY = originBaseY; // Y 轴自动回到顶部 originBaseY 开始垂直对齐
                currentBranchColMaxW = 0;
                currentBranchColHeight = 0;
                currentBranchCount = 0;
              }

              const childBox = layoutPipelineSubtree(childId, branchColX, branchColY, false);
              if (childBox.width > currentBranchColMaxW) {
                currentBranchColMaxW = childBox.width;
              }
              if (childBox.endX > maxOverallX) {
                maxOverallX = childBox.endX;
              }

              branchColY += childBox.height + 50;
              currentBranchColHeight += childBox.height + 50;
              currentBranchCount += 1;
            });

            return {
              width: maxOverallX - originX,
              height: Math.max(selfTotalH, currentBranchColHeight),
              endX: maxOverallX
            };
          } else {
            // 管道多级节点：新的下游节点在上个下游节点的所有产物下边
            let currentChildY = originY;
            let maxChildSubtreeW = 0;
            let maxOverallX = nextLogicStartX;

            rawLogicChildren.forEach((childId) => {
              const childBox = layoutPipelineSubtree(childId, nextLogicStartX, currentChildY, false);
              if (childBox.width > maxChildSubtreeW) {
                maxChildSubtreeW = childBox.width;
              }
              if (childBox.endX > maxOverallX) {
                maxOverallX = childBox.endX;
              }
              currentChildY += childBox.height + 50;
            });

            const totalChildrenH = currentChildY - 50 - originY;
            const totalSubtreeH = Math.max(selfTotalH, totalChildrenH);
            const totalSubtreeW = selfTotalW + 60 + maxChildSubtreeW;

            return { width: totalSubtreeW, height: totalSubtreeH, endX: maxOverallX };
          }
        }

        // Layout all roots in this block
        let blockCurrentY = currentBlockStartY;
        let blockMaxW = 0;

        rootIds.forEach((rootId) => {
          if (!placedNodes.has(rootId)) {
            const rootBox = layoutPipelineSubtree(rootId, globalColStartX, blockCurrentY, true);
            if (rootBox.width > blockMaxW) blockMaxW = rootBox.width;
            blockCurrentY += rootBox.height + 60;
          }
        });

        // Any leftover nodes (disconnected in block)
        blockNodes.forEach((n) => {
          if (!placedNodes.has(n.id)) {
            placedNodes.add(n.id);
            const nw = getNodeWidth(n);
            const nh = getNodeHeight(n);
            nodePositions.set(n.id, { x: globalColStartX, y: blockCurrentY });
            if (nw > blockMaxW) blockMaxW = nw;
            blockCurrentY += nh + 40;
          }
        });

        const blockTotalHeight = blockCurrentY - currentBlockStartY;
        if (blockMaxW > maxColWidth) maxColWidth = blockMaxW;

        currentBlockStartY += Math.max(blockTotalHeight, 220) + 120;
      });

      // 第二列和第一列间隔空间大点 (280px)
      globalColStartX += maxColWidth + 280;
    });

    const nextNodes = allNodes.map((node) => {
      if (nodePositions.has(node.id)) {
        return {
          ...node,
          position: nodePositions.get(node.id)!
        };
      }
      return node;
    });

    setNodes(nextNodes);
    window.setTimeout(() => {
      if (!isSelectionMode) {
        flowRef.current?.fitView({ padding: 0.2, duration: 400 });
      }
      void saveWorkspace();
    }, 60);
  }, [setNodes]);

  const handleSelectSearchNode = useCallback(async (workspaceId: string, node: StudioNode) => {
    setShowNodeSearchModal(false);
    if (!activeWorkspaceRef.current || activeWorkspaceRef.current.id !== workspaceId) {
      await loadWorkspace(workspaceId);
    }
    window.setTimeout(() => {
      if (flowRef.current) {
        flowRef.current.setCenter(node.position.x + 160, node.position.y + 140, { zoom: 1.2, duration: 800 });
      }
    }, 180);
  }, []);
  const topbarHoverTimerRef = useRef<number | null>(null);

  function openExportModal(targetId?: string) {
    setExportInitialTargetId(targetId);
    setShowExportModal(true);
  }

  useEffect(() => {
    const root = document.documentElement;
    const effectiveMode = themeConfig.mode === "system" ? resolveSystemMode() : themeConfig.mode;
    const isLight = effectiveMode === "light";
    const activeColors = isLight ? themeConfig.lightTheme : themeConfig.darkTheme;

    root.style.setProperty("--bg-main", activeColors.bgColor);
    root.style.setProperty("--text-main", activeColors.fgColor);
    root.style.setProperty("--accent-color", activeColors.accentColor);
    root.style.setProperty("--bg-node", activeColors.nodeColor || (isLight ? "#ffffff" : "rgba(18, 18, 22, 0.97)"));

    if (isLight) {
      root.setAttribute("data-theme", "light");
      root.style.setProperty("--bg-panel", "#ffffff");
      root.style.setProperty("--bg-input", "#ffffff");
      root.style.setProperty("--bg-button", "#e9ecef");
      root.style.setProperty("--text-muted", "#6c757d");
      root.style.setProperty("--border-color", `${activeColors.accentColor}33`);
    } else {
      root.setAttribute("data-theme", "dark");
      root.style.setProperty("--bg-panel", "rgba(22, 22, 26, 0.96)");
      root.style.setProperty("--bg-input", "rgba(10, 10, 12, 0.88)");
      root.style.setProperty("--bg-button", "rgba(35, 36, 42, 0.92)");
      root.style.setProperty("--text-muted", "#94a3b8");
      root.style.setProperty("--border-color", `${activeColors.accentColor}44`);
    }

    try {
      localStorage.setItem("mimo_theme_settings", JSON.stringify(themeConfig));
    } catch { /* ignore */ }
  }, [themeConfig]);

  function updateMode(mode: ThemeConfig["mode"]) {
    setThemeConfig((prev) => ({ ...prev, mode }));
  }

  function updateLightThemePreset(preset: string) {
    if (preset === "custom") {
      setThemeConfig((prev) => ({ ...prev, lightTheme: { ...prev.lightTheme, preset: "custom" } }));
      return;
    }
    const p = lightPresets[preset];
    if (!p) return;
    setThemeConfig((prev) => ({
      ...prev,
      lightTheme: { preset, bgColor: p.bgColor, fgColor: p.fgColor, accentColor: p.accentColor, nodeColor: p.nodeColor }
    }));
  }

  function updateDarkThemePreset(preset: string) {
    if (preset === "custom") {
      setThemeConfig((prev) => ({ ...prev, darkTheme: { ...prev.darkTheme, preset: "custom" } }));
      return;
    }
    const p = darkPresets[preset];
    if (!p) return;
    setThemeConfig((prev) => ({
      ...prev,
      darkTheme: { preset, bgColor: p.bgColor, fgColor: p.fgColor, accentColor: p.accentColor, nodeColor: p.nodeColor }
    }));
  }

  function updateLightColor(field: "bgColor" | "fgColor" | "accentColor" | "nodeColor", val: string) {
    setThemeConfig((prev) => ({
      ...prev,
      lightTheme: { ...prev.lightTheme, preset: "custom", [field]: val }
    }));
  }

  function updateDarkColor(field: "bgColor" | "fgColor" | "accentColor" | "nodeColor", val: string) {
    setThemeConfig((prev) => ({
      ...prev,
      darkTheme: { ...prev.darkTheme, preset: "custom", [field]: val }
    }));
  }

  function resetLightPreset() {
    updateLightThemePreset("default");
  }

  function resetDarkPreset() {
    updateDarkThemePreset("default");
  }

  function updateBrandTitle(field: "brandTitleZh" | "brandTitleEn", val: string) {
    setThemeConfig((prev) => ({
      ...prev,
      [field]: val
    }));
  }

  function updateAutoHideTopbar(val: boolean) {
    setThemeConfig((prev) => ({
      ...prev,
      autoHideTopbar: val
    }));
    if (!val) {
      setTopbarCollapsed(false);
      if (topbarHoverTimerRef.current) {
        window.clearTimeout(topbarHoverTimerRef.current);
        topbarHoverTimerRef.current = null;
      }
    }
  }

  function resetTheme() {
    localStorage.removeItem("mimo_theme_settings");
    setThemeConfig({
      mode: "system",
      lightTheme: { preset: "default", ...lightPresets.default },
      darkTheme: { preset: "default", ...darkPresets.default },
      brandTitleZh: "铸光音频工作站",
      brandTitleEn: "ZHUGUANG AUDIO WORKSTATION",
      autoHideTopbar: true
    });
    setTopbarCollapsed(false);
  }

  const autoSaveKey = useMemo(() => {
    if (!activeWorkspace) return "";
    if (activeWorkspace.type === "audiobook") {
      return JSON.stringify({
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        novelText: activeWorkspace.novelText,
        characterHints: activeWorkspace.characterHints,
        characters: activeWorkspace.characters,
        segments: activeWorkspace.segments,
        products: activeWorkspace.products,
        phase: activeWorkspace.phase
      });
    }
    const nodeDataHash = nodes.map((n) => `${n.id}:${n.type}:${JSON.stringify(n.data)}`).join("|");
    const edgeDataHash = edges.map((e) => `${e.id}:${e.source}:${e.target}:${e.sourceHandle || ""}:${e.targetHandle || ""}`).join("|");
    return `${activeWorkspace.id}:${activeWorkspace.name}:${nodes.length}:${edges.length}:${nodeDataHash}:${edgeDataHash}:${activeWorkspace.stashItems?.length ?? 0}`;
  }, [activeWorkspace, nodes, edges]);

  useEffect(() => {
    void loadStatus();
    void loadApiSettings();
    void loadWorkspaceList();
    void loadStoragePathInfo();

    let collapseTimer: number | undefined;
    if (themeConfig.autoHideTopbar ?? true) {
      collapseTimer = window.setTimeout(() => {
        setTopbarCollapsed(true);
      }, 5000);
    }

    return () => {
      if (collapseTimer) {
        window.clearTimeout(collapseTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (themeConfig.autoHideTopbar === false) {
      setTopbarCollapsed(false);
      if (topbarHoverTimerRef.current) {
        window.clearTimeout(topbarHoverTimerRef.current);
        topbarHoverTimerRef.current = null;
      }
    }
  }, [themeConfig.autoHideTopbar]);

  useEffect(() => {
    function handleMouseMove(e: globalThis.MouseEvent) {
      if ((themeConfig.autoHideTopbar ?? true) && e.clientY < 20) {
        setTopbarCollapsed(false);
        if (topbarHoverTimerRef.current) {
          window.clearTimeout(topbarHoverTimerRef.current);
        }
      }
    }

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [themeConfig.autoHideTopbar]);

  useEffect(() => {
    function handleDragOver(e: globalThis.DragEvent) {
      e.preventDefault();
      if (!e.dataTransfer) return;

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const isOverInteractiveDropzone = el && Boolean(
        el.closest(".file-picker") ||
        el.closest(".reference-audio-card") ||
        el.closest(".node-audio") ||
        el.closest(".integrated-cell") ||
        el.closest(".integrated-ref-card") ||
        el.closest(".integrated-pipeline-row") ||
        el.closest(".batch-row-card") ||
        el.closest(".studio-node") ||
        el.closest(".modal-backdrop") ||
        el.closest(".excel-modal-content") ||
        el.closest(".integrated-multi-audio-card")
      );

      // If hovering over a node dropzone, disable global JSON overlay so the node receives drop cleanly
      if (isOverInteractiveDropzone) {
        setIsDraggingJson(false);
        e.dataTransfer.dropEffect = "copy";
        return;
      }

      // Check if dragged item is audio/video
      const files = Array.from(e.dataTransfer.files || []);
      const items = Array.from(e.dataTransfer.items || []);

      const isAudio =
        files.some(
          (f) =>
            f.type.startsWith("audio/") ||
            f.type.startsWith("video/") ||
            /\.(mp3|wav|m4a|aac|ogg|flac|mp4|wma)$/i.test(f.name)
        ) ||
        items.some(
          (item) =>
            item.kind === "file" &&
            (item.type.startsWith("audio/") || item.type.startsWith("video/"))
        );

      if (isAudio) {
        setIsDraggingJson(false);
        e.dataTransfer.dropEffect = "copy";
        return;
      }

      const hasFiles =
        (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) ||
        items.some((item) => item.kind === "file");

      if (hasFiles) {
        e.dataTransfer.dropEffect = "copy";
        setIsDraggingJson(true);
      }
    }

    function handleDragLeave(e: globalThis.DragEvent) {
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setIsDraggingJson(false);
      }
    }

    async function handleDrop(e: globalThis.DragEvent) {
      setIsDraggingJson(false);

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const isOverInteractiveDropzone = el && Boolean(
        el.closest(".file-picker") ||
        el.closest(".reference-audio-card") ||
        el.closest(".node-audio") ||
        el.closest(".integrated-cell") ||
        el.closest(".integrated-ref-card") ||
        el.closest(".integrated-pipeline-row") ||
        el.closest(".batch-row-card") ||
        el.closest(".studio-node") ||
        el.closest(".modal-backdrop") ||
        el.closest(".excel-modal-content") ||
        el.closest(".integrated-multi-audio-card")
      );

      if (isOverInteractiveDropzone) {
        // Child dropzone handles file directly
        return;
      }

      e.preventDefault();
      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) {
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      const jsonFiles = files.filter(
        (f) => f.name.toLowerCase().endsWith(".json") || f.type === "application/json"
      );
      if (jsonFiles.length === 0) return;
      for (const file of files) {
        try {
          const text = await file.text();
          let rawData: unknown;
          try {
            rawData = JSON.parse(text);
          } catch {
            continue;
          }

          if (!rawData || typeof rawData !== "object") continue;

          const res = await fetch("/api/workspaces/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rawData)
          });

          if (res.ok) {
            const imported = await res.json();
            await loadWorkspaceList();
            if (imported && imported.id) {
              await loadWorkspace(imported.id);
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            alert(`导入画板文件 [${file.name}] 失败：${errData.error || "数据结构不符合规范"}`);
          }
        } catch (err) {
          alert(`读取/导入文件 [${file.name}] 失败：` + (err instanceof Error ? err.message : String(err)));
        }
      }
    }

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const prevCountsRef = useRef({ nodeCount: nodes.length, edgeCount: edges.length });
  const maxSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    const hasCountChanged =
      prevCountsRef.current.nodeCount !== nodes.length ||
      prevCountsRef.current.edgeCount !== edges.length;

    prevCountsRef.current = { nodeCount: nodes.length, edgeCount: edges.length };

    const delay = hasCountChanged ? 200 : 800;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      if (maxSaveTimerRef.current) {
        window.clearTimeout(maxSaveTimerRef.current);
        maxSaveTimerRef.current = null;
      }
      void saveWorkspace();
    }, delay);

    if (!maxSaveTimerRef.current) {
      maxSaveTimerRef.current = window.setTimeout(() => {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        maxSaveTimerRef.current = null;
        void saveWorkspace();
      }, 2000);
    }

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [autoSaveKey]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void saveWorkspace();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        void saveWorkspace();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.type !== "board") return;
    const currentId = activeWorkspace.id;
    const curNodesCount = nodes.length;
    const curEdgesCount = edges.length;
    const curStashCount = activeWorkspace.stashItems?.length ?? 0;
    const curName = activeWorkspace.name;

    setWorkspaces((items) =>
      items.map((item) =>
        item.id === currentId
          ? {
            ...item,
            name: curName,
            nodeCount: curNodesCount,
            edgeCount: curEdgesCount,
            stashCount: curStashCount
          }
          : item
      )
    );
  }, [
    activeWorkspace?.id,
    activeWorkspace?.name,
    activeWorkspace?.type === "board" ? activeWorkspace.stashItems?.length : 0,
    nodes.length,
    edges.length
  ]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const activeWorkspaceRef = useRef(activeWorkspace);
  activeWorkspaceRef.current = activeWorkspace;

  const patchNode = useCallback(
    (nodeId: string, patch: Partial<NodeData>) => {
      const currentNodes = nodesRef.current;
      const targetNode = currentNodes.find((n) => n.id === nodeId);

      setNodes((items) =>
        items.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node))
      );

      if (!targetNode) return;

      const oldTitle = targetNode.data.title;
      const newTitle = patch.title;
      const newBatchRows = patch.batchRows;

      // 1) When node title changes:
      if (newTitle !== undefined && newTitle !== oldTitle) {
        const isGeneratorNode =
          targetNode.type === "referenceAudio" ||
          targetNode.type === "voiceClone" ||
          targetNode.type === "voiceDesign" ||
          targetNode.type === "batchVoiceClone" ||
          targetNode.type === "batchVoiceDesign" ||
          targetNode.type === "integratedStudio";

        // Handle direct title edit on an artifact node (renaming an artifact node ONLY renames itself & its own stash item)
        if (targetNode.type === "artifact" && targetNode.data.artifact) {
          patch.artifact = {
            ...targetNode.data.artifact,
            sourceNodeName: newTitle,
            sourceNodeId: targetNode.id
          };

          // Update ONLY the stash item corresponding to this specific artifact node ID
          setActiveWorkspace((workspace) => {
            if (!workspace || workspace.type !== "board") return workspace;
            const currentStash = workspace.stashItems ?? [];
            if (currentStash.length === 0) return workspace;

            return {
              ...workspace,
              stashItems: currentStash.map((s) => (s.sourceNodeId === nodeId ? { ...s, sourceNodeName: newTitle } : s))
            };
          });
        }

        // Only Generator nodes cascade down to downstream child nodes and stash items
        if (isGeneratorNode) {
          const currentEdges = edgesRef.current;
          const downstreamChildNodeIds = new Set<string>();
          const queue = [nodeId];
          while (queue.length > 0) {
            const curr = queue.shift()!;
            currentEdges.forEach((e) => {
              if (e.source === curr && !downstreamChildNodeIds.has(e.target)) {
                downstreamChildNodeIds.add(e.target);
                queue.push(e.target);
              }
            });
          }

          setNodes((items) => {
            return items.map((node) => {
              if (downstreamChildNodeIds.has(node.id)) {
                if (
                  (node.type === "voiceClone" || node.type === "voiceDesign" || node.type === "batchVoiceClone") &&
                  (oldTitle ? node.data.title === oldTitle || node.data.title === "音频克隆" || node.data.title === "音色创造" : true)
                ) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      title: newTitle
                    }
                  };
                }
                if (node.type === "artifact" && node.data.artifact) {
                  const updatedArtifactTitle = formatHierarchyName(newTitle, node.data.title !== oldTitle ? node.data.title : undefined, 1);
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      title: updatedArtifactTitle,
                      artifact: {
                        ...node.data.artifact,
                        sourceNodeName: updatedArtifactTitle,
                        sourceNodeId: node.id
                      }
                    }
                  };
                }
                if (node.type === "batchArtifact") {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      parentTitle: newTitle
                    }
                  };
                }
              }
              return node;
            });
          });

          // Dynamically update ONLY stash items originating from this generator node or its downstream child nodes
          setActiveWorkspace((workspace) => {
            if (!workspace || workspace.type !== "board") return workspace;
            const currentStash = workspace.stashItems ?? [];
            if (currentStash.length === 0) return workspace;

            const updatedStash = currentStash.map((stashItem) => {
              const isFromThisNode =
                stashItem.sourceNodeId === nodeId ||
                (stashItem.sourceNodeId !== undefined && downstreamChildNodeIds.has(stashItem.sourceNodeId));

              if (isFromThisNode) {
                let updatedName = stashItem.sourceNodeName;
                if (oldTitle && stashItem.sourceNodeName.startsWith(`${oldTitle}_`)) {
                  updatedName = formatHierarchyName(newTitle, stashItem.sourceNodeName.slice(oldTitle.length + 1));
                } else if (oldTitle && stashItem.sourceNodeName.startsWith(`${oldTitle} - `)) {
                  updatedName = formatHierarchyName(newTitle, stashItem.sourceNodeName.slice(oldTitle.length + 3));
                } else if (oldTitle && stashItem.sourceNodeName === oldTitle) {
                  updatedName = formatHierarchyName(newTitle, "", 1);
                }
                return {
                  ...stashItem,
                  sourceNodeName: updatedName
                };
              }
              return stashItem;
            });

            return {
              ...workspace,
              stashItems: updatedStash
            };
          });
        }
      }

      // 2) When row titles inside batchRows change:
      if (newBatchRows && Array.isArray(newBatchRows)) {
        const oldRows = targetNode.data.batchRows || [];
        const rowTitleMap = new Map<string, { oldTitle: string; newTitle: string }>();
        newBatchRows.forEach((r) => {
          const oldR = oldRows.find((o) => o.id === r.id);
          if (oldR && oldR.title !== r.title) {
            rowTitleMap.set(r.id, { oldTitle: oldR.title, newTitle: r.title });
          }
        });

        if (rowTitleMap.size > 0) {
          // Update connected downstream BatchArtifactNodes
          setNodes((items) => {
            return items.map((node) => {
              if (node.type === "batchArtifact" && node.data.batchRowId && rowTitleMap.has(node.data.batchRowId)) {
                const { newTitle: rNew } = rowTitleMap.get(node.data.batchRowId)!;
                return {
                  ...node,
                  data: {
                    ...node.data,
                    title: rNew
                  }
                };
              }
              return node;
            });
          });

          // Update stashItems matching modified row titles
          setActiveWorkspace((workspace) => {
            if (!workspace || workspace.type !== "board") return workspace;
            const currentStash = workspace.stashItems ?? [];
            if (currentStash.length === 0) return workspace;

            const updatedStash = currentStash.map((stashItem) => {
              if (stashItem.sourceRowId && rowTitleMap.has(stashItem.sourceRowId)) {
                const { oldTitle: rOld, newTitle: rNew } = rowTitleMap.get(stashItem.sourceRowId)!;
                let updatedName = stashItem.sourceNodeName;
                if (rOld && updatedName.includes(`_${rOld}_`)) {
                  updatedName = updatedName.replaceAll(`_${rOld}_`, `_${rNew}_`);
                } else if (rOld && updatedName.endsWith(`_${rOld}`)) {
                  updatedName = `${updatedName.slice(0, -rOld.length)}${rNew}`;
                } else {
                  const parts = updatedName.split("_");
                  const idx = parts.indexOf(rOld);
                  if (idx >= 0) {
                    parts[idx] = rNew;
                    updatedName = parts.join("_");
                  }
                }
                return {
                  ...stashItem,
                  sourceNodeName: updatedName
                };
              }
              return stashItem;
            });

            return {
              ...workspace,
              stashItems: updatedStash
            };
          });
        }
      }
    },
    [setNodes, setActiveWorkspace]
  );

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((items) => items.filter((node) => node.id !== nodeId));
    setEdges((items) => items.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((items) => items.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  const isArtifactStashed = useCallback((artifact: ArtifactData) => {
    const ws = activeWorkspaceRef.current;
    if (!ws || ws.type !== "board") return false;
    const items = ws.stashItems ?? [];
    return items.some((item) => item.fileName === artifact.fileName && item.audioDataUrl === artifact.audioDataUrl);
  }, []);

  const createReferenceAudioFromData = useCallback((title: string, audioAsset: AudioAsset) => {
    if (!activeWorkspaceRef.current || activeWorkspaceRef.current.type !== "board") return;
    const newId = createId("referenceAudio");
    const currentNodes = nodesRef.current;
    const newNode: StudioNode = {
      id: newId,
      type: "referenceAudio",
      position: { x: 120, y: 120 + (currentNodes.length % 8) * 50 },
      data: {
        title: `${title}_参考`,
        audio: audioAsset
      }
    };
    setNodes((items) => items.concat(newNode));
    window.setTimeout(() => void saveWorkspace(), 100);
  }, [setNodes]);

  const nodeCallbacks = useMemo(
    () => ({
      workspaceName: activeWorkspace?.name,
      onPatch: patchNode,
      onDelete: deleteNode,
      onRunClone: runVoiceClone,
      onRunBatchVoiceClone: runBatchVoiceClone,
      onRunSingleRowBatchVoiceClone: runSingleRowBatchVoiceClone,
      onRunBatchVoiceDesign: runBatchVoiceDesign,
      onRunSingleRowBatchVoiceDesign: runSingleRowBatchVoiceDesign,
      onRunIntegratedBatch: runIntegratedBatch,
      onRunIntegratedSingleRow: runIntegratedSingleRow,
      onDeleteIntegratedArtifactItem: deleteIntegratedArtifactItem,
      onDeleteBatchArtifactItem: deleteBatchArtifactItem,
      onRunVoiceDesign: runVoiceDesign,
      onOptimizeStyle: optimizeVoiceStyle,
      onOptimizeVoiceDesign: optimizeVoiceDesign,
      onStashArtifact: stashArtifact,
      onToggleStashArtifact: toggleStashArtifact,
      onRunAudioMerge: runAudioMerge,
      onCreateReferenceFromAudio: createReferenceAudioFromData,
      isArtifactStashed
    }),
    [apiKey, activeWorkspace?.name, activeWorkspace?.type === "board" ? activeWorkspace.stashItems?.length : 0, patchNode, deleteNode, isArtifactStashed, createReferenceAudioFromData]
  );

  const nodeDataCache = useRef<Map<string, { rawNodeData: unknown; callbacks: unknown; resultNode: StudioNode }>>(new Map());

  const hydratedNodes = useMemo(() => {
    const cache = nodeDataCache.current;
    return nodes.map((rawNode) => {
      const cached = cache.get(rawNode.id);
      if (cached && cached.rawNodeData === rawNode.data && cached.callbacks === nodeCallbacks) {
        if (
          cached.resultNode.position.x === rawNode.position.x &&
          cached.resultNode.position.y === rawNode.position.y &&
          cached.resultNode.selected === rawNode.selected &&
          cached.resultNode.dragging === rawNode.dragging &&
          cached.resultNode.measured?.width === rawNode.measured?.width &&
          cached.resultNode.measured?.height === rawNode.measured?.height &&
          cached.resultNode.width === rawNode.width &&
          cached.resultNode.height === rawNode.height
        ) {
          return cached.resultNode;
        }
        cached.resultNode = {
          ...rawNode,
          data: cached.resultNode.data
        };
        return cached.resultNode;
      }
      const newResultData = {
        ...rawNode.data,
        ...nodeCallbacks
      };
      const resultNode: StudioNode = {
        ...rawNode,
        data: newResultData
      };
      cache.set(rawNode.id, { rawNodeData: rawNode.data, callbacks: nodeCallbacks, resultNode });
      return resultNode;
    });
  }, [nodes, nodeCallbacks]);

  const edgeDataCache = useRef<Map<string, { rawEdge: StudioEdge; onDelete: unknown; resultEdge: StudioEdge }>>(new Map());

  const hydratedEdges = useMemo(() => {
    const cache = edgeDataCache.current;
    const currentNodes = nodesRef.current;
    return edges.map((edge) => {
      const cached = cache.get(edge.id);
      if (cached && cached.rawEdge === edge && cached.onDelete === deleteEdge) {
        return cached.resultEdge;
      }
      const sourceNode = currentNodes.find((n) => n.id === edge.source);
      const strokeColor = edge.style?.stroke || (sourceNode?.type && NODE_COLOR_MAP[sourceNode.type]) || "#c5a45d";
      const newResultData = {
        ...edge.data,
        onDeleteEdge: deleteEdge
      };
      const resultEdge: StudioEdge = {
        ...edge,
        type: "deletable",
        style: { strokeWidth: 2, ...edge.style, stroke: strokeColor },
        data: newResultData
      };
      cache.set(edge.id, { rawEdge: edge, onDelete: deleteEdge, resultEdge });
      return resultEdge;
    });
  }, [edges, deleteEdge]);

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      referenceAudio: ReferenceAudioNode,
      audioMerge: AudioMergeNode,
      voiceStyle: VoiceStyleNode,
      prompt: PromptNode,
      voiceClone: VoiceCloneNode,
      voiceDesign: VoiceDesignNode,
      artifact: ArtifactNode,
      batchVoiceClone: BatchVoiceCloneNode,
      batchVoiceDesign: BatchVoiceDesignNode,
      batchArtifact: BatchArtifactNode,
      integratedStudio: IntegratedStudioNode,
      comment: CommentNode
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      deletable: DeletableEdge
    }),
    []
  );

  async function loadStatus() {
    try {
      setStatusError(null);
      const response = await fetch("/api/status");
      if (!response.ok) {
        throw new Error(`状态检查失败：HTTP ${response.status}`);
      }
      setStatus((await response.json()) as StatusResponse);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "状态检查失败");
    }
  }

  async function loadApiSettings() {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error(`API 配置加载失败：HTTP ${response.status}`);
      }

      const settings = (await response.json()) as ApiSettingsResponse;
      const localKey = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
      const localEndpoint = localStorage.getItem(API_ENDPOINT_STORAGE_KEY) || "";
      const localProvider = localStorage.getItem(API_PROVIDER_STORAGE_KEY) || "";
      const nextKey = settings.apiKey || localKey || DEFAULT_API_KEY;
      const nextEndpoint = settings.apiEndpoint || localEndpoint || DEFAULT_API_ENDPOINT;
      const nextProvider = settings.apiProvider || localProvider || "mimo";

      setApiKey(nextKey);
      setApiEndpoint(nextEndpoint);
      setApiProvider(nextProvider);
      setApiKeyInput(nextKey);
      setApiEndpointInput(nextEndpoint);
      setApiProviderInput(nextProvider);

      if (!settings.configured && localKey) {
        void persistApiSettings(localKey, localEndpoint || nextEndpoint, localProvider || nextProvider);
        return;
      }

      if (!settings.configured && !localKey) {
        setShowApiKeyModal(true);
      }
    } catch (error) {
      console.warn("[settings] failed to load API settings", error);
      if (!localStorage.getItem(API_KEY_STORAGE_KEY)) {
        setShowApiKeyModal(true);
      }
    }
  }

  function saveApiKey() {
    const trimmedKey = apiKeyInput.trim();
    const trimmedEndpoint = apiEndpointInput.trim();
    const trimmedProvider = apiProviderInput.trim() || "mimo";
    if (!trimmedKey) return;
    setApiKey(trimmedKey);
    setApiProvider(trimmedProvider);
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
    localStorage.setItem(API_PROVIDER_STORAGE_KEY, trimmedProvider);
    if (trimmedEndpoint) {
      setApiEndpoint(trimmedEndpoint);
      localStorage.setItem(API_ENDPOINT_STORAGE_KEY, trimmedEndpoint);
    } else {
      const selectedPreset = API_PROVIDERS.find((p) => p.id === trimmedProvider);
      const fallbackEndpoint = selectedPreset?.endpoint || DEFAULT_API_ENDPOINT;
      setApiEndpoint(fallbackEndpoint);
      localStorage.removeItem(API_ENDPOINT_STORAGE_KEY);
    }
    void persistApiSettings(trimmedKey, trimmedEndpoint || DEFAULT_API_ENDPOINT, trimmedProvider);
    closeApiKeyModal();
    void loadStatus();
  }

  async function persistApiSettings(apiKey: string, apiEndpoint: string, apiProvider?: string) {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiEndpoint, apiProvider: apiProvider || "mimo" })
      });
    } catch (error) {
      console.warn("[settings] failed to persist API settings", error);
    }
  }

  function openApiKeyModal() {
    setApiKeyInput(apiKey);
    setApiEndpointInput(apiEndpoint);
    setApiProviderInput(apiProvider);
    setShowApiKeyModal(true);
  }

  function closeApiKeyModal() {
    setShowApiKeyModal(false);
    if (themeConfig.autoHideTopbar ?? true) {
      topbarHoverTimerRef.current = window.setTimeout(() => setTopbarCollapsed(true), 3000);
    }
  }

  async function loadWorkspaceList(preferredId?: string) {
    try {
      const response = await fetch("/api/workspaces");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as WorkspacesResponse;
      const workspaceItems = Array.isArray(payload.workspaces) ? payload.workspaces : [];
      setWorkspaces(workspaceItems);

      // 当画板库没有任何画板时，清空画布状态与节点，静默不报错
      if (workspaceItems.length === 0) {
        setActiveWorkspace(null);
        setNodes([]);
        setEdges([]);
        return;
      }

      if (preferredId && workspaceItems.some((w) => w.id === preferredId)) {
        await loadWorkspace(preferredId);
      } else {
        const targetId = (payload.activeWorkspaceId && workspaceItems.some((w) => w.id === payload.activeWorkspaceId))
          ? payload.activeWorkspaceId
          : workspaceItems[0]?.id;
        if (targetId) {
          await loadWorkspace(targetId);
        } else {
          setActiveWorkspace(null);
          setNodes([]);
          setEdges([]);
        }
      }
    } catch (err) {
      console.warn("加载画板列表失败:", err);
    }
  }

  async function loadWorkspace(id: string) {
    if (!id) {
      setActiveWorkspace(null);
      setNodes([]);
      setEdges([]);
      return;
    }

    if (activeWorkspaceRef.current && activeWorkspaceRef.current.id !== id) {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (maxSaveTimerRef.current) {
        window.clearTimeout(maxSaveTimerRef.current);
        maxSaveTimerRef.current = null;
      }
      void saveWorkspace().catch((err) => {
        console.warn("切换画板前保存失败:", err);
      });
    }

    // Clear caches and undo/redo stacks when loading a new workspace to free RAM
    nodeDataCache.current.clear();
    edgeDataCache.current.clear();
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastRecordedRef.current = "";

    try {
      const response = await fetch(`/api/workspaces/${id}`);
      if (!response.ok) {
        // 如果画板不存在（比如刚被删除），清空画布，不弹窗报错
        if (response.status === 404) {
          setActiveWorkspace(null);
          setNodes([]);
          setEdges([]);
          return;
        }
        console.warn(`加载画板失败：HTTP ${response.status}`);
        return;
      }
      const workspace = (await response.json()) as WorkspacePayload;
      setActiveWorkspace(workspace);
      if (workspace.type === "board") {
        const boardNodes = workspace.nodes ?? [];
        const boardEdges = workspace.edges ?? [];
        const normalizedNodes = boardNodes.map((n) => ensureArtifactSeqIndexes(n, boardNodes, boardEdges));
        setNodes(normalizedNodes);
        setEdges(boardEdges);
        window.setTimeout(() => {
          flowRef.current?.fitView({ padding: 0.25, duration: 400 });
        }, 60);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.warn("加载画板异常:", err);
      setActiveWorkspace(null);
      setNodes([]);
      setEdges([]);
    }
  }

  async function createWorkspace() {
    const initialNodes = !activeWorkspaceRef.current && nodesRef.current.length > 0 ? nodesRef.current : [];
    const initialEdges = !activeWorkspaceRef.current && edgesRef.current.length > 0 ? edgesRef.current : [];

    if (activeWorkspaceRef.current) {
      void saveWorkspace().catch(() => {});
      nodeDataCache.current.clear();
      edgeDataCache.current.clear();
      undoStackRef.current = [];
      redoStackRef.current = [];
      lastRecordedRef.current = "";
    }

    const name = `新画板 ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nodes: initialNodes, edges: initialEdges, stashItems: [] })
    });
    if (!response.ok) {
      throw new Error(`创建画板失败：HTTP ${response.status}`);
    }
    const workspace = (await response.json()) as WorkspacePayload;
    setActiveWorkspace(workspace);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setWorkspaces((items) => [
      {
        id: workspace.id,
        type: "board",
        name: workspace.name,
        nodeCount: initialNodes.length,
        edgeCount: initialEdges.length,
        stashCount: 0,
        updatedAt: workspace.updatedAt,
        createdAt: workspace.createdAt
      },
      ...items.filter((w) => w.id !== workspace.id)
    ]);
    if (initialNodes.length > 0) {
      window.setTimeout(() => {
        flowRef.current?.fitView({ padding: 0.25, duration: 400 });
      }, 60);
    }
  }

  async function createSmartWorkspace(formData: FormData) {
    const response = await fetch("/api/workspaces/smart", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
      body: formData
    });
    const workspace = (await response.json()) as WorkspacePayload & { error?: string };
    if (!response.ok) {
      throw new Error(workspace.error || `智能画板生成失败：HTTP ${response.status}`);
    }
    await loadWorkspaceList(workspace.id);
  }

  async function createAudiobookWorkspace(data: { novelText: string; characterHints: string; name?: string }) {
    const response = await fetch("/api/audiobook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
      body: JSON.stringify(data)
    });
    const workspace = (await response.json()) as AudiobookWorkspacePayload & { error?: string };
    if (!response.ok) {
      throw new Error(workspace.error || "创建有声书失败");
    }
    await loadWorkspaceList(workspace.id);
  }

  function patchAudiobook(patch: Partial<AudiobookWorkspacePayload>) {
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook") return workspace;
      return { ...workspace, ...patch } as AudiobookWorkspacePayload;
    });
  }

  async function addAudiobookChapter(data: { title: string; novelText: string; characterHints: string }) {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
      body: JSON.stringify(data)
    });
    const result = (await response.json()) as { workspace?: AudiobookWorkspacePayload; error?: string };
    if (!response.ok || !result.workspace) {
      throw new Error(result.error || "新增章节失败");
    }
    setActiveWorkspace(result.workspace);
  }

  async function activateAudiobookChapter(chapterId: string) {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/chapters/${chapterId}/activate`, {
      method: "POST"
    });
    const result = (await response.json()) as { workspace?: AudiobookWorkspacePayload; error?: string };
    if (!response.ok || !result.workspace) {
      throw new Error(result.error || "切换章节失败");
    }
    setActiveWorkspace(result.workspace);
  }

  async function createAudiobookCharacter(formData: FormData) {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/characters`, {
      method: "POST",
      body: formData
    });
    const result = (await response.json()) as { characters?: AudiobookCharacter[]; chapter?: AudiobookChapter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "创建音色角色失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return { ...workspace, characters: result.characters ?? workspace.characters };
    });
  }

  async function analyzeAudiobookCharacters() {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/characters/analyze`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint }
    });
    const result = (await response.json()) as { characters?: AudiobookCharacter[]; chapter?: AudiobookChapter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "角色分析失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      if (!result.chapter) {
        return { ...workspace, characters: result.characters ?? [] };
      }
      return {
        ...workspace,
        characters: result.characters ?? workspace.characters,
        chapters: workspace.chapters.map((chapter) => (chapter.id === result.chapter!.id ? result.chapter! : chapter)),
        activeChapterId: result.chapter.id,
        novelText: result.chapter.novelText,
        characterHints: result.chapter.characterHints,
        segments: result.chapter.segments,
        products: result.chapter.products,
        phase: result.chapter.phase
      };
    });
  }

  async function generateCharacterVoice(charId: string) {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        characters: workspace.characters.map((c) =>
          c.id === charId ? { ...c, voiceStatus: "generating" as AudiobookCharacter["voiceStatus"], voiceError: undefined } : c
        )
      };
    });
    const response = await fetch(`/api/audiobook/${workspaceId}/characters/${charId}/voice`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint }
    });
    const result = (await response.json()) as { character?: AudiobookCharacter; error?: string };
    if (!response.ok) {
      setActiveWorkspace((workspace) => {
        if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
        return {
          ...workspace,
          characters: workspace.characters.map((c) =>
            c.id === charId ? { ...c, voiceStatus: "error" as AudiobookCharacter["voiceStatus"], voiceError: result.error || "生成失败" } : c
          )
        };
      });
      return;
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        characters: workspace.characters.map((c) => (c.id === charId ? result.character! : c))
      };
    });
  }

  async function deleteCharacterVoice(charId: string) {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/characters/${charId}/voice`, {
      method: "DELETE"
    });
    const result = (await response.json()) as { character?: AudiobookCharacter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "删除音色失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        characters: workspace.characters.map((c) => (c.id === charId ? result.character! : c))
      };
    });
  }

  async function autoAnnotateAudiobook() {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/annotate`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint }
    });
    const result = (await response.json()) as { segments?: AudiobookSegment[]; chapter?: AudiobookChapter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "自动标注失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      if (result.chapter) {
        return {
          ...workspace,
          chapters: workspace.chapters.map((chapter) => (chapter.id === result.chapter!.id ? result.chapter! : chapter)),
          activeChapterId: result.chapter.id,
          segments: result.chapter.segments,
          products: result.chapter.products,
          phase: result.chapter.phase
        };
      }
      return { ...workspace, segments: result.segments ?? [], phase: "annotation" };
    });
  }

  async function updateAudiobookSegment(segId: string, patch: { characterId: string | null; characterName: string; emotion: string }) {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const response = await fetch(`/api/audiobook/${activeWorkspace.id}/segments/${segId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const result = (await response.json()) as { segment?: AudiobookSegment; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "标注失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== activeWorkspace.id) return workspace;
      return {
        ...workspace,
        segments: workspace.segments.map((s) => (s.id === segId ? result.segment! : s)),
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId
            ? { ...chapter, segments: chapter.segments.map((s) => (s.id === segId ? result.segment! : s)) }
            : chapter
        )
      };
    });
  }

  async function generateAudiobookAudio() {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        phase: "generation",
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId ? { ...chapter, phase: "generation" } : chapter
        )
      };
    });
    const response = await fetch(`/api/audiobook/${workspaceId}/generate`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint }
    });
    const result = (await response.json()) as { products?: AudiobookProduct[]; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "生成失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        products: result.products ?? [],
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId ? { ...chapter, products: result.products ?? [] } : chapter
        )
      };
    });
    await pollAudiobookGeneration(workspaceId);
  }

  async function retryAudiobookProduct(productId: string) {
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        products: workspace.products.map((product) =>
          product.id === productId
            ? { ...product, status: "generating" as AudiobookProduct["status"], audioDataUrl: null, error: undefined, elapsedMs: undefined }
            : product
        ),
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId
            ? {
              ...chapter,
              products: chapter.products.map((product) =>
                product.id === productId
                  ? { ...product, status: "generating" as AudiobookProduct["status"], audioDataUrl: null, error: undefined, elapsedMs: undefined }
                  : product
              )
            }
            : chapter
        )
      };
    });

    const response = await fetch(`/api/audiobook/${workspaceId}/products/${productId}/retry`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint }
    });
    const result = (await response.json()) as { product?: AudiobookProduct; error?: string };
    if (result.product) {
      setActiveWorkspace((workspace) => {
        if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
        return {
          ...workspace,
          products: workspace.products.map((product) => (product.id === productId ? result.product! : product)),
          chapters: workspace.chapters.map((chapter) =>
            chapter.id === workspace.activeChapterId
              ? { ...chapter, products: chapter.products.map((product) => (product.id === productId ? result.product! : product)) }
              : chapter
          )
        };
      });
    }
    if (!response.ok && !result.product) {
      throw new Error(result.error || "重试生成失败");
    }
  }

  async function pollAudiobookGeneration(workspaceId: string) {
    for (let attempt = 0; attempt < 240; attempt++) {
      await wait(1500);
      const response = await fetch(`/api/workspaces/${workspaceId}`);
      if (!response.ok) {
        throw new Error(`刷新有声书生成进度失败：HTTP ${response.status}`);
      }

      const workspace = (await response.json()) as WorkspacePayload;
      if (workspace.type !== "audiobook") {
        throw new Error("工作区类型异常");
      }

      setActiveWorkspace((current) => {
        if (!current || current.type !== "audiobook" || current.id !== workspaceId) return current;
        return workspace;
      });

      if (!workspace.products.some((product) => product.status === "pending" || product.status === "generating")) {
        return;
      }
    }

    throw new Error("有声书生成仍在进行中，请稍后刷新查看结果。");
  }

  function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function executeDeleteWorkspace(workspaceId: string) {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxSaveTimerRef.current) {
      window.clearTimeout(maxSaveTimerRef.current);
      maxSaveTimerRef.current = null;
    }

    try {
      await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    } catch (err) {
      console.warn("删除画板失败:", err);
    }
    setActiveWorkspace(null);
    setNodes([]);
    setEdges([]);
    await loadWorkspaceList();
  }

  function promptDeleteCurrentWorkspace() {
    if (!activeWorkspace) return;
    setDeleteModalState({
      isOpen: true,
      title: "删除画板",
      message: `确定要删除「${activeWorkspace.name}」吗？删除后不可恢复。`,
      confirmLabel: "确定删除",
      onConfirm: async () => {
        setDeleteModalState((s) => ({ ...s, isOpen: false }));
        await executeDeleteWorkspace(activeWorkspace.id);
      }
    });
  }

  function openSaveAsModal(target?: WorkspaceSummary) {
    if (target) {
      setSaveAsTargetWorkspace(target);
    } else if (activeWorkspace) {
      setSaveAsTargetWorkspace({
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        type: activeWorkspace.type,
        createdAt: activeWorkspace.createdAt,
        updatedAt: activeWorkspace.updatedAt
      });
    }
  }

  async function duplicateWorkspaceById(id: string, customName?: string) {
    if (activeWorkspace && activeWorkspace.id === id) {
      await saveWorkspace();
    }

    const response = await fetch(`/api/workspaces/${id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: customName })
    });

    const data = (await response.json()) as WorkspacePayload & { error?: string };
    if (!response.ok) {
      throw new Error(data.error || `另存为失败：HTTP ${response.status}`);
    }

    await loadWorkspaceList(data.id);
  }

  async function exportWorkspace(id?: string) {
    const targetId = id || activeWorkspace?.id;
    if (!targetId) return;

    if (activeWorkspace && activeWorkspace.id === targetId) {
      await saveWorkspace();
    }

    const response = await fetch(`/api/workspaces/${targetId}`);
    if (!response.ok) {
      alert("导出失败");
      return;
    }
    const workspace = (await response.json()) as WorkspacePayload;
    const jsonStr = JSON.stringify(workspace, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFileName(workspace.name || "workspace");
    link.download = `${safeName}_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportWorkspaceAsTemplate(id?: string) {
    const targetId = id || activeWorkspace?.id;
    if (!targetId) return;

    if (activeWorkspace && activeWorkspace.id === targetId) {
      await saveWorkspace();
    }

    const response = await fetch(`/api/workspaces/${targetId}`);
    if (!response.ok) {
      alert("导出模板失败");
      return;
    }
    const workspace = (await response.json()) as WorkspacePayload;

    if (workspace.type === "board" && workspace.nodes) {
      workspace.nodes = workspace.nodes.map((n) => {
        const copyData = { ...n.data };
        delete copyData.artifact;
        delete copyData.batchArtifacts;
        delete copyData.singleRunningRowId;
        delete copyData.error;
        delete copyData.isRunning;
        return { ...n, data: copyData };
      });
    }

    const templatePayload = {
      ...workspace,
      name: `${workspace.name} 模板`,
      isTemplate: true
    };

    const jsonStr = JSON.stringify(templatePayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFileName(workspace.name || "workspace");
    link.download = `${safeName}_模板_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspaceFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const response = await fetch("/api/workspaces/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json)
      });
      const imported = (await response.json()) as WorkspacePayload & { error?: string };
      if (!response.ok) {
        throw new Error(imported.error || "导入画板失败");
      }
      await loadWorkspaceList(imported.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "无法解析并导入画板文件");
    }
  }

  async function saveWorkspaceAsTemplate(name: string, description: string) {
    if (!saveAsTemplateWorkspace) return;
    if (activeWorkspace && activeWorkspace.id === saveAsTemplateWorkspace.id) {
      await saveWorkspace();
    }

    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: saveAsTemplateWorkspace.id, name, description })
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(result.error || "保存为模板失败");
    }
  }

  async function saveWorkspace() {
    const currentWorkspace = activeWorkspaceRef.current;
    if (!currentWorkspace) {
      return;
    }

    setIsSaving(true);
    try {
      let body: Record<string, unknown>;
      if (currentWorkspace.type === "audiobook") {
        body = {
          name: currentWorkspace.name,
          activeChapterId: currentWorkspace.activeChapterId,
          novelText: currentWorkspace.novelText,
          characterHints: currentWorkspace.characterHints,
          characters: currentWorkspace.characters,
          segments: currentWorkspace.segments,
          products: currentWorkspace.products,
          chapters: currentWorkspace.chapters,
          phase: currentWorkspace.phase,
          baseUpdatedAt: currentWorkspace.updatedAt
        };
      } else {
        const cleanNodes = nodesRef.current.map(stripNodeCallbacks);
        body = {
          name: currentWorkspace.name,
          nodes: cleanNodes,
          edges: edgesRef.current,
          stashItems: currentWorkspace.stashItems ?? []
        };
      }

      const response = await fetch(`/api/workspaces/${currentWorkspace.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const saved = (await response.json()) as WorkspacePayload & { error?: string };
      if (!response.ok) {
        throw new Error(saved.error || `保存失败：HTTP ${response.status}`);
      }
      setActiveWorkspace((current) => {
        if (!current || current.id !== saved.id) return current;
        return {
          ...current,
          updatedAt: saved.updatedAt
        };
      });
      setWorkspaces((items) =>
        items.map((item) =>
          item.id === saved.id
            ? {
              ...item,
              name: currentWorkspace.name,
              nodeCount: nodesRef.current.length,
              edgeCount: edgesRef.current.length,
              stashCount: currentWorkspace.type === "board" ? currentWorkspace.stashItems?.length ?? 0 : 0,
              updatedAt: saved.updatedAt
            }
            : item
        )
      );
    } finally {
      setIsSaving(false);
    }
  }

  function patchWorkspaceName(name: string) {
    const trimmed = name;
    setActiveWorkspace((workspace) => (workspace ? { ...workspace, name: trimmed } : workspace));
    setWorkspaces((items) =>
      items.map((item) => (item.id === activeWorkspaceRef.current?.id ? { ...item, name: trimmed } : item))
    );
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveWorkspace();
    }, 400);
  }

  function stashArtifact(artifact: ArtifactData) {
    if (!activeWorkspace || isArtifactStashed(artifact)) {
      return;
    }

    const item: StashItem = {
      id: createId("stash"),
      ...artifact
    };
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "board") return workspace;
      return { ...workspace, stashItems: [item, ...(workspace.stashItems ?? [])] };
    });
    setWorkspaces((items) => items.map((w) => (w.id === activeWorkspace.id ? { ...w, stashCount: (w.stashCount ?? 0) + 1 } : w)));
    setIsStashOpen(true);
  }


  function toggleStashArtifact(artifact: ArtifactData) {
    if (!activeWorkspace || activeWorkspace.type !== "board") return;
    const items = activeWorkspace.stashItems ?? [];
    const existing = items.find(
      (item) => item.fileName === artifact.fileName && item.audioDataUrl === artifact.audioDataUrl
    );

    if (existing) {
      deleteStashItem(existing.id);
    } else {
      stashArtifact(artifact);
    }
  }

  function deleteStashItem(itemId: string) {
    if (!activeWorkspace || activeWorkspace.type !== "board") {
      return;
    }

    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "board") return workspace;
      return { ...workspace, stashItems: (workspace.stashItems ?? []).filter((item) => item.id !== itemId) };
    });
    setWorkspaces((items) =>
      items.map((workspace) =>
        workspace.id === activeWorkspace.id ? { ...workspace, stashCount: Math.max(0, (workspace.stashCount ?? 0) - 1) } : workspace
      )
    );
  }

  async function openLocalWorkspaceFolder(workspaceId?: string) {
    try {
      const res = await fetch("/api/workspaces/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId })
      });
      if (!res.ok) {
        throw new Error("无法在本地资源管理器中打开画板文件夹。");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "打开本地文件夹失败。");
    }
  }

  async function openLocalAudiosFolder() {
    try {
      const res = await fetch("/api/workspaces/open-audios-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        throw new Error("无法在本地资源管理器中打开音频输出目录。");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "打开音频输出目录失败。");
    }
  }

  async function handleOptimizeCurrentWorkspace() {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/optimize`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "整理画板失败");

      setAppToast({
        id: Date.now(),
        text: `✨ 成功整理并瘦身当前画板！已将 ${data.optimizedCount || 0} 个音频无损存至本地 audios 文件夹，大幅释放内存。`,
        actionText: "打开音频目录",
        onAction: () => void openLocalAudiosFolder()
      });
    } catch (err) {
      alert("整理画板失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  function handleWorkspaceClick(event: React.MouseEvent, workspace: WorkspaceSummary, index: number) {
    if (event.ctrlKey || event.metaKey) {
      setSelectedWorkspaceIds((prev) => {
        const next = new Set(prev);
        if (next.has(workspace.id)) {
          next.delete(workspace.id);
        } else {
          next.add(workspace.id);
        }
        return next;
      });
      setLastSelectedIndex(index);
    } else if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = workspaces.slice(start, end + 1).map((w) => w.id);
      setSelectedWorkspaceIds((prev) => new Set([...prev, ...rangeIds]));
    } else {
      setSelectedWorkspaceIds(new Set([workspace.id]));
      setLastSelectedIndex(index);
      void loadWorkspace(workspace.id);
    }
  }

  async function executeBatchDeleteWorkspaces(ids: string[]) {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxSaveTimerRef.current) {
      window.clearTimeout(maxSaveTimerRef.current);
      maxSaveTimerRef.current = null;
    }

    try {
      const res = await fetch("/api/workspaces/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error("批量删除失败。");
      const data = await res.json();
      setSelectedWorkspaceIds(new Set());
      setLastSelectedIndex(null);
      await loadWorkspaceList(data.activeWorkspaceId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量删除失败。");
    }
  }

  function promptBatchDeleteWorkspaces() {
    const ids = Array.from(selectedWorkspaceIds);
    if (ids.length === 0) return;
    setDeleteModalState({
      isOpen: true,
      title: "批量删除画板",
      message: `确定要批量删除选中的 ${ids.length} 个画板吗？删除后画板数据不可恢复。`,
      confirmLabel: `确定删除 (${ids.length})`,
      onConfirm: async () => {
        setDeleteModalState((s) => ({ ...s, isOpen: false }));
        await executeBatchDeleteWorkspaces(ids);
      }
    });
  }

  async function batchExportSelectedWorkspaces() {
    const ids = Array.from(selectedWorkspaceIds);
    if (ids.length === 0) return;

    try {
      const res = await fetch("/api/workspaces/batch-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error("批量导出失败。");
      const bundleData = await res.json();
      const text = JSON.stringify(bundleData, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const selectedNames = workspaces
        .filter((w) => selectedWorkspaceIds.has(w.id))
        .map((w) => sanitizeFileName(w.name));
      let exportName = "画板导出";
      if (selectedNames.length === 1) {
        exportName = selectedNames[0];
      } else if (selectedNames.length > 1) {
        exportName = `${selectedNames[0]}等${selectedNames.length}个画板`;
      }
      a.download = `${exportName}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量导出失败。");
    }
  }

  async function loadStoragePathInfo() {
    try {
      const res = await fetch("/api/settings/storage-path");
      if (res.ok) {
        const data = await res.json();
        setStoragePathInfo(data);
        setCustomPathInput(data.dataDir);
      }
    } catch (err) {
      console.error("Failed to fetch storage path info", err);
    }
  }

  async function selectFolderAndSave() {
    try {
      const res = await fetch("/api/settings/select-folder", { method: "POST" });
      const data = await res.json();
      if (data.canceled) {
        return;
      }
      if (!res.ok || !data.folderPath) {
        throw new Error(data.error || "未选择有效的文件夹。");
      }
      setCustomPathInput(data.folderPath);
      const saveRes = await fetch("/api/settings/storage-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDir: data.folderPath })
      });
      if (!saveRes.ok) {
        const errJson = await saveRes.json();
        throw new Error(errJson.error || "更新存储目录失败。");
      }
      const savedInfo = await saveRes.json();
      setStoragePathInfo(savedInfo);
      alert(`本地存储目录已成功更改为：\n${savedInfo.dataDir}`);
      await loadWorkspaceList();
    } catch (err) {
      alert(err instanceof Error ? err.message : "选择文件夹失败。");
    }
  }

  async function saveCustomStoragePath() {
    if (!customPathInput.trim()) return;
    try {
      const res = await fetch("/api/settings/storage-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDir: customPathInput })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "更新存储目录失败。");
      }
      const data = await res.json();
      setStoragePathInfo(data);
      alert(`本地存储目录已更改为：\n${data.dataDir}`);
      await loadWorkspaceList();
    } catch (err) {
      alert(err instanceof Error ? err.message : "更改存储路径失败。");
    }
  }

  async function resetStoragePath() {
    try {
      const res = await fetch("/api/settings/reset-storage-path", { method: "POST" });
      if (!res.ok) throw new Error("重置存储路径失败。");
      const data = await res.json();
      setStoragePathInfo(data);
      setCustomPathInput(data.dataDir);
      alert(`存储目录已重置为默认值：\n${data.dataDir}`);
      await loadWorkspaceList();
    } catch (err) {
      alert(err instanceof Error ? err.message : "重置存储路径失败。");
    }
  }

  async function handleWindowDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingJson(false);

    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".json"));
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const text = await file.text();
        const rawData = JSON.parse(text);
        const res = await fetch("/api/workspaces/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rawData)
        });
        if (res.ok) {
          const imported = await res.json();
          await loadWorkspaceList();
          if (imported.id) {
            await loadWorkspace(imported.id);
          }
        } else {
          alert(`导入 ${file.name} 失败：格式不正确。`);
        }
      } catch (err) {
        alert(`打开/导入 ${file.name} 失败：` + (err instanceof Error ? err.message : String(err)));
      }
    }
  }


  const handleCustomNodesChange = useCallback(
    (changes: NodeChange<StudioNode>[]) => {
      const isPositionChange = changes.some((c) => c.type === "position" && c.position);
      if (!isPositionChange) {
        onNodesChange(changes);
        return;
      }

      const currentNodes = nodesRef.current;
      const snapThreshold = 8;

      const updatedChanges = changes.map((change) => {
        if (change.type === "position" && change.position) {
          const draggingNode = currentNodes.find((n) => n.id === change.id);
          if (!draggingNode) return change;

          const getNodeWidth = (n: StudioNode) =>
            n.measured?.width ?? (n.type === "batchVoiceClone" ? 640 : n.type === "batchArtifact" ? 440 : n.type === "voiceDesign" ? 420 : n.type === "voiceClone" ? 370 : 330);
          const getNodeHeight = (n: StudioNode) => n.measured?.height ?? 220;

          const nodeWidth = getNodeWidth(draggingNode);
          const nodeHeight = getNodeHeight(draggingNode);

          let posX = change.position.x;
          let posY = change.position.y;

          const dragLeft = posX;
          const dragCenter = posX + nodeWidth / 2;
          const dragRight = posX + nodeWidth;

          const dragTop = posY;
          const dragMiddle = posY + nodeHeight / 2;
          const dragBottom = posY + nodeHeight;

          const otherNodes = currentNodes.filter(
            (n) => n.id !== change.id && !n.selected && Math.abs(n.position.x - posX) < 800 && Math.abs(n.position.y - posY) < 600
          );

          let snappedX = false;
          let snappedY = false;

          for (const other of otherNodes) {
            const oWidth = getNodeWidth(other);
            const oHeight = getNodeHeight(other);

            const oLeft = other.position.x;
            const oCenter = other.position.x + oWidth / 2;
            const oRight = other.position.x + oWidth;

            const oTop = other.position.y;
            const oMiddle = other.position.y + oHeight / 2;
            const oBottom = other.position.y + oHeight;

            if (!snappedX) {
              if (Math.abs(dragLeft - oLeft) < snapThreshold) {
                posX = oLeft;
                snappedX = true;
              } else if (Math.abs(dragCenter - oCenter) < snapThreshold) {
                posX = oCenter - nodeWidth / 2;
                snappedX = true;
              } else if (Math.abs(dragRight - oRight) < snapThreshold) {
                posX = oRight - nodeWidth;
                snappedX = true;
              }
            }

            if (!snappedY) {
              if (Math.abs(dragTop - oTop) < snapThreshold) {
                posY = oTop;
                snappedY = true;
              } else if (Math.abs(dragMiddle - oMiddle) < snapThreshold) {
                posY = oMiddle - nodeHeight / 2;
                snappedY = true;
              } else if (Math.abs(dragBottom - oBottom) < snapThreshold) {
                posY = oBottom - nodeHeight;
                snappedY = true;
              }
            }
          }

          return {
            ...change,
            position: { x: posX, y: posY }
          };
        }
        return change;
      });

      onNodesChange(updatedChanges);
    },
    [onNodesChange]
  );

  const onNodeDragStop = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveWorkspace();
    }, 200);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const currentNodes = nodesRef.current;
      const sourceNode = currentNodes.find((n) => n.id === connection.source);
      const targetNode = currentNodes.find((n) => n.id === connection.target);
      const strokeColor = (sourceNode?.type && NODE_COLOR_MAP[sourceNode.type]) || "#c5a45d";

      setEdges((items) =>
        addEdge(
          {
            ...connection,
            type: "deletable",
            animated: true,
            style: { stroke: strokeColor, strokeWidth: 2 }
          },
          items
        )
      );

      if (sourceNode && targetNode && sourceNode.type === "referenceAudio") {
        const sourceTitle = sourceNode.data.title;
        if (
          sourceTitle &&
          (targetNode.type === "voiceClone" || targetNode.type === "voiceDesign" || targetNode.type === "batchVoiceClone") &&
          (targetNode.data.title === "音频克隆" || targetNode.data.title === "音色创造" || targetNode.data.title === "批量音频克隆")
        ) {
          patchNode(targetNode.id, { title: sourceTitle });
        }
      }
    },
    [setEdges, patchNode]
  );

  const onConnectEnd = useCallback(
    (event: unknown, connectionState: FinalConnectionState) => {
      if (!connectionState.isValid && connectionState.fromNode) {
        const e = event as MouseEvent | TouchEvent;
        const clientX = "clientX" in e ? e.clientX : (e as TouchEvent).touches?.[0]?.clientX ?? 0;
        const clientY = "clientY" in e ? e.clientY : (e as TouchEvent).touches?.[0]?.clientY ?? 0;
        const point = flowRef.current?.screenToFlowPosition({ x: clientX, y: clientY }) ?? { x: clientX, y: clientY };

        window.setTimeout(() => {
          setMenu({
            x: clientX,
            y: clientY,
            flowX: point.x,
            flowY: point.y,
            sourceNodeId: connectionState.fromNode.id,
            sourceHandleId: connectionState.fromHandle?.id ?? null,
            sourceHandleType: (connectionState.fromHandle?.type as "source" | "target" | undefined) ?? "source"
          });
        }, 30);
      }
    },
    [flowRef]
  );

  function handleFlowMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button === 2) {
      rightDragRef.current = { startX: event.clientX, startY: event.clientY, moved: false };
    }
  }

  function handleFlowMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!rightDragRef.current) return;
    const dist = Math.hypot(event.clientX - rightDragRef.current.startX, event.clientY - rightDragRef.current.startY);
    if (dist > 6) {
      rightDragRef.current.moved = true;
    }
  }

  function openContextMenu(event: MouseEvent) {
    event.preventDefault();

    if (rightDragRef.current?.moved) {
      rightDragRef.current = null;
      return;
    }
    rightDragRef.current = null;

    const point = flowRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) ?? { x: 80, y: 80 };
    setMenu({ x: event.clientX, y: event.clientY, flowX: point.x, flowY: point.y });
  }

  function addNode(type: StudioNodeType) {
    if (!menu) {
      return;
    }

    const newNodeId = createId(type);
    const node: StudioNode = {
      id: newNodeId,
      type,
      position: { x: menu.flowX, y: menu.flowY },
      data: nodeCatalog[type].defaultData()
    };

    let newEdge: StudioEdge | null = null;
    if (menu.sourceNodeId) {
      const sourceId = menu.sourceNodeId;
      const handleId = menu.sourceHandleId || undefined;
      const handleType = menu.sourceHandleType || "source";

      let targetHandleId: string | undefined;
      if (type === "voiceClone" || type === "batchVoiceClone") {
        if (handleId === "instruction" || handleId === "style") {
          targetHandleId = "instruction";
        } else if (handleId === "text") {
          targetHandleId = "text";
        } else {
          targetHandleId = "voice";
        }
      } else if (type === "voiceDesign") {
        if (handleId === "instruction" || handleId === "style") {
          targetHandleId = "instruction";
        } else {
          targetHandleId = "text";
        }
      } else if (type === "audioMerge") {
        targetHandleId = "audio";
      } else if (type === "artifact") {
        targetHandleId = "artifact";
      }

      if (handleType === "source") {
        const sourceNode = nodesRef.current.find((n) => n.id === sourceId);
        const strokeColor = (sourceNode?.type && NODE_COLOR_MAP[sourceNode.type]) || "#c5a45d";
        newEdge = {
          id: createId("edge"),
          source: sourceId,
          sourceHandle: handleId,
          target: newNodeId,
          targetHandle: targetHandleId,
          type: "deletable",
          animated: true,
          style: { stroke: strokeColor, strokeWidth: 2 }
        };
      } else {
        const strokeColor = NODE_COLOR_MAP[type] || "#c5a45d";
        newEdge = {
          id: createId("edge"),
          source: newNodeId,
          sourceHandle: "audio",
          target: sourceId,
          targetHandle: handleId,
          type: "deletable",
          animated: true,
          style: { stroke: strokeColor, strokeWidth: 2 }
        };
      }
    }

    setNodes((items) => [...items, node]);
    if (newEdge) {
      setEdges((items) => [...items, newEdge!]);
    }
    setMenu(null);
  }

  function copySelection() {
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    clipboardRef.current = {
      nodes: selectedNodes.map(stripNodeCallbacks),
      edges: edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    };
  }

  function cutSelection() {
    copySelection();
    const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    if (selectedIds.size === 0) return;
    setNodes((items) => items.filter((node) => !selectedIds.has(node.id)));
    setEdges((items) => items.filter((edge) => !selectedIds.has(edge.source) && !selectedIds.has(edge.target)));
  }

  function pasteSelection() {
    const clipboard = clipboardRef.current;
    if (!clipboard?.nodes.length) return;
    const idMap = new Map(clipboard.nodes.map((node) => [node.id, createId(node.type)]));
    const pastedNodes = clipboard.nodes.map((node) => ({
      ...stripNodeCallbacks(node),
      id: idMap.get(node.id)!,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: true
    }));
    const pastedEdges = clipboard.edges.map((edge) => ({
      ...edge,
      id: createId("edge"),
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false
    }));
    setNodes((items) => [...items.map((node) => ({ ...node, selected: false })), ...pastedNodes]);
    setEdges((items) => [...items, ...pastedEdges]);
    clipboardRef.current = { ...clipboard, nodes: pastedNodes.map(stripNodeCallbacks), edges: pastedEdges };
  }

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    isUndoingRef.current = true;

    const currentSnapshot = {
      nodes: nodesRef.current.map(stripNodeCallbacks),
      edges: edgesRef.current
    };
    redoStackRef.current.push(currentSnapshot);

    const previousSnapshot = undoStackRef.current.pop()!;
    lastRecordedRef.current = JSON.stringify(previousSnapshot);

    setNodes(previousSnapshot.nodes);
    setEdges(previousSnapshot.edges);

    setTimeout(() => {
      isUndoingRef.current = false;
    }, 100);
  }, [setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    isUndoingRef.current = true;

    const currentSnapshot = {
      nodes: nodesRef.current.map(stripNodeCallbacks),
      edges: edgesRef.current
    };
    undoStackRef.current.push(currentSnapshot);

    const nextSnapshot = redoStackRef.current.pop()!;
    lastRecordedRef.current = JSON.stringify(nextSnapshot);

    setNodes(nextSnapshot.nodes);
    setEdges(nextSnapshot.edges);

    setTimeout(() => {
      isUndoingRef.current = false;
    }, 100);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.type !== "board") return;
    if (isUndoingRef.current) return;

    const timer = setTimeout(() => {
      const cleanNodes = nodes.map(stripNodeCallbacks);
      const snapshotStr = JSON.stringify({ nodes: cleanNodes, edges });
      if (snapshotStr !== lastRecordedRef.current) {
        if (lastRecordedRef.current) {
          undoStackRef.current.push(JSON.parse(lastRecordedRef.current));
          if (undoStackRef.current.length > 20) undoStackRef.current.shift();
          redoStackRef.current = [];
        }
        lastRecordedRef.current = snapshotStr;
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [nodes, edges, activeWorkspace]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (key === "y") {
        event.preventDefault();
        handleRedo();
      } else if (key === "c") {
        event.preventDefault();
        copySelection();
      } else if (key === "x") {
        event.preventDefault();
        cutSelection();
      } else if (key === "v") {
        event.preventDefault();
        pasteSelection();
      } else if (key === "f") {
        event.preventDefault();
        setShowNodeSearchModal(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nodes, edges, handleUndo, handleRedo]);

  async function runAudioMerge(nodeId: string) {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const mergeNode = currentNodes.find((node) => node.id === nodeId);
    if (!mergeNode || mergeNode.type !== "audioMerge") return;
    const audioAssets = resolveMergeAudioInputs(mergeNode, currentNodes, currentEdges);
    if (audioAssets.length === 0) {
      patchNode(nodeId, { error: "请连接至少一个参考音频、音频产物或整合节点。" });
      return;
    }
    patchNode(nodeId, { isRunning: true, error: undefined });
    try {
      const audio = await mergeAudioAssets(audioAssets);
      if (audio.size > maxAudioBytes) {
        throw new Error(`整合后的音频超过 ${formatBytes(maxAudioBytes)}，请减少输入音频或缩短时长。`);
      }
      patchNode(nodeId, { audio, isRunning: false, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      patchNode(nodeId, { isRunning: false, error: error instanceof Error ? error.message : "参考音频整合失败。" });
    }
  }


  async function runVoiceClone(nodeId: string) {
    const initialNodes = [...nodesRef.current];
    const initialEdges = [...edgesRef.current];
    const cloneNode = initialNodes.find((node) => node.id === nodeId);
    if (!cloneNode || cloneNode.type !== "voiceClone") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const resolved = resolveCloneInputs(cloneNode, initialNodes, initialEdges);
    if (!resolved.audio) {
      patchNode(nodeId, { error: "缺少参考音频，请连接参考音频节点或在节点中上传。" });
      return;
    }

    const textItems = resolveCloneTextInputs(cloneNode, initialNodes, initialEdges);
    const cloneTexts = textItems.length > 0 ? textItems : [{ title: cloneNode.data.title, text: resolved.text }];

    if (cloneTexts.every((item) => !item.text.trim())) {
      patchNode(nodeId, { error: "缺少音频文本，请连接提示词节点到「文本」输入或在节点中填写。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      for (const [index, item] of cloneTexts.filter((entry) => entry.text.trim()).entries()) {
        const formData = new FormData();
        formData.append("voice", dataUrlToFile(resolved.audio.dataUrl, resolved.audio.fileName, resolved.audio.mimeType));
        formData.append("text", item.text.trim());
        formData.append("instruction", resolved.instruction.trim());
        formData.append("format", "wav");

        const response = await fetch("/api/tts/voiceclone", {
          method: "POST",
          headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
          body: formData
        });
        const payload = (await response.json()) as DebugResponse & { error?: string; details?: unknown };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, error: payload.error || `第 ${index + 1} 条音频克隆失败。` });
          return;
        }

        const artifactNode = createArtifactNode(cloneNode, payload, item.title, index, initialNodes, initialEdges);
        const artifactEdge: StudioEdge = {
          id: createId("edge"),
          source: cloneNode.id,
          sourceHandle: "output",
          target: artifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#c5a45d", strokeWidth: 2 }
        };

        setNodes((items) => items.concat(artifactNode));
        setEdges((items) => items.concat(artifactEdge));
      }

      patchNode(nodeId, { isRunning: false, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  function deleteBatchArtifactItem(nodeId: string, itemId: string) {
    setNodes((items) =>
      items.map((node) => {
        if (node.id === nodeId && node.data.batchArtifacts) {
          return {
            ...node,
            data: {
              ...node.data,
              batchArtifacts: node.data.batchArtifacts.filter((item) => item.id !== itemId)
            }
          };
        }
        return node;
      })
    );
  }

  function deleteIntegratedArtifactItem(nodeId: string, rowId: string, itemId: string) {
    setNodes((items) =>
      items.map((node) => {
        if (node.id === nodeId && node.data.batchRows) {
          const updatedRows = node.data.batchRows.map((r) => {
            if (r.id !== rowId) return r;
            return {
              ...r,
              artifacts: (r.artifacts || []).filter((item) => item.id !== itemId)
            };
          });
          return {
            ...node,
            data: {
              ...node.data,
              batchRows: updatedRows
            }
          };
        }
        return node;
      })
    );
  }

  async function runIntegratedBatch(nodeId: string) {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const node = currentNodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "integratedStudio") return;

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = node.data.batchRows || [];
    const validRows = rows.filter((r) => r.text.trim());
    if (validRows.length === 0) {
      patchNode(nodeId, { error: "请至少填写一行的音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      let updatedRows = [...rows];

      for (let index = 0; index < updatedRows.length; index++) {
        const row = updatedRows[index];
        if (!row.text.trim()) continue;

        let refAudioDataUrl = row.refAudioUrl || node.data.refAudioUrl;
        let refAudioFileName = row.refAudioName || node.data.refAudioName || "ref.wav";
        let refAudioMimeType = "audio/wav";

        if (!refAudioDataUrl) {
          const resolved = resolveCloneInputs(node, currentNodes, currentEdges);
          if (resolved.audio) {
            refAudioDataUrl = resolved.audio.dataUrl;
            refAudioFileName = resolved.audio.fileName;
            refAudioMimeType = resolved.audio.mimeType;
          }
        }

        if (!refAudioDataUrl) {
          patchNode(nodeId, { isRunning: false, error: `行「${row.title || `句段 ${index + 1}`}」缺少参考音频！请在第1列上传/录制参考音频。` });
          return;
        }

        const formData = new FormData();
        formData.append("voice", dataUrlToFile(refAudioDataUrl, refAudioFileName, refAudioMimeType));
        formData.append("text", row.text.trim());
        formData.append("instruction", (row.instruction || row.voiceStyle || "").trim());
        formData.append("format", "wav");

        const response = await fetch("/api/tts/voiceclone", {
          method: "POST",
          headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
          body: formData
        });

        const payload = (await response.json()) as DebugResponse & { error?: string };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, error: payload.error || `行「${row.title || `句段 ${index + 1}`}」生成失败。` });
          return;
        }

        const currentRows = (nodesRef.current.find((n) => n.id === nodeId)?.data.batchRows) || updatedRows;
        const targetRowIdx = currentRows.findIndex((r) => r.id === row.id);
        if (targetRowIdx >= 0) {
          const rowItem = currentRows[targetRowIdx];
          const existingArtifacts = rowItem.artifacts || [];
          const maxSeq = existingArtifacts.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
          const newArtifactItem: IntegratedRowArtifact = {
            id: createId("art"),
            seqIndex: maxSeq + 1,
            fileName: payload.fileName,
            audioDataUrl: payload.audioDataUrl,
            elapsedMs: payload.elapsedMs,
            createdAt: new Date().toISOString()
          };
          const nextArtifacts = [...existingArtifacts, newArtifactItem];
          const newBatchRows = [...currentRows];
          newBatchRows[targetRowIdx] = {
            ...rowItem,
            artifacts: nextArtifacts
          };
          updatedRows = newBatchRows;
          patchNode(nodeId, { batchRows: newBatchRows });
        }
      }

      patchNode(nodeId, { isRunning: false, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "请求失败。";
      patchNode(nodeId, { isRunning: false, error: msg });
    }
  }

  async function runIntegratedSingleRow(nodeId: string, rowId: string) {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const node = currentNodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "integratedStudio") return;

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = node.data.batchRows || [];
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const row = rows[rowIndex];
    if (!row || !row.text.trim()) {
      patchNode(nodeId, { error: "当前行的音频文本不能为空。" });
      return;
    }

    let refAudioDataUrl = row.refAudioUrl || node.data.refAudioUrl;
    let refAudioFileName = row.refAudioName || node.data.refAudioName || "ref.wav";
    let refAudioMimeType = "audio/wav";

    if (!refAudioDataUrl) {
      const resolved = resolveCloneInputs(node, currentNodes, currentEdges);
      if (resolved.audio) {
        refAudioDataUrl = resolved.audio.dataUrl;
        refAudioFileName = resolved.audio.fileName;
        refAudioMimeType = resolved.audio.mimeType;
      }
    }

    if (!refAudioDataUrl) {
      patchNode(nodeId, { error: `行「${row.title || `句段 ${rowIndex + 1}`}」缺少参考音频！请在第1列上传/录制参考音频。` });
      return;
    }

    patchNode(nodeId, { singleRunningRowId: rowId, error: undefined });

    try {
      const formData = new FormData();
      formData.append("voice", dataUrlToFile(refAudioDataUrl, refAudioFileName, refAudioMimeType));
      formData.append("text", row.text.trim());
      formData.append("instruction", (row.instruction || row.voiceStyle || "").trim());
      formData.append("format", "wav");

      const response = await fetch("/api/tts/voiceclone", {
        method: "POST",
        headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
        body: formData
      });

      const payload = (await response.json()) as DebugResponse & { error?: string };

      if (!response.ok) {
        patchNode(nodeId, { singleRunningRowId: undefined, error: payload.error || `行「${row.title || `句段 ${rowIndex + 1}`}」生成失败。` });
        return;
      }

      const currentRows = (nodesRef.current.find((n) => n.id === nodeId)?.data.batchRows) || rows;
      const targetRowIdx = currentRows.findIndex((r) => r.id === rowId);
      if (targetRowIdx >= 0) {
        const rowItem = currentRows[targetRowIdx];
        const existingArtifacts = rowItem.artifacts || [];
        const maxSeq = existingArtifacts.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
        const newArtifactItem: IntegratedRowArtifact = {
          id: createId("art"),
          seqIndex: maxSeq + 1,
          fileName: payload.fileName,
          audioDataUrl: payload.audioDataUrl,
          elapsedMs: payload.elapsedMs,
          createdAt: new Date().toISOString()
        };
        const nextArtifacts = [...existingArtifacts, newArtifactItem];
        const newBatchRows = [...currentRows];
        newBatchRows[targetRowIdx] = {
          ...rowItem,
          artifacts: nextArtifacts
        };
        patchNode(nodeId, { singleRunningRowId: undefined, batchRows: newBatchRows, error: undefined });
      }

      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "单条生成失败。";
      patchNode(nodeId, { singleRunningRowId: undefined, error: msg });
    }
  }

  async function runBatchVoiceClone(nodeId: string) {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceClone") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const resolved = resolveCloneInputs(batchNode, currentNodes, currentEdges);
    if (!resolved.audio) {
      patchNode(nodeId, { error: "批量音频克隆节点需要连接一个参考音频或音频整合节点。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const validRows = rows.filter((r) => r.text.trim());
    if (validRows.length === 0) {
      patchNode(nodeId, { error: "请至少填写一行的音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      for (const [index, row] of validRows.entries()) {
        const rowArtifactTitle = row.title.trim() || `句段 ${index + 1}`;

        let rowArtifactNode = nodesRef.current.find(
          (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && edgesRef.current.some((e) => e.source === nodeId && e.target === n.id)
        );

        if (!rowArtifactNode) {
          const col = index % 3;
          const rowPos = Math.floor(index / 3);
          const stepX = 500;
          const stepY = 590;
          const startX = batchNode.position.x + 680;

          const newArtifactNode: StudioNode = {
            id: createId("batch_artifact"),
            type: "batchArtifact",
            position: {
              x: startX + col * stepX,
              y: batchNode.position.y + rowPos * stepY
            },
            data: {
              title: rowArtifactTitle,
              parentTitle: batchNode.data.title?.trim() || "批量节点",
              batchRowId: row.id,
              batchArtifacts: [],
              workspaceName: activeWorkspace?.name
            }
          };
          const newEdge: StudioEdge = {
            id: createId("edge"),
            source: nodeId,
            sourceHandle: "output",
            target: newArtifactNode.id,
            targetHandle: "artifact",
            type: "deletable",
            animated: true,
            style: { stroke: "#c5a45d", strokeWidth: 2 }
          };

          setNodes((items) => items.concat(newArtifactNode));
          setEdges((items) => items.concat(newEdge));
          rowArtifactNode = newArtifactNode;
        }

        const targetArtifactNodeId = rowArtifactNode.id;

        const formData = new FormData();
        formData.append("voice", dataUrlToFile(resolved.audio.dataUrl, resolved.audio.fileName, resolved.audio.mimeType));
        formData.append("text", row.text.trim());
        formData.append("instruction", (row.instruction || resolved.instruction || "").trim());
        formData.append("format", "wav");

        const response = await fetch("/api/tts/voiceclone", {
          method: "POST",
          headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
          body: formData
        });

        const payload = (await response.json()) as DebugResponse & { error?: string };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, error: payload.error || `行「${row.title || `句段 ${index + 1}`}」克隆失败。` });
          return;
        }

        setNodes((items) =>
          items.map((n) => {
            if (n.id === targetArtifactNodeId) {
              const existing = n.data.batchArtifacts || [];
              const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
              const newItem: BatchArtifactItem = {
                id: createId("bitem"),
                seqIndex: maxSeq + 1,
                rowTitle: row.title.trim() || `句段 ${index + 1}`,
                fileName: payload.fileName,
                audioDataUrl: payload.audioDataUrl,
                elapsedMs: payload.elapsedMs,
                createdAt: new Date().toISOString()
              };
              return {
                ...n,
                data: {
                  ...n.data,
                  title: rowArtifactTitle,
                  batchRowId: row.id,
                  batchArtifacts: [...existing, newItem]
                }
              };
            }
            return n;
          })
        );
      }

      patchNode(nodeId, { isRunning: false, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "批量生成请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runSingleRowBatchVoiceClone(nodeId: string, rowId: string) {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceClone") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const resolved = resolveCloneInputs(batchNode, currentNodes, currentEdges);
    if (!resolved.audio) {
      patchNode(nodeId, { error: "批量音频克隆节点需要连接一个参考音频或音频整合节点。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const row = rows[rowIndex];
    if (!row || !row.text.trim()) {
      patchNode(nodeId, { error: "当前行的音频文本不能为空。" });
      return;
    }

    patchNode(nodeId, { singleRunningRowId: rowId, error: undefined });

    try {
      const rowArtifactTitle = row.title.trim() || `句段 ${rowIndex >= 0 ? rowIndex + 1 : 1}`;

      let rowArtifactNode = currentNodes.find(
        (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && currentEdges.some((e) => e.source === nodeId && e.target === n.id)
      );

      if (!rowArtifactNode) {
        const itemIdx = rowIndex >= 0 ? rowIndex : 0;
        const col = itemIdx % 3;
        const rowPos = Math.floor(itemIdx / 3);
        const stepX = 500;
        const stepY = 590;
        const startX = batchNode.position.x + 680;

        const newArtifactNode: StudioNode = {
          id: createId("batch_artifact"),
          type: "batchArtifact",
          position: {
            x: startX + col * stepX,
            y: batchNode.position.y + rowPos * stepY
          },
          data: {
            title: rowArtifactTitle,
            parentTitle: batchNode.data.title?.trim() || "批量节点",
            batchRowId: row.id,
            batchArtifacts: [],
            workspaceName: activeWorkspace?.name
          }
        };
        const newEdge: StudioEdge = {
          id: createId("edge"),
          source: nodeId,
          sourceHandle: "output",
          target: newArtifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#c5a45d", strokeWidth: 2 }
        };

        setNodes((items) => items.concat(newArtifactNode));
        setEdges((items) => items.concat(newEdge));
        rowArtifactNode = newArtifactNode;
      }

      const targetArtifactNodeId = rowArtifactNode.id;

      const formData = new FormData();
      formData.append("voice", dataUrlToFile(resolved.audio.dataUrl, resolved.audio.fileName, resolved.audio.mimeType));
      formData.append("text", row.text.trim());
      formData.append("instruction", (row.instruction || resolved.instruction || "").trim());
      formData.append("format", "wav");

      const response = await fetch("/api/tts/voiceclone", {
        method: "POST",
        headers: { "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
        body: formData
      });

      const payload = (await response.json()) as DebugResponse & { error?: string };

      if (!response.ok) {
        patchNode(nodeId, { singleRunningRowId: undefined, error: payload.error || `行「${row.title || `句段 ${rowIndex + 1}`}」克隆失败。` });
        return;
      }

      setNodes((items) =>
        items.map((n) => {
          if (n.id === targetArtifactNodeId) {
            const existing = n.data.batchArtifacts || [];
            const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
            const newItem: BatchArtifactItem = {
              id: createId("bitem"),
              seqIndex: maxSeq + 1,
              rowTitle: row.title.trim() || `句段 ${rowIndex >= 0 ? rowIndex + 1 : 1}`,
              fileName: payload.fileName,
              audioDataUrl: payload.audioDataUrl,
              elapsedMs: payload.elapsedMs,
              createdAt: new Date().toISOString()
            };
            return {
              ...n,
              data: {
                ...n.data,
                title: rowArtifactTitle,
                batchRowId: row.id,
                batchArtifacts: [...existing, newItem]
              }
            };
          }
          return n;
        })
      );

      patchNode(nodeId, { singleRunningRowId: undefined, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "单条生成请求失败。";
      patchNode(nodeId, {
        singleRunningRowId: undefined,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runBatchVoiceDesign(nodeId: string) {
    const currentNodes = nodesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceDesign") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const validRows = rows.filter((r) => r.text.trim());
    if (validRows.length === 0) {
      patchNode(nodeId, { error: "请至少填写一行的音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      for (const [index, row] of validRows.entries()) {
        const rowArtifactTitle = row.title.trim() || `句段 ${index + 1}`;

        let rowArtifactNode = nodesRef.current.find(
          (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && edgesRef.current.some((e) => e.source === nodeId && e.target === n.id)
        );

        if (!rowArtifactNode) {
          const col = index % 3;
          const rowPos = Math.floor(index / 3);
          const stepX = 500;
          const stepY = 590;
          const startX = batchNode.position.x + 940;

          const newArtifactNode: StudioNode = {
            id: createId("batch_artifact"),
            type: "batchArtifact",
            position: {
              x: startX + col * stepX,
              y: batchNode.position.y + rowPos * stepY
            },
            data: {
              title: rowArtifactTitle,
              parentTitle: batchNode.data.title?.trim() || "批量节点",
              batchRowId: row.id,
              batchArtifacts: [],
              workspaceName: activeWorkspace?.name
            }
          };
          const newEdge: StudioEdge = {
            id: createId("edge"),
            source: nodeId,
            sourceHandle: "output",
            target: newArtifactNode.id,
            targetHandle: "artifact",
            type: "deletable",
            animated: true,
            style: { stroke: "#38bdf8", strokeWidth: 2 }
          };

          setNodes((items) => items.concat(newArtifactNode));
          setEdges((items) => items.concat(newEdge));
          rowArtifactNode = newArtifactNode;
        }

        const targetArtifactNodeId = rowArtifactNode.id;

        const rawDesc = (row.instruction || "").trim();
        const rawStyle = (row.voiceStyle || "").trim();
        const voiceDescription = [rawDesc, rawStyle ? `【语音风格】：${rawStyle}` : ""].filter(Boolean).join("\n\n");

        const response = await fetch("/api/tts/voicedesign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "X-API-Endpoint": apiEndpoint
          },
          body: JSON.stringify({
            voiceDescription,
            naturalControl: (row.naturalControl || "").trim(),
            text: row.text.trim()
          })
        });

        const payload = (await response.json()) as DebugResponse & { error?: string };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, error: payload.error || `行「${row.title || `句段 ${index + 1}`}」音色创造生成失败。` });
          return;
        }

        setNodes((items) =>
          items.map((n) => {
            if (n.id === targetArtifactNodeId) {
              const existing = n.data.batchArtifacts || [];
              const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
              const newItem: BatchArtifactItem = {
                id: createId("bitem"),
                seqIndex: maxSeq + 1,
                rowTitle: row.title.trim() || `句段 ${index + 1}`,
                fileName: payload.fileName,
                audioDataUrl: payload.audioDataUrl,
                elapsedMs: payload.elapsedMs,
                createdAt: new Date().toISOString()
              };
              return {
                ...n,
                data: {
                  ...n.data,
                  title: rowArtifactTitle,
                  batchRowId: row.id,
                  batchArtifacts: [...existing, newItem]
                }
              };
            }
            return n;
          })
        );
      }

      patchNode(nodeId, { isRunning: false, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "批量音色创造请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runSingleRowBatchVoiceDesign(nodeId: string, rowId: string) {
    const currentNodes = nodesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceDesign") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const row = rows[rowIndex];
    if (!row || !row.text.trim()) {
      patchNode(nodeId, { error: "当前行的音频文本不能为空。" });
      return;
    }

    patchNode(nodeId, { singleRunningRowId: rowId, error: undefined });

    try {
      const rowArtifactTitle = row.title.trim() || `句段 ${rowIndex >= 0 ? rowIndex + 1 : 1}`;

      let rowArtifactNode = currentNodes.find(
        (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && edgesRef.current.some((e) => e.source === nodeId && e.target === n.id)
      );

      if (!rowArtifactNode) {
        const itemIdx = rowIndex >= 0 ? rowIndex : 0;
        const col = itemIdx % 3;
        const rowPos = Math.floor(itemIdx / 3);
        const stepX = 500;
        const stepY = 590;
        const startX = batchNode.position.x + 940;

        const newArtifactNode: StudioNode = {
          id: createId("batch_artifact"),
          type: "batchArtifact",
          position: {
            x: startX + col * stepX,
            y: batchNode.position.y + rowPos * stepY
          },
          data: {
            title: rowArtifactTitle,
            parentTitle: batchNode.data.title?.trim() || "批量节点",
            batchRowId: row.id,
            batchArtifacts: [],
            workspaceName: activeWorkspace?.name
          }
        };
        const newEdge: StudioEdge = {
          id: createId("edge"),
          source: nodeId,
          sourceHandle: "output",
          target: newArtifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#38bdf8", strokeWidth: 2 }
        };

        setNodes((items) => items.concat(newArtifactNode));
        setEdges((items) => items.concat(newEdge));
        rowArtifactNode = newArtifactNode;
      }

      const targetArtifactNodeId = rowArtifactNode.id;

      const rawDesc = (row.instruction || "").trim();
      const rawStyle = (row.voiceStyle || "").trim();
      const voiceDescription = [rawDesc, rawStyle ? `【语音风格】：${rawStyle}` : ""].filter(Boolean).join("\n\n");

      const response = await fetch("/api/tts/voicedesign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-API-Endpoint": apiEndpoint
        },
        body: JSON.stringify({
          voiceDescription,
          naturalControl: (row.naturalControl || "").trim(),
          text: row.text.trim()
        })
      });

      const payload = (await response.json()) as DebugResponse & { error?: string };

      if (!response.ok) {
        patchNode(nodeId, { singleRunningRowId: undefined, error: payload.error || `行「${row.title || `句段 ${rowIndex + 1}`}」生成失败。` });
        return;
      }

      setNodes((items) =>
        items.map((n) => {
          if (n.id === targetArtifactNodeId) {
            const existing = n.data.batchArtifacts || [];
            const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
            const newItem: BatchArtifactItem = {
              id: createId("bitem"),
              seqIndex: maxSeq + 1,
              rowTitle: row.title.trim() || `句段 ${rowIndex >= 0 ? rowIndex + 1 : 1}`,
              fileName: payload.fileName,
              audioDataUrl: payload.audioDataUrl,
              elapsedMs: payload.elapsedMs,
              createdAt: new Date().toISOString()
            };
            return {
              ...n,
              data: {
                ...n.data,
                title: rowArtifactTitle,
                batchRowId: row.id,
                batchArtifacts: [...existing, newItem]
              }
            };
          }
          return n;
        })
      );

      patchNode(nodeId, { singleRunningRowId: undefined, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "单条音色创造请求失败。";
      patchNode(nodeId, {
        singleRunningRowId: undefined,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runVoiceDesign(nodeId: string, count: number = 1) {
    const initialNodes = [...nodesRef.current];
    const initialEdges = [...edgesRef.current];
    const designNode = initialNodes.find((node) => node.id === nodeId);
    if (!designNode || designNode.type !== "voiceDesign") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const connectedInstructions = resolveVoiceDesignInstructionInputs(designNode, initialNodes, initialEdges);
    const rawInstruction = String(designNode.data.instruction || "").trim();
    const voiceDescription = (connectedInstructions.length > 0
      ? [rawInstruction, ...connectedInstructions].filter(Boolean).join("\n\n")
      : rawInstruction).trim();
    const naturalControl = String(designNode.data.naturalControl || "").trim();
    const promptInputs = resolveVoiceDesignInputs(designNode, initialNodes, initialEdges);
    const textItems = promptInputs.length > 0 ? promptInputs : [{ title: designNode.data.title, text: String(designNode.data.text || "").trim() }];

    if (!voiceDescription && !naturalControl) {
      patchNode(nodeId, { error: "请先填写音色描述或自然语言控制（或连接语音风格/提示词节点）。" });
      return;
    }

    if (textItems.every((item) => !item.text.trim())) {
      patchNode(nodeId, { error: "请连接提示词节点，或在节点内填写音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      const validTextItems = textItems.filter((entry) => entry.text.trim());
      const totalRuns = count > 1 ? count : validTextItems.length;

      for (let runIdx = 0; runIdx < totalRuns; runIdx++) {
        const item = validTextItems[runIdx % validTextItems.length];
        const response = await fetch("/api/tts/voicedesign", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
          body: JSON.stringify({
            voiceDescription,
            naturalControl,
            text: item.text.trim(),
            format: "wav"
          })
        });
        const payload = (await response.json()) as DebugResponse & { error?: string; details?: unknown };

        if (!response.ok) {
          const detailMsg = (payload.details as { error?: { message?: string } })?.error?.message;
          patchNode(nodeId, { isRunning: false, error: detailMsg || payload.error || `第 ${runIdx + 1} 条音色创造失败。` });
          return;
        }

        const artifactNode = createArtifactNode(designNode, payload, item.title, runIdx, initialNodes, initialEdges);
        const artifactEdge: StudioEdge = {
          id: createId("edge"),
          source: designNode.id,
          sourceHandle: "output",
          target: artifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#c5a45d", strokeWidth: 2 }
        };

        setNodes((items) => items.concat(artifactNode));
        setEdges((items) => items.concat(artifactEdge));
      }

      patchNode(nodeId, { isRunning: false, error: undefined });
      window.setTimeout(() => void saveWorkspace(), 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function optimizeVoiceStyle(nodeId: string) {
    const currentNodes = nodesRef.current;
    const styleNode = currentNodes.find((node) => node.id === nodeId);
    if (!styleNode || styleNode.type !== "voiceStyle") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const style = String(styleNode.data.text || "").trim();
    if (!style) {
      patchNode(nodeId, { error: "请先填写需要优化的语音风格。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      const response = await fetch("/api/voice-style/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
        body: JSON.stringify({ style })
      });
      const payload = (await response.json()) as StyleOptimizeResponse;

      if (!response.ok) {
        patchNode(nodeId, { isRunning: false, error: payload.error || "AI 优化失败。" });
        return;
      }

      patchNode(nodeId, {
        text: payload.optimizedText,
        isRunning: false,
        error: undefined
      });
    } catch (error) {
      patchNode(nodeId, {
        isRunning: false,
        error: error instanceof Error ? error.message : "AI 优化请求失败。"
      });
    }
  }

  async function optimizeVoiceDesign(nodeId: string) {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const designNode = currentNodes.find((node) => node.id === nodeId);
    if (!designNode || designNode.type !== "voiceDesign") {
      return;
    }

    if (!apiKey) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const connectedInstructions = resolveVoiceDesignInstructionInputs(designNode, currentNodes, currentEdges);
    const rawInstruction = String(designNode.data.instruction || "").trim();
    const voiceDescription = (connectedInstructions.length > 0
      ? [rawInstruction, ...connectedInstructions].filter(Boolean).join("\n\n")
      : rawInstruction).trim();
    if (!voiceDescription) {
      patchNode(nodeId, { error: "请先填写需要润色的音色描述。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      const response = await fetch("/api/voice-design/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "X-API-Endpoint": apiEndpoint },
        body: JSON.stringify({ voiceDescription })
      });
      const payload = (await response.json()) as StyleOptimizeResponse;

      if (!response.ok) {
        patchNode(nodeId, { isRunning: false, error: payload.error || "AI 润色音色描述失败。" });
        return;
      }

      patchNode(nodeId, {
        instruction: payload.optimizedText,
        isRunning: false,
        error: undefined
      });
    } catch (error) {
      patchNode(nodeId, {
        isRunning: false,
        error: error instanceof Error ? error.message : "AI 润色音色描述请求失败。"
      });
    }
  }

  async function downloadStashZip() {
    if (!activeWorkspace || activeWorkspace.type !== "board" || activeWorkspace.stashItems.length === 0) {
      return;
    }
    const items = activeWorkspace.stashItems;

    const zip = new JSZip();
    const usedNames = new Map<string, number>();
    for (const item of items) {
      const safeName = getUniqueFileName(getArtifactDownloadFileName(item.sourceNodeName || item.fileName, item.fileName, activeWorkspace.name), usedNames);
      const bytes = await fetchAudioUint8Array(item.audioDataUrl);
      zip.file(safeName, bytes);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(activeWorkspace.name)}-${formatDateForFile(new Date())}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="studio-shell" onClick={() => setMenu(null)}>
      {isDraggingJson && (
        <div className="json-drop-overlay">
          <FileDown size={48} />
          <h3>释放以导入 JSON 画板文件</h3>
          <p>支持拖放任意 JSON 画板文件直接解析并打开工作台</p>
        </div>
      )}
      <header
        className={`studio-topbar ${(themeConfig.autoHideTopbar ?? true) && topbarCollapsed ? "collapsed" : ""}`}
        onMouseEnter={() => {
          if (topbarHoverTimerRef.current) {
            window.clearTimeout(topbarHoverTimerRef.current);
          }
        }}
        onMouseLeave={() => {
          if ((themeConfig.autoHideTopbar ?? true) && !showApiKeyModal) {
            topbarHoverTimerRef.current = window.setTimeout(() => setTopbarCollapsed(true), 2000);
          }
        }}
      >
        <div className="brand-block">
          <span className="brand-kicker">{themeConfig.brandTitleEn || "ZHUGUANG AUDIO WORKSTATION"}</span>
          <h1>{themeConfig.brandTitleZh || "铸光音频工作站"}</h1>
        </div>
        <div className="topbar-actions">
          <StatusPill apiKey={apiKey} onOpenModal={openApiKeyModal} />
          <button type="button" onClick={() => setShowAppearanceModal(true)} title="调整外观色彩与主题">
            <Palette size={16} />
            外观
          </button>
          <button type="button" onClick={() => setShowStoragePathModal(true)} title="画板本地存储路径设置">
            <FolderOpen size={16} />
            存储路径
          </button>
        </div>
      </header>

      {apiKey === DEFAULT_API_KEY && showDefaultKeyWarning ? (
        <section className="api-warning">
          <AlertTriangle size={18} />
          <span>当前使用的是默认 API Key，不保证长期可用。请点击右上角 API Key 区域配置自己的密钥。</span>
          <button className="api-warning-close" type="button" onClick={() => setShowDefaultKeyWarning(false)}>
            <X size={16} />
          </button>
        </section>
      ) : null}

      {showApiKeyModal && (
        <div
          className="api-key-modal"
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => handleBackdropClick(e, closeApiKeyModal)}
        >
          <div className="api-key-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="api-key-modal-header">
              <h3>
                <Key size={18} />
                配置 AI 语音/文本 API 密钥与服务入口
              </h3>
              <button className="api-key-modal-close" type="button" onClick={closeApiKeyModal}>
                <X size={18} />
              </button>
            </div>
            <div className="api-key-modal-body">
              <div className="api-provider-section">
                <span className="api-provider-section-title">
                  <Sparkles size={14} /> 选择 AI 语音/模型服务商 API 入口：
                </span>
                <div className="api-provider-grid">
                  {API_PROVIDERS.map((p) => {
                    const isActive = apiProviderInput === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={isActive ? "api-provider-card active" : "api-provider-card"}
                        onClick={() => {
                          setApiProviderInput(p.id);
                          if (p.endpoint) {
                            setApiEndpointInput(p.endpoint);
                          }
                        }}
                      >
                        <div className="api-provider-card-header">
                          <span className="api-provider-name">{p.name}</span>
                          <span className="api-provider-badge">{p.badge}</span>
                        </div>
                        <span className="api-provider-card-desc">{p.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const currentPreset = API_PROVIDERS.find((p) => p.id === apiProviderInput) || API_PROVIDERS[0];
                return (
                  <div className="api-provider-info">
                    <p className="api-key-modal-hint">
                      {currentPreset.hint ?? currentPreset.description}
                      {currentPreset.getKeyUrl ? (
                        <>
                          {" · "}
                          <a href={currentPreset.getKeyUrl} target="_blank" rel="noopener noreferrer">
                            前往 {currentPreset.name} 获取 API Key →
                          </a>
                        </>
                      ) : null}
                    </p>
                    {currentPreset.subEndpoints && currentPreset.subEndpoints.length > 0 ? (
                      <div className="endpoint-pill-group">
                        <span className="node-muted" style={{ fontSize: 11 }}>预设 Endpoint 快捷选择：</span>
                        {currentPreset.subEndpoints.map((sub) => (
                          <button
                            key={sub.url}
                            type="button"
                            className={apiEndpointInput === sub.url ? "endpoint-pill active" : "endpoint-pill"}
                            onClick={() => setApiEndpointInput(sub.url)}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              <div className="api-key-field">
                <p className="api-key-modal-hint" style={{ fontWeight: 800, marginBottom: 4 }}>
                  API Key 密钥：
                </p>
                <input
                  type="text"
                  className="api-key-input"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  spellCheck={false}
                />
                {apiKey === DEFAULT_API_KEY && (
                  <p className="api-key-modal-warn" style={{ marginTop: 6 }}>
                    <AlertTriangle size={14} />
                    当前使用的默认 Key 不可长期使用，不保证可用性，建议尽快配置自己的密钥。
                  </p>
                )}
              </div>

              <div className="api-endpoint-section">
                <p className="api-key-modal-hint" style={{ fontWeight: 800, marginBottom: 4 }}>
                  API 服务地址 (Endpoint URL)：
                </p>
                <input
                  type="text"
                  className="api-key-input"
                  value={apiEndpointInput}
                  onChange={(e) => setApiEndpointInput(e.target.value)}
                  placeholder="https://..."
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="api-key-modal-footer">
              <button type="button" className="api-key-btn-cancel" onClick={closeApiKeyModal}>
                取消
              </button>
              <button type="button" className="api-key-btn-save" onClick={saveApiKey}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {showAppearanceModal && (
        <div
          className="api-key-modal"
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => handleBackdropClick(e, () => setShowAppearanceModal(false))}
        >
          <div className="appearance-modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="api-key-modal-header">
              <h3><Palette size={18} /> 外观与主题</h3>
              <button className="api-key-modal-close" type="button" onClick={() => setShowAppearanceModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="appearance-modal-content">
              {/* 工作站名称标识设置 (两列：英文与中文) */}
              <div className="appearance-group">
                <div className="appearance-group-heading">工作站名称与标识设置</div>
                <div className="appearance-card">
                  <div className="appearance-item-row-cols">
                    <div className="appearance-col">
                      <span className="appearance-item-label">中文主标题</span>
                      <input
                        type="text"
                        className="appearance-text-input"
                        value={themeConfig.brandTitleZh ?? "铸光音频工作站"}
                        onChange={(e) => updateBrandTitle("brandTitleZh", e.target.value)}
                        placeholder="铸光音频工作站"
                      />
                    </div>
                    <div className="appearance-col">
                      <span className="appearance-item-label">英文副标题</span>
                      <input
                        type="text"
                        className="appearance-text-input"
                        value={themeConfig.brandTitleEn ?? "ZHUGUANG AUDIO WORKSTATION"}
                        onChange={(e) => updateBrandTitle("brandTitleEn", e.target.value)}
                        placeholder="ZHUGUANG AUDIO WORKSTATION"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 顶部标题栏自动隐藏开关 */}
              <div
                className="appearance-card"
                style={{ cursor: "pointer" }}
                onClick={() => updateAutoHideTopbar(!(themeConfig.autoHideTopbar ?? true))}
              >
                <div className="appearance-card-main">
                  <div>
                    <div className="appearance-card-title">顶部标题栏自动隐藏</div>
                    <div className="appearance-card-sub">开启后鼠标移开时自动收起顶部栏，移至窗口顶部即可重新展开。</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={themeConfig.autoHideTopbar ?? true}
                    className={`capsule-switch ${themeConfig.autoHideTopbar ?? true ? "checked" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateAutoHideTopbar(!(themeConfig.autoHideTopbar ?? true));
                    }}
                    style={{ border: "none", outline: "none", cursor: "pointer" }}
                    title={themeConfig.autoHideTopbar ?? true ? "已开启自动隐藏（点击切换为常驻显示）" : "已关闭自动隐藏（点击开启）"}
                  >
                    <span className="capsule-switch-thumb" />
                  </button>
                </div>
              </div>

              {/* Appearance Mode Card */}
              <div className="appearance-card">
                <div className="appearance-card-main">
                  <div>
                    <div className="appearance-card-title">外观模式</div>
                    <div className="appearance-card-sub">选择浅色模式、深色模式或跟随系统设置。</div>
                  </div>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={themeConfig.mode === "system" ? "active" : ""}
                      onClick={() => updateMode("system")}
                      title="跟随系统"
                    >
                      <Monitor size={15} />
                    </button>
                    <button
                      type="button"
                      className={themeConfig.mode === "light" ? "active" : ""}
                      onClick={() => updateMode("light")}
                      title="浅色模式"
                    >
                      <Sun size={15} />
                    </button>
                    <button
                      type="button"
                      className={themeConfig.mode === "dark" ? "active" : ""}
                      onClick={() => updateMode("dark")}
                      title="深色模式"
                    >
                      <Moon size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Light Theme Group */}
              <div className="appearance-group">
                <div className="appearance-group-heading">浅色主题</div>
                <div className="appearance-card">
                  <div className="appearance-item-row">
                    <span className="appearance-item-label">主题预设</span>
                    <div className="appearance-item-controls">
                      <button
                        type="button"
                        className="appearance-icon-btn"
                        onClick={resetLightPreset}
                        title="重置为默认预设"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <select
                        className="appearance-select-control"
                        value={themeConfig.lightTheme.preset}
                        onChange={(e) => {
                          const nextPreset = e.target.value;
                          updateLightThemePreset(nextPreset);
                          if (nextPreset === "custom") {
                            setShowLightCustomColors(true);
                          }
                        }}
                      >
                        {Object.entries(lightPresets).map(([key, p]) => (
                          <option key={key} value={key}>{p.label}</option>
                        ))}
                        <option value="custom">自定义</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="appearance-collapse-toggle-btn"
                    onClick={() => setShowLightCustomColors((v) => !v)}
                  >
                    <span>自定义颜色细节 ({showLightCustomColors ? "点击收起" : "点击展开"})</span>
                    <ChevronDown
                      size={14}
                      style={{
                        transform: showLightCustomColors ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 180ms ease"
                      }}
                    />
                  </button>

                  {showLightCustomColors && (
                    <div className="appearance-custom-colors-wrap">
                      <div className="appearance-item-row">
                        <span className="appearance-item-label">背景颜色</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.lightTheme.bgColor}
                            onChange={(e) => updateLightColor("bgColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.lightTheme.bgColor}
                            onChange={(e) => updateLightColor("bgColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>

                      <div className="appearance-item-row">
                        <span className="appearance-item-label">前景文字</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.lightTheme.fgColor}
                            onChange={(e) => updateLightColor("fgColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.lightTheme.fgColor}
                            onChange={(e) => updateLightColor("fgColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>

                      <div className="appearance-item-row">
                        <span className="appearance-item-label">强调主色</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.lightTheme.accentColor}
                            onChange={(e) => updateLightColor("accentColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.lightTheme.accentColor}
                            onChange={(e) => updateLightColor("accentColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>

                      <div className="appearance-item-row">
                        <span className="appearance-item-label">节点背景颜色</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.lightTheme.nodeColor || "#ffffff"}
                            onChange={(e) => updateLightColor("nodeColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.lightTheme.nodeColor || "#ffffff"}
                            onChange={(e) => updateLightColor("nodeColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dark Theme Group */}
              <div className="appearance-group">
                <div className="appearance-group-heading">深色主题</div>
                <div className="appearance-card">
                  <div className="appearance-item-row">
                    <span className="appearance-item-label">主题预设</span>
                    <div className="appearance-item-controls">
                      <button
                        type="button"
                        className="appearance-icon-btn"
                        onClick={resetDarkPreset}
                        title="重置为默认预设"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <select
                        className="appearance-select-control"
                        value={themeConfig.darkTheme.preset}
                        onChange={(e) => {
                          const nextPreset = e.target.value;
                          updateDarkThemePreset(nextPreset);
                          if (nextPreset === "custom") {
                            setShowDarkCustomColors(true);
                          }
                        }}
                      >
                        {Object.entries(darkPresets).map(([key, p]) => (
                          <option key={key} value={key}>{p.label}</option>
                        ))}
                        <option value="custom">自定义</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="appearance-collapse-toggle-btn"
                    onClick={() => setShowDarkCustomColors((v) => !v)}
                  >
                    <span>自定义颜色细节 ({showDarkCustomColors ? "点击收起" : "点击展开"})</span>
                    <ChevronDown
                      size={14}
                      style={{
                        transform: showDarkCustomColors ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 180ms ease"
                      }}
                    />
                  </button>

                  {showDarkCustomColors && (
                    <div className="appearance-custom-colors-wrap">
                      <div className="appearance-item-row">
                        <span className="appearance-item-label">背景颜色</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.darkTheme.bgColor}
                            onChange={(e) => updateDarkColor("bgColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.darkTheme.bgColor}
                            onChange={(e) => updateDarkColor("bgColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>

                      <div className="appearance-item-row">
                        <span className="appearance-item-label">前景文字</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.darkTheme.fgColor}
                            onChange={(e) => updateDarkColor("fgColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.darkTheme.fgColor}
                            onChange={(e) => updateDarkColor("fgColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>

                      <div className="appearance-item-row">
                        <span className="appearance-item-label">强调主色</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.darkTheme.accentColor}
                            onChange={(e) => updateDarkColor("accentColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.darkTheme.accentColor}
                            onChange={(e) => updateDarkColor("accentColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>

                      <div className="appearance-item-row">
                        <span className="appearance-item-label">节点背景颜色</span>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={themeConfig.darkTheme.nodeColor || "#121216"}
                            onChange={(e) => updateDarkColor("nodeColor", e.target.value)}
                          />
                          <input
                            type="text"
                            value={themeConfig.darkTheme.nodeColor || "#121216"}
                            onChange={(e) => updateDarkColor("nodeColor", e.target.value)}
                            className="color-hex-input"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="api-key-modal-footer">
              <button type="button" className="api-key-btn-cancel" onClick={resetTheme}>重置默认</button>
              <button type="button" className="api-key-btn-save" onClick={() => setShowAppearanceModal(false)}>完成</button>
            </div>
          </div>
        </div>
      )}

      {showStoragePathModal && (
        <div
          className="api-key-modal"
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => handleBackdropClick(e, () => setShowStoragePathModal(false))}
        >
          <div className="api-key-modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="api-key-modal-header">
              <h3>
                <FolderOpen size={18} />
                画板本地存储路径设置
              </h3>
              <button className="api-key-modal-close" type="button" onClick={() => setShowStoragePathModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="api-key-modal-body">
              <div className="storage-path-card" style={{ marginTop: 0 }}>
                <span className="storage-path-card-title">
                  <FolderOpen size={16} /> 当前数据保存目录
                </span>
                <div className="storage-path-input-group">
                  <input
                    type="text"
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    placeholder="本地存储目录绝对路径..."
                  />
                  <button
                    type="button"
                    className="storage-path-btn-primary"
                    onClick={() => void selectFolderAndSave()}
                    title="调起系统文件资源管理器窗口选择文件夹"
                  >
                    <FolderOpen size={14} />
                    更改目录
                  </button>
                  {customPathInput.trim() && customPathInput.trim() !== storagePathInfo?.dataDir ? (
                    <button
                      type="button"
                      className="storage-path-btn-apply"
                      onClick={() => void saveCustomStoragePath()}
                      title="应用手动粘贴的路径地址"
                    >
                      应用地址
                    </button>
                  ) : null}
                  <button type="button" className="storage-path-btn-default" onClick={() => void resetStoragePath()}>恢复默认</button>
                </div>
                <div className="storage-path-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="storage-path-btn-open"
                    onClick={() => void openLocalWorkspaceFolder(activeWorkspace?.id)}
                  >
                    <FolderOpen size={14} /> 在本地资源管理器打开画板工程文件
                  </button>
                  <button
                    type="button"
                    className="storage-path-btn-open"
                    onClick={() => void openLocalAudiosFolder()}
                    style={{ background: "#2563eb", color: "#ffffff", borderColor: "#3b82f6" }}
                  >
                    <FolderOpen size={14} /> 📂 打开生成的音频保存目录 (audios/)
                  </button>
                </div>
              </div>
            </div>
            <div className="api-key-modal-footer">
              <button type="button" className="api-key-btn-save" onClick={() => setShowStoragePathModal(false)}>完成</button>
            </div>
          </div>
        </div>
      )}

      {deleteModalState.isOpen && (
        <div
          className="api-key-modal"
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => handleBackdropClick(e, () => setDeleteModalState((s) => ({ ...s, isOpen: false })))}
        >
          <div
            className="api-key-modal-content"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="api-key-modal-header">
              <h3 style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} />
                {deleteModalState.title}
              </h3>
              <button
                className="api-key-modal-close"
                type="button"
                onClick={() => setDeleteModalState((s) => ({ ...s, isOpen: false }))}
              >
                <X size={18} />
              </button>
            </div>
            <div className="api-key-modal-body" style={{ padding: "20px 20px 10px 20px" }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-main, #f8fafc)" }}>
                {deleteModalState.message}
              </p>
            </div>
            <div className="api-key-modal-footer">
              <button
                type="button"
                className="api-key-btn-cancel"
                onClick={() => setDeleteModalState((s) => ({ ...s, isOpen: false }))}
              >
                取消
              </button>
              <button
                type="button"
                className="integrated-danger-btn"
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 8,
                  background: "#dc2626",
                  borderColor: "#dc2626",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
                onClick={() => void deleteModalState.onConfirm()}
              >
                <Trash2 size={15} />
                {deleteModalState.confirmLabel || "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section
        className={`studio-layout ${isResizingSidebar ? "is-resizing-active" : ""}`}
        style={{ gridTemplateColumns: sidebarCollapsed ? "50px 1fr" : `${sidebarWidth}px 12px 1fr` }}
      >
        <aside
          className={`board-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${!sidebarCollapsed && sidebarWidth < 250 ? "is-compact" : ""}`}
          style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
        >
          <div className="sidebar-title">
            <div className="sidebar-title-left">
              <PanelTop size={17} />
              <span>画板库</span>
            </div>
            <div className="sidebar-actions-group">
              {!sidebarCollapsed && (
                <button
                  className="sidebar-toggle folder-btn"
                  type="button"
                  onClick={() => void openLocalWorkspaceFolder(activeWorkspace?.id)}
                  title="在本地资源管理器中打开并选中画板存储文件"
                >
                  <FolderOpen size={14} />
                </button>
              )}
              <button
                className="sidebar-toggle"
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                title={sidebarCollapsed ? "展开画板库" : "折叠画板库"}
              >
                {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            </div>
          </div>
          {!sidebarCollapsed && (
            <>
              <button className="new-board" type="button" onClick={() => setBoardDialog("choice")}>
                <Plus size={16} />
                新建画板
              </button>
              <input
                type="file"
                ref={jsonFileInputRef}
                accept=".json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void importWorkspaceFile(file);
                  }
                  e.target.value = "";
                }}
              />

              <div className="board-list">
                {workspaces.map((workspace, index) => {
                  const isSelected = selectedWorkspaceIds.has(workspace.id);
                  const isActive = workspace.id === activeWorkspace?.id;
                  const itemClass = isActive
                    ? (isSelected ? "board-item active selected-multi" : "board-item active")
                    : (isSelected ? "board-item selected-multi" : "board-item");

                  return (
                    <div className="board-list-entry" key={workspace.id}>
                      <div className="board-item-header">
                        <button
                          className={itemClass}
                          type="button"
                          onClick={(e) => handleWorkspaceClick(e, workspace, index)}
                          title="Click 选中/加载 | Ctrl+Click 多选 | Shift+Click 连选"
                        >
                          <strong>
                            {workspace.type === "audiobook" ? <BookOpen size={14} style={{ marginRight: 6, verticalAlign: "middle" }} /> : null}
                            {workspace.name}
                          </strong>
                          <span>
                            {workspace.type === "audiobook"
                              ? `${workspace.characterCount ?? 0} 角色 / ${workspace.segmentCount ?? 0} 段落`
                              : `${workspace.nodeCount ?? 0} 节点 / ${workspace.edgeCount ?? 0} 连线`}
                          </span>
                        </button>
                        <div className="board-item-btn-grid">
                          <button
                            className="board-square-btn"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSaveAsModal(workspace);
                            }}
                            title="另存为新画板"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            className="board-square-btn"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              jsonFileInputRef.current?.click();
                            }}
                            title="打开本地画板json文件"
                          >
                            <FileJson size={13} />
                          </button>
                          <button
                            className="board-square-btn"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void exportWorkspaceAsTemplate(workspace.id);
                            }}
                            title="导出模板"
                          >
                            <LayoutTemplate size={13} />
                          </button>
                          <button
                            className="board-square-btn"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openExportModal(workspace.id);
                            }}
                            title="导出画板"
                          >
                            <FileDown size={13} />
                          </button>
                        </div>
                      </div>
                      {workspace.id === activeWorkspace?.id && activeWorkspace.type === "board" && activeWorkspace.stashItems.length > 0 ? (
                        <StashPanel
                          isOpen={isStashOpen}
                          items={activeWorkspace.stashItems}
                          workspaceName={activeWorkspace.name}
                          onBatchDownload={() => void downloadStashZip()}
                          onDelete={deleteStashItem}
                          onToggle={() => setIsStashOpen((value) => !value)}
                          onConvertToRefAudio={createReferenceAudioFromData}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="sidebar-actions">
                <div className="sidebar-actions-row">
                  <button
                    className="subtle"
                    type="button"
                    onClick={() => void handleOptimizeCurrentWorkspace()}
                    title="整理并瘦身当前画板：将画板中的音频实体无损转存至本地 audios/ 目录并大幅释放内存"
                    style={{ color: "#38bdf8" }}
                  >
                    <Sparkles size={14} />
                    整理瘦身
                  </button>
                  <button
                    className="subtle"
                    type="button"
                    onClick={() => void openLocalAudiosFolder()}
                    title="在资源管理器中打开生成的音频保存目录 (audios/)"
                  >
                    <FolderOpen size={14} />
                    音频目录
                  </button>
                  <button
                    className="subtle"
                    type="button"
                    onClick={() => openExportModal()}
                    disabled={workspaces.length === 0}
                    title={
                      selectedWorkspaceIds.size > 0
                        ? `导出选中的 ${selectedWorkspaceIds.size} 个画板`
                        : "导出画板"
                    }
                  >
                    <FileDown size={15} />
                    {selectedWorkspaceIds.size > 0 ? `导出 (${selectedWorkspaceIds.size})` : "导出画板"}
                  </button>
                </div>
                <button
                  className="danger subtle sidebar-btn-full"
                  type="button"
                  onClick={
                    selectedWorkspaceIds.size > 0
                      ? promptBatchDeleteWorkspaces
                      : promptDeleteCurrentWorkspace
                  }
                  disabled={selectedWorkspaceIds.size === 0 && !activeWorkspace}
                  title={
                    selectedWorkspaceIds.size > 0
                      ? `删除选中的 ${selectedWorkspaceIds.size} 个画板`
                      : "删除当前画板"
                  }
                >
                  <Trash2 size={16} />
                  {selectedWorkspaceIds.size > 0 ? `删除选中的 ${selectedWorkspaceIds.size} 项画板` : "删除画板"}
                </button>
              </div>
            </>
          )}
        </aside>

        {!sidebarCollapsed && (
          <div
            className={`sidebar-resizer ${isResizingSidebar ? "is-resizing" : ""}`}
            onMouseDown={handleSidebarResizeStart}
            onDoubleClick={handleSidebarResetWidth}
            title="按住左右拖拽调节侧边栏宽度 (双击重置为 280px)"
          >
            <div className="sidebar-resizer-line" />
          </div>
        )}

        {activeWorkspace?.type === "audiobook" ? (
          <AudiobookConsole
            workspace={activeWorkspace}
            apiKey={apiKey}
            apiEndpoint={apiEndpoint}
            onPatch={patchAudiobook}
            onAddChapter={addAudiobookChapter}
            onActivateChapter={(chapterId) => void activateAudiobookChapter(chapterId)}
            onCreateCharacter={createAudiobookCharacter}
            onAnalyze={analyzeAudiobookCharacters}
            onGenerateVoice={(charId) => void generateCharacterVoice(charId)}
            onDeleteVoice={(charId) => void deleteCharacterVoice(charId)}
            onAutoAnnotate={autoAnnotateAudiobook}
            onUpdateSegment={(segId, patch) => void updateAudiobookSegment(segId, patch)}
            onSaveWorkspace={saveWorkspace}
            onGenerate={generateAudiobookAudio}
            onRetryProduct={retryAudiobookProduct}
          />
        ) : (
          <section className="canvas-panel">
            <div className="canvas-titlebar">
              <div className="canvas-titlebar-left">
                <input
                  value={activeWorkspace?.name ?? ""}
                  onChange={(event) => patchWorkspaceName(event.target.value)}
                  onBlur={() => void saveWorkspace()}
                  placeholder="未命名工作台"
                />
                <span>右键添加节点；拖拽空白处框选；Ctrl/Cmd+Z / Y 撤销、重做；Ctrl/Cmd+C、X、V 复制、剪切、粘贴；Delete / Backspace 删除节点</span>
              </div>
              <div className="canvas-titlebar-right">
                <button
                  type="button"
                  className="canvas-titlebar-btn"
                  onClick={() => tidyWorkspaceNodes()}
                  title={selectedNodesCount >= 2 ? `一键整理当前框选的 ${selectedNodesCount} 个节点排版` : "根据依赖自动整理并优雅排布画布节点"}
                >
                  <LayoutGrid size={15} />
                  {selectedNodesCount >= 2 ? `框选排版 (${selectedNodesCount})` : "整齐排版"}
                </button>
                <button type="button" className="canvas-titlebar-btn" onClick={() => setShowNodeSearchModal(true)} title="搜索并快速平滑聚焦节点 (Ctrl+F)">
                  <Search size={15} />
                  搜索节点
                </button>
              </div>
            </div>
            <div
              className="flow-wrap"
              ref={flowWrapRef}
              onMouseDown={handleFlowMouseDown}
              onMouseMove={handleFlowMouseMove}
              onContextMenu={openContextMenu}
            >
              <ReactFlow<StudioNode, StudioEdge>
                nodes={hydratedNodes}
                edges={hydratedEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onlyRenderVisibleElements={false}
                elevateNodesOnSelect={false}
                nodesDraggable={true}
                elementsSelectable={true}
                nodeDragThreshold={1}
                onInit={(instance) => {
                  flowRef.current = instance;
                }}
                onNodesChange={handleCustomNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                onNodeDragStop={onNodeDragStop}
                snapToGrid={false}
                connectionRadius={30}
                selectionOnDrag
                panOnDrag={[1, 2]}
                multiSelectionKeyCode={["Control", "Meta"]}
                deleteKeyCode={["Delete", "Backspace"]}
                onNodesDelete={() => {
                  saveTimerRef.current = window.setTimeout(() => { void saveWorkspace(); }, 100);
                }}
                onEdgesDelete={() => {
                  saveTimerRef.current = window.setTimeout(() => { void saveWorkspace(); }, 100);
                }}
                minZoom={0.1}
                maxZoom={10}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#3f3a2d" gap={34} size={1.2} variant={BackgroundVariant.Dots} />
                <Controls />
                <MiniMap pannable zoomable nodeColor={(node) => (node.type && NODE_COLOR_MAP[node.type]) || "#c5a45d"} maskColor="rgba(8, 8, 7, 0.72)" />
              </ReactFlow>
              {menu ? (
                <ContextMenu
                  menu={menu}
                  onAdd={addNode}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={undoStackRef.current.length > 0}
                  canRedo={redoStackRef.current.length > 0}
                  selectedCount={selectedNodesCount}
                  onTidySelection={() => {
                    setMenu(null);
                    tidyWorkspaceNodes(true);
                  }}
                />
              ) : null}
            </div>
          </section>
        )}
      </section>
      {boardDialog ? (
        <BoardCreateDialog
          mode={boardDialog}
          onClose={() => setBoardDialog(null)}
          onCreateBlank={() => {
            setBoardDialog(null);
            void createWorkspace();
          }}
          onCreateSmart={createSmartWorkspace}
          onCreateAudiobook={async (data) => {
            await createAudiobookWorkspace(data);
          }}
          onImportFile={(file) => {
            setBoardDialog(null);
            void importWorkspaceFile(file);
          }}
          onUseTemplate={async (templateId) => {
            setBoardDialog(null);
            const res = await fetch(`/api/templates/${templateId}/use`, { method: "POST" });
            const ws = (await res.json()) as WorkspacePayload & { error?: string };
            if (!res.ok) {
              alert(ws.error || "使用模板失败");
              return;
            }
            await loadWorkspaceList(ws.id);
          }}
          onSwitchMode={setBoardDialog}
        />
      ) : null}
      {saveAsTargetWorkspace ? (
        <SaveAsModal
          workspace={saveAsTargetWorkspace}
          onClose={() => setSaveAsTargetWorkspace(null)}
          onConfirm={(newName) => duplicateWorkspaceById(saveAsTargetWorkspace.id, newName)}
        />
      ) : null}
      {saveAsTemplateWorkspace ? (
        <SaveAsTemplateModal
          workspace={saveAsTemplateWorkspace}
          onClose={() => setSaveAsTemplateWorkspace(null)}
          onConfirm={(name, description) => saveWorkspaceAsTemplate(name, description)}
        />
      ) : null}
      {showExportModal ? (
        <ExportWorkspaceModal
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          initialSelectedIds={selectedWorkspaceIds}
          initialTargetId={exportInitialTargetId}
          onClose={() => {
            setShowExportModal(false);
            setExportInitialTargetId(undefined);
          }}
          onSaveActiveWorkspace={saveWorkspace}
          onShowToast={showToast}
        />
      ) : null}
      {showNodeSearchModal && (
        <NodeSearchModal
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onClose={() => setShowNodeSearchModal(false)}
          onSelectNode={handleSelectSearchNode}
        />
      )}
      {appToast && (
        <div className="global-app-toast" onClick={(e) => e.stopPropagation()}>
          <CheckCircle2 size={18} style={{ color: "#10b981", flexShrink: 0 }} />
          <span className="global-app-toast-text">{appToast.text}</span>
          {appToast.actionText && appToast.onAction && (
            <button
              type="button"
              className="global-app-toast-btn"
              onClick={() => {
                appToast.onAction?.();
                setAppToast(null);
              }}
            >
              {appToast.actionText}
            </button>
          )}
          <button
            type="button"
            className="global-app-toast-close"
            onClick={() => setAppToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </main>
  );
}

function BoardCreateDialog({
  mode,
  onClose,
  onCreateBlank,
  onCreateSmart,
  onCreateAudiobook,
  onImportFile,
  onUseTemplate,
  onSwitchMode
}: {
  mode: "choice" | "templates" | "smart" | "audiobook";
  onClose: () => void;
  onCreateBlank: () => void;
  onCreateSmart: (formData: FormData) => Promise<void>;
  onCreateAudiobook: (data: { novelText: string; characterHints: string }) => Promise<void>;
  onImportFile: (file: File) => void;
  onUseTemplate: (templateId: string) => Promise<void>;
  onSwitchMode: (mode: "choice" | "templates" | "smart" | "audiobook") => void;
}) {
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [sceneDescription, setSceneDescription] = useState("");
  const [script, setScript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [isCreatingAudiobook, setIsCreatingAudiobook] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  // 有声书表单状态
  const [novelText, setNovelText] = useState("");
  const [characterHints, setCharacterHints] = useState("");
  // 模板管理状态
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode === "templates") {
      setLoadingTemplates(true);
      void fetch("/api/templates")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setTemplates(data);
        })
        .finally(() => setLoadingTemplates(false));
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      stopRecordingStream();
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  const progressStages = [
    { percent: 15, text: "正在读取..." },
    { percent: 35, text: "正在分析情感..." },
    { percent: 55, text: "正在规划画板..." },
    { percent: 75, text: "画板创建中..." },
    { percent: 90, text: "正在收尾..." },
    { percent: 95, text: "马上就好了..." }
  ];

  const audiobookProgressStages = [
    { percent: 12, text: "正在连接文段切分模型..." },
    { percent: 28, text: "正在阅读小说原文..." },
    { percent: 45, text: "正在识别旁白和角色对话..." },
    { percent: 62, text: "正在拆分单一说话人片段..." },
    { percent: 82, text: "正在整理有声书结构..." },
    { percent: 95, text: "即将创建画板..." }
  ];

  function startProgressSimulation(stages = progressStages, initialText = "正在连接 AI 服务...") {
    setProgress(0);
    setProgressText(initialText);
    let stageIndex = 0;

    function advance() {
      if (stageIndex < stages.length) {
        const stage = stages[stageIndex];
        setProgress(stage.percent);
        setProgressText(stage.text);
        stageIndex++;
        const delay = 3000 + Math.random() * 2000;
        progressTimerRef.current = window.setTimeout(advance, delay);
      }
    }

    progressTimerRef.current = window.setTimeout(advance, 500);
  }

  function stopProgressSimulation(finalProgress: number) {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(finalProgress);
  }

  async function setSmartVoiceFile(file: File) {
    if (!allowedAudioTypes.has(file.type) && !/\.(mp3|m4a|mp4|wav)$/i.test(file.name)) {
      setError("仅支持 mp3、m4a/mp4 或 wav 参考音频。");
      return;
    }

    if (file.size > maxAudioBytes) {
      setError(`参考音频不能超过 ${formatBytes(maxAudioBytes)}。`);
      return;
    }

    setVoiceFile(file);
    setVoicePreviewUrl(await blobToDataUrl(file));
    setError(null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void setSmartVoiceFile(file);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持录音，请改用上传音频文件。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsRecording(true);
      setError(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        void commitRecording(recorder.mimeType || mimeType || "audio/webm");
      };
      recorder.start();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);
    } catch (recordingError) {
      stopRecordingStream();
      setIsRecording(false);
      setError(recordingError instanceof Error ? recordingError.message : "录音启动失败。");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
    stopRecordingTimer();
  }

  async function commitRecording(mimeType: string) {
    const chunks = recordingChunksRef.current;
    recordingChunksRef.current = [];
    stopRecordingStream();

    if (chunks.length === 0) {
      setError("没有录到有效音频。");
      return;
    }

    try {
      const recordedBlob = new Blob(chunks, { type: mimeType });
      const wavBlob = await convertRecordedBlobToWav(recordedBlob);
      const fileName = `smart-reference-${formatDateForFile(new Date())}.wav`;
      const file = new File([wavBlob], fileName, { type: "audio/wav" });
      await setSmartVoiceFile(file);
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : "录音处理失败。");
    }
  }

  function stopRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  }

  async function submitSmartWorkspace() {
    const paragraphs = splitScriptInput(script);
    if (!sceneDescription.trim()) {
      setError("请填写场景描述。");
      return;
    }
    if (paragraphs.length === 0) {
      setError("请填写台词文稿，并使用 ---- 分隔独立段落。");
      return;
    }

    setIsGenerating(true);
    setError(null);
    startProgressSimulation();
    try {
      const formData = new FormData();
      if (voiceFile) {
        formData.append("voice", voiceFile);
      }
      formData.append("sceneDescription", sceneDescription.trim());
      formData.append("script", script.trim());
      await onCreateSmart(formData);
      stopProgressSimulation(100);
      setProgressText("我正在全速处理");
      await new Promise((resolve) => setTimeout(resolve, 500));
      onClose();
    } catch (submitError) {
      stopProgressSimulation(0);
      setError(submitError instanceof Error ? submitError.message : "智能画板生成失败。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitAudiobookWorkspace() {
    if (!novelText.trim()) {
      setError("请输入小说原文。");
      return;
    }

    setIsCreatingAudiobook(true);
    setError(null);
    startProgressSimulation(audiobookProgressStages, "正在连接文段切分模型...");
    try {
      await onCreateAudiobook({ novelText: novelText.trim(), characterHints: characterHints.trim() });
      stopProgressSimulation(100);
      setProgressText("有声书创建完成");
      await new Promise((resolve) => setTimeout(resolve, 500));
      onClose();
    } catch (submitError) {
      stopProgressSimulation(0);
      setError(submitError instanceof Error ? submitError.message : "创建有声书失败。");
    } finally {
      setIsCreatingAudiobook(false);
    }
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          if (!isGenerating && !isCreatingAudiobook) onClose();
        }
      }}
    >
      <section className="board-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <strong>{mode === "choice" ? "新建画板" : mode === "templates" ? "模板库建板" : mode === "smart" ? "智能画板" : "智能有声书"}</strong>
            <span>{mode === "choice" ? "选择创建方式或导入文件" : mode === "templates" ? "从预置模板或自定义模板直接快速创建工作流" : mode === "smart" ? "根据场景、文稿和可选参考音频生成工作流" : "输入小说原文和人物信息，AI自动创建角色音色并生成有声书"}</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭" disabled={isGenerating || isCreatingAudiobook}>
            ×
          </button>
        </header>

        {mode === "choice" ? (
          <div className="create-choice-grid">
            <button type="button" onClick={onCreateBlank}>
              <PanelTop size={18} />
              <span>空白画板</span>
              <small>创建一个全新的空白画板</small>
            </button>
            <button type="button" onClick={() => onSwitchMode("templates")}>
              <LayoutTemplate size={18} />
              <span>从模板新建</span>
              <small>选择广播剧、情绪测试等预置/自定义模板</small>
            </button>
            <button type="button" onClick={() => onSwitchMode("smart")}>
              <Sparkles size={18} />
              <span>智能画板</span>
              <small>有参考音频生成克隆，无参考音频生成设计</small>
            </button>
            <button type="button" onClick={() => onSwitchMode("audiobook")}>
              <BookOpen size={18} />
              <span>智能有声书</span>
              <small>自动分析小说文案角色音色并连贯生成</small>
            </button>
            <label className="create-choice-import-button">
              <input
                type="file"
                accept=".json,.mimotts.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportFile(file);
                }}
              />
              <FileJson size={18} />
              <span>导入画板文件</span>
              <small>从 .mimotts.json 文件导入项目</small>
            </label>
          </div>
        ) : mode === "templates" ? (
          <div className="templates-modal-panel">
            {loadingTemplates ? (
              <p className="node-muted"><Loader2 className="spin" size={16} /> 正在加载模板库...</p>
            ) : templates.length === 0 ? (
              <p className="node-muted">暂无模版</p>
            ) : (
              <div className="template-grid">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="template-card">
                    <div className="template-card-header">
                      <strong>{tpl.name}</strong>
                      <span className="template-badge">{tpl.isBuiltIn ? "内置预设" : "自定义模板"}</span>
                    </div>
                    <p>{tpl.description}</p>
                    <div className="template-card-actions">
                      <button className="run-button" type="button" onClick={() => void onUseTemplate(tpl.id)}>
                        <Plus size={14} />
                        使用此模板
                      </button>
                      {!tpl.isBuiltIn && (
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => {
                            if (window.confirm(`确认删除模板「${tpl.name}」？`)) {
                              void fetch(`/api/templates/${tpl.id}`, { method: "DELETE" }).then(() => {
                                setTemplates((list) => list.filter((t) => t.id !== tpl.id));
                              });
                            }
                          }}
                          title="删除模板"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => onSwitchMode("choice")}>
                返回
              </button>
            </div>
          </div>
        ) : mode === "smart" ? (
          <div className="smart-board-form">
            <label className="file-picker nodrag">
              <input accept="audio/*,video/mp4,.mp3,.m4a,.mp4,.wav" type="file" onChange={onFileChange} />
              <span>{voiceFile ? voiceFile.name : "上传参考音频（可选）"}</span>
              <small>{voiceFile ? `${voiceFile.type || "audio"} · ${formatBytes(voiceFile.size)}` : "不上传时，将使用音色创造节点生成每段音频"}</small>
            </label>
            <div className="recording-panel nodrag">
              <button className={isRecording ? "record-button recording" : "record-button"} type="button" onClick={() => void startRecording()} disabled={isRecording || isGenerating}>
                <Mic2 size={15} />
                开始录制
              </button>
              <button className="record-stop-button" type="button" onClick={stopRecording} disabled={!isRecording || isGenerating}>
                <Square size={13} />
                停止
              </button>
              <span>{isRecording ? `录制中 ${formatTime(recordingSeconds)}` : "当场录制参考音频"}</span>
            </div>
            {voicePreviewUrl ? <StudioAudioPlayer src={voicePreviewUrl} /> : null}
            <label className="node-field">
              <span>场景描述</span>
              <textarea value={sceneDescription} onChange={(event) => setSceneDescription(event.target.value)} rows={4} placeholder="用简单的关键词去描述这段文本的语境语气并补充必要的信息，帮助模型理解需求" />
            </label>
            <label className="node-field">
              <span>完整台词文稿</span>
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                rows={8}
                placeholder="这里输入需要模型朗读的内容，段落使用 ---- 分割，每段建议小于100字"
              />
            </label>
            {error ? <p className="node-error">{error}</p> : null}
            {isGenerating && (
              <div className="smart-progress">
                <div className="smart-progress-bar">
                  <div className="smart-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="smart-progress-text">{progressText}</p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => onSwitchMode("choice")} disabled={isGenerating}>
                返回
              </button>
              <button className="run-button" type="button" onClick={() => void submitSmartWorkspace()} disabled={isGenerating || isRecording}>
                {isGenerating ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                {isGenerating ? "生成中" : "生成智能画板"}
              </button>
            </div>
          </div>
        ) : (
          <div className="smart-board-form">
            <label className="node-field">
              <span>小说原文</span>
              <textarea
                value={novelText}
                onChange={(event) => setNovelText(event.target.value)}
                rows={10}
                placeholder="粘贴小说原文，AI 会按旁白和角色对话切分片段"
                disabled={isCreatingAudiobook}
              />
            </label>
            <label className="node-field">
              <span>关键人物背景信息</span>
              <textarea
                value={characterHints}
                onChange={(event) => setCharacterHints(event.target.value)}
                rows={4}
                placeholder={"每行一个角色，格式：角色名，性别，年龄，声音特点\n例如：林黛玉，女，16岁，声音清脆柔弱，略带哀愁"}
                disabled={isCreatingAudiobook}
              />
            </label>
            {error ? <p className="node-error">{error}</p> : null}
            {isCreatingAudiobook && (
              <div className="smart-progress">
                <div className="smart-progress-bar">
                  <div className="smart-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="smart-progress-text">{progressText}</p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => onSwitchMode("choice")} disabled={isCreatingAudiobook}>
                返回
              </button>
              <button
                className="run-button"
                type="button"
                onClick={() => void submitAudiobookWorkspace()}
                disabled={isCreatingAudiobook}
              >
                {isCreatingAudiobook ? <Loader2 className="spin" size={16} /> : <BookOpen size={16} />}
                {isCreatingAudiobook ? "切分中..." : "创建有声书"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ====== 有声书控制台组件 ======

function AudiobookConsole({
  workspace,
  apiKey,
  apiEndpoint,
  onPatch,
  onAddChapter,
  onActivateChapter,
  onCreateCharacter,
  onAnalyze,
  onGenerateVoice,
  onDeleteVoice,
  onAutoAnnotate,
  onUpdateSegment,
  onSaveWorkspace,
  onGenerate,
  onRetryProduct
}: {
  workspace: AudiobookWorkspacePayload;
  apiKey: string;
  apiEndpoint: string;
  onPatch: (patch: Partial<AudiobookWorkspacePayload>) => void;
  onAddChapter: (data: { title: string; novelText: string; characterHints: string }) => Promise<void>;
  onActivateChapter: (chapterId: string) => void;
  onCreateCharacter: (formData: FormData) => Promise<void>;
  onAnalyze: () => Promise<void>;
  onGenerateVoice: (charId: string) => void;
  onDeleteVoice: (charId: string) => void;
  onAutoAnnotate: () => Promise<void>;
  onUpdateSegment: (segId: string, patch: { characterId: string | null; characterName: string; emotion: string }) => void;
  onSaveWorkspace: () => Promise<void>;
  onGenerate: () => Promise<void>;
  onRetryProduct: (productId: string) => Promise<void>;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeText, setAnalyzeText] = useState("");
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editCharId, setEditCharId] = useState<string>("");
  const [editEmotion, setEditEmotion] = useState("");
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotateProgress, setAnnotateProgress] = useState(0);
  const [annotateText, setAnnotateText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterText, setChapterText] = useState("");
  const [chapterHints, setChapterHints] = useState("");
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [characterRoleType, setCharacterRoleType] = useState<AudiobookCharacter["roleType"]>("supporting");
  const [characterVoiceMode, setCharacterVoiceMode] = useState<AudiobookCharacter["voiceMode"]>("designed");
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterTraits, setCharacterTraits] = useState("");
  const [characterAliases, setCharacterAliases] = useState("");
  const [characterVoiceFile, setCharacterVoiceFile] = useState<File | null>(null);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const productSectionRef = useRef<HTMLDivElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const runningActionRef = useRef<"analyze" | "annotate" | "generate" | null>(null);

  const allVoicesReady = workspace.characters.length > 0 && workspace.characters.every((c) => c.voiceStatus === "ready");
  const hasAnnotations = workspace.segments.some((s) => s.characterId || s.characterName);
  const hasUsedAutoAnnotation = workspace.segments.some((s) => s.isAutoAnnotated);
  const showProductSection = isGenerating || workspace.phase === "generation" || workspace.products.length > 0;
  const allProductsReady = workspace.products.length > 0 && workspace.products.every((product) => product.status === "ready" && product.audioDataUrl);
  const activeChapter = workspace.chapters.find((chapter) => chapter.id === workspace.activeChapterId) ?? workspace.chapters[0];
  const narrator = workspace.characters.find((character) => character.roleType === "narrator");

  useEffect(() => {
    if (!isGenerating) {
      return;
    }
    window.requestAnimationFrame(() => {
      productSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isGenerating]);

  function startProgress(
    setProgress: (v: number) => void,
    setText: (v: string) => void,
    stages: { percent: number; text: string }[]
  ) {
    let stageIndex = 0;
    let currentPercent = 5;
    setProgress(5);
    setText(stages[0]?.text || "处理中...");
    function advance() {
      if (stageIndex < stages.length) {
        currentPercent = stages[stageIndex].percent;
        setProgress(currentPercent);
        setText(stages[stageIndex].text);
        stageIndex++;
        progressTimerRef.current = window.setTimeout(advance, 2000 + Math.random() * 2000);
      } else {
        // 模拟阶段结束，继续缓慢脉冲动画直到 stopProgress 被调用
        const base = currentPercent;
        const pulse = Math.min(base + 2 + Math.random() * 3, 95);
        setProgress(pulse);
        progressTimerRef.current = window.setTimeout(() => {
          setProgress(base);
          progressTimerRef.current = window.setTimeout(advance, 3000 + Math.random() * 2000);
        }, 1500);
      }
    }
    progressTimerRef.current = window.setTimeout(advance, 800);
  }

  function stopProgress(finalProgress: number, setProgress: (v: number) => void) {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(finalProgress);
  }

  async function handleAnalyze() {
    if (runningActionRef.current) {
      return;
    }
    runningActionRef.current = "analyze";
    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    startProgress(setAnalyzeProgress, setAnalyzeText, [
      { percent: 15, text: "正在连接 AI 服务..." },
      { percent: 35, text: "正在阅读小说原文..." },
      { percent: 55, text: "识别出场人物..." },
      { percent: 75, text: "生成角色描述..." },
      { percent: 90, text: "生成音色描述..." },
      { percent: 95, text: "即将完成..." }
    ]);
    try {
      await onAnalyze();
      stopProgress(100, setAnalyzeProgress);
      setAnalyzeText("分析完成！");
    } catch {
      stopProgress(0, setAnalyzeProgress);
      setAnalyzeText("分析失败，请重试");
    } finally {
      setTimeout(() => {
        runningActionRef.current = null;
        setIsAnalyzing(false);
      }, 500);
    }
  }

  async function handleAutoAnnotate() {
    if (runningActionRef.current || hasUsedAutoAnnotation) {
      return;
    }
    runningActionRef.current = "annotate";
    setIsAnnotating(true);
    setAnnotateProgress(0);
    startProgress(setAnnotateProgress, setAnnotateText, [
      { percent: 15, text: "正在连接 AI 服务..." },
      { percent: 35, text: "分析段落内容..." },
      { percent: 55, text: "识别对话角色..." },
      { percent: 75, text: "生成朗读情绪..." },
      { percent: 90, text: "整理标注结果..." },
      { percent: 95, text: "即将完成..." }
    ]);
    try {
      await onAutoAnnotate();
      stopProgress(100, setAnnotateProgress);
      setAnnotateText("标注完成！");
    } catch {
      stopProgress(0, setAnnotateProgress);
      setAnnotateText("标注失败，请重试");
    } finally {
      setTimeout(() => {
        runningActionRef.current = null;
        setIsAnnotating(false);
      }, 500);
    }
  }

  async function handleGenerate() {
    if (runningActionRef.current) {
      return;
    }
    runningActionRef.current = "generate";
    setIsGenerating(true);
    try {
      await onSaveWorkspace();
      await onGenerate();
    } catch (error) {
      console.error("[audiobook:generate] failed", error);
    } finally {
      setTimeout(() => {
        runningActionRef.current = null;
        setIsGenerating(false);
      }, 500);
    }
  }

  async function handleRetryProduct(productId: string) {
    await onRetryProduct(productId);
  }

  async function handleAddChapter() {
    if (!chapterText.trim() || isAddingChapter) {
      return;
    }
    setIsAddingChapter(true);
    try {
      await onAddChapter({
        title: chapterTitle.trim() || `章节 ${workspace.chapters.length + 1}`,
        novelText: chapterText,
        characterHints: chapterHints
      });
      setChapterTitle("");
      setChapterText("");
      setChapterHints("");
    } finally {
      setIsAddingChapter(false);
    }
  }

  async function handleCreateCharacter() {
    if (!characterName.trim() || isCreatingCharacter) {
      return;
    }
    setIsCreatingCharacter(true);
    try {
      const formData = new FormData();
      formData.append("name", characterName.trim());
      formData.append("roleType", characterRoleType);
      formData.append("aliases", characterAliases);
      formData.append("voiceTraits", characterTraits);
      formData.append("voiceDescription", characterDescription);
      formData.append("personality", characterTraits || characterDescription);
      if (characterVoiceMode === "cloned" && characterVoiceFile) {
        formData.append("voice", characterVoiceFile);
      }
      await onCreateCharacter(formData);
      setCharacterName("");
      setCharacterRoleType("supporting");
      setCharacterVoiceMode("designed");
      setCharacterDescription("");
      setCharacterTraits("");
      setCharacterAliases("");
      setCharacterVoiceFile(null);
    } finally {
      setIsCreatingCharacter(false);
    }
  }

  async function downloadAudiobookProductsZip() {
    if (!allProductsReady) {
      return;
    }

    const zip = new JSZip();
    const usedNames = new Map<string, number>();
    workspace.products.forEach((product, index) => {
      if (!product.audioDataUrl) {
        return;
      }
      const indexLabel = String(index + 1).padStart(2, "0");
      const characterName = sanitizeFileName(product.characterName || "旁白").replace(/\.[a-z0-9]{1,8}$/i, "");
      const fileName = getUniqueFileName(`segment-${indexLabel}-${characterName}.wav`, usedNames);
      zip.file(fileName, dataUrlToUint8Array(product.audioDataUrl));
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(workspace.name)}-${formatDateForFile(new Date())}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function startEditSegment(segId: string) {
    const seg = workspace.segments.find((s) => s.id === segId);
    if (seg) {
      setEditingSegId(segId);
      setEditCharId(seg.characterId || narrator?.id || "");
      setEditEmotion(seg.emotion);
    }
  }

  function saveEditSegment() {
    if (!editingSegId) return;
    const char = workspace.characters.find((c) => c.id === editCharId);
    onUpdateSegment(editingSegId, {
      characterId: editCharId || narrator?.id || null,
      characterName: char?.name || "旁白",
      emotion: editEmotion
    });
    setEditingSegId(null);
  }

  return (
    <section className="audiobook-panel">
      <div className="audiobook-titlebar">
        <BookOpen size={16} />
        <input
          value={workspace.name}
          onChange={(event) => onPatch({ name: event.target.value })}
          placeholder="未命名有声书"
        />
        <span className="audiobook-phase-badge">
          {workspace.phase === "character-creation" ? "角色创建" : workspace.phase === "annotation" ? "文本标注" : "语音生成"}
        </span>
      </div>

      <div className="audiobook-body">
        <div className="audiobook-section">
          <div className="section-header">
            <h3>章节项目</h3>
            <span className="section-hint inline">当前：{activeChapter?.title || "未命名章节"}</span>
          </div>
          <div className="chapter-tabs">
            {workspace.chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                type="button"
                className={chapter.id === workspace.activeChapterId ? "chapter-tab active" : "chapter-tab"}
                onClick={() => onActivateChapter(chapter.id)}
              >
                <BookOpen size={13} />
                {chapter.title || `章节 ${index + 1}`}
              </button>
            ))}
          </div>
          <div className="chapter-create-panel">
            <input
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              placeholder={`章节 ${workspace.chapters.length + 1}`}
            />
            <textarea
              value={chapterText}
              onChange={(event) => setChapterText(event.target.value)}
              placeholder="粘贴下一章或新的小说片段，系统会加入当前书籍项目并复用音色库"
              rows={4}
            />
            <textarea
              value={chapterHints}
              onChange={(event) => setChapterHints(event.target.value)}
              placeholder="可选：本章新增人物说明，每行一个角色"
              rows={2}
            />
            <button className="run-button" type="button" onClick={() => void handleAddChapter()} disabled={isAddingChapter || !chapterText.trim()}>
              {isAddingChapter ? <Loader2 className="spin" size={14} /> : <BookPlus size={14} />}
              {isAddingChapter ? "新增中..." : "添加章节"}
            </button>
          </div>
        </div>

        <div className="audiobook-section">
          <div className="section-header">
            <h3>书籍音色库</h3>
            {narrator ? <span className="section-hint inline">旁白：{narrator.voiceStatus === "ready" ? "已准备" : "待生成"}</span> : null}
          </div>
          <div className="manual-character-panel">
            <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} placeholder="音色角色名称，如：主角 / 特邀主播A" />
            <select value={characterRoleType} onChange={(event) => setCharacterRoleType(event.target.value as AudiobookCharacter["roleType"])}>
              <option value="protagonist">主角</option>
              <option value="supporting">配角</option>
              <option value="narrator">旁白</option>
              <option value="custom">自定义</option>
            </select>
            <select value={characterVoiceMode} onChange={(event) => setCharacterVoiceMode(event.target.value as AudiobookCharacter["voiceMode"])}>
              <option value="designed">自然语言音色设计</option>
              <option value="cloned">上传参考音频克隆</option>
            </select>
            <input value={characterAliases} onChange={(event) => setCharacterAliases(event.target.value)} placeholder="别名/称呼，可用逗号分隔" />
            <textarea value={characterTraits} onChange={(event) => setCharacterTraits(event.target.value)} placeholder="性格、身份、声音特点" rows={2} />
            {characterVoiceMode === "designed" ? (
              <textarea value={characterDescription} onChange={(event) => setCharacterDescription(event.target.value)} placeholder="音色描述：男女老少、声音质感、气质等" rows={2} />
            ) : (
              <label className="upload-row">
                <FileAudio size={14} />
                <span>{characterVoiceFile ? characterVoiceFile.name : "上传参考音频"}</span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/wav,audio/wave,video/mp4"
                  onChange={(event) => setCharacterVoiceFile(event.target.files?.[0] ?? null)}
                />
              </label>
            )}
            <button className="run-button" type="button" onClick={() => void handleCreateCharacter()} disabled={isCreatingCharacter || !characterName.trim()}>
              {isCreatingCharacter ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
              {isCreatingCharacter ? "创建中..." : "创建音色角色"}
            </button>
          </div>
        </div>

        {/* 角色创造区域 */}
        <div className="audiobook-section">
          <div className="section-header">
            <h3>角色创造</h3>
            {workspace.phase === "character-creation" && (
              <button className="run-button" type="button" onClick={() => void handleAnalyze()} disabled={isAnalyzing}>
                {isAnalyzing ? <Loader2 className="spin" size={14} /> : <Wand2 size={14} />}
                {isAnalyzing ? "分析中..." : "开始分析"}
              </button>
            )}
          </div>

          {isAnalyzing && (
            <div className="smart-progress">
              <div className="smart-progress-bar">
                <div className="smart-progress-fill" style={{ width: `${analyzeProgress}%` }} />
              </div>
              <p className="smart-progress-text">{analyzeText}</p>
            </div>
          )}

          {workspace.characters.length === 0 && !isAnalyzing && (
            <p className="section-hint">点击"开始分析"，AI将从小说原文中识别角色并生成音色描述。</p>
          )}

          <div className="character-grid">
            {workspace.characters.map((char) => (
              <div key={char.id} className="character-card">
                <div className="character-info">
                  <strong>{char.name}</strong>
                  {char.gender && <span className="char-tag">{char.gender}</span>}
                  {char.age && <span className="char-tag">{char.age}</span>}
                  <p className="char-personality">{char.personality}</p>
                  <p className="char-voice-desc">{char.voiceDescription}</p>
                  {char.voiceSampleText && <p className="char-voice-sample">试听：{char.voiceSampleText}</p>}
                </div>
                <div className="character-voice">
                  {char.voiceStatus === "ready" && char.voiceDataUrl ? (
                    <>
                      <StudioAudioPlayer src={char.voiceDataUrl} />
                      <button className="icon-button" type="button" onClick={() => void onDeleteVoice(char.id)} title="重新生成">
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : char.voiceStatus === "generating" ? (
                    <span className="voice-status generating"><Loader2 className="spin" size={14} /> 生成中...</span>
                  ) : char.voiceStatus === "error" ? (
                    <span className="voice-status error">{char.voiceError || "生成失败"}</span>
                  ) : (
                    <button className="run-button" type="button" onClick={() => onGenerateVoice(char.id)}>
                      <AudioLines size={14} />
                      生成音色
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {workspace.phase === "character-creation" && allVoicesReady && (
            <button
              className="run-button phase-advance"
              type="button"
              onClick={() => onPatch({ phase: "annotation" })}
            >
              确认并进入标注
            </button>
          )}
        </div>

        {/* 标注区域 */}
        {workspace.phase !== "character-creation" && (
          <div className="audiobook-section">
            <div className="section-header">
              <h3>文本标注</h3>
              <div className="annotation-controls">
                <button
                  className="run-button"
                  type="button"
                  onClick={() => void handleAutoAnnotate()}
                  disabled={isAnnotating || hasUsedAutoAnnotation}
                  title={hasUsedAutoAnnotation ? "AI auto annotation can only be used once. Please edit manually." : undefined}
                >
                  {isAnnotating ? <Loader2 className="spin" size={14} /> : <Wand2 size={14} />}
                  {isAnnotating ? "标注中..." : "AI 自动标注"}
                </button>
              </div>
            </div>

            {isAnnotating && (
              <div className="smart-progress">
                <div className="smart-progress-bar">
                  <div className="smart-progress-fill" style={{ width: `${annotateProgress}%` }} />
                </div>
                <p className="smart-progress-text">{annotateText}</p>
              </div>
            )}

            <div className="segment-list">
              {workspace.segments.map((seg, index) => (
                <div key={seg.id} className="segment-block" onDoubleClick={() => startEditSegment(seg.id)}>
                  <div className="segment-header">
                    <span className="seg-index">#{index + 1}</span>
                    {seg.characterName && (
                      <span className="annotation-badge">
                        {seg.characterName}
                        {seg.emotion && ` · ${seg.emotion}`}
                      </span>
                    )}
                  </div>
                  <p className="segment-text">{seg.text}</p>
                  {editingSegId === seg.id && (
                    <div className="segment-editor">
                      <select value={editCharId} onChange={(e) => setEditCharId(e.target.value)}>
                        {workspace.characters.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editEmotion}
                        onChange={(e) => setEditEmotion(e.target.value)}
                        placeholder="朗读情绪（如：温柔地、焦急地）"
                      />
                      <button type="button" onClick={saveEditSegment}>确定</button>
                      <button type="button" onClick={() => setEditingSegId(null)}>取消</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {workspace.phase === "annotation" && hasAnnotations && !isGenerating && (
              <>
                <button className="run-button phase-advance" type="button" onClick={() => void handleGenerate()} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                  {isGenerating ? "生成中..." : "一键生成"}
                </button>
              </>
            )}
          </div>
        )}

        {/* 产物列表区域 */}
        {showProductSection && (
          <div className="audiobook-section" ref={productSectionRef}>
            <div className="section-header">
              <h3>产物列表</h3>
              <div className="product-toolbar">
                {allProductsReady && (
                  <button className="run-button" type="button" onClick={() => void downloadAudiobookProductsZip()}>
                    <Download size={14} />
                    批量下载 ZIP
                  </button>
                )}
                <button
                  className="run-button"
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
                  {isGenerating ? "生成中..." : "重新生成"}
                </button>
              </div>
            </div>
            <div className="product-list">
              {workspace.products.map((prod, index) => (
                <div key={prod.id} className="product-item">
                  <div className="product-info">
                    <span className="product-index">#{index + 1}</span>
                    <span className="product-char">{prod.characterName}</span>
                    <span className="product-text">{prod.text.slice(0, 50)}{prod.text.length > 50 ? "..." : ""}</span>
                  </div>
                  {prod.status === "ready" && prod.audioDataUrl ? (
                    <div className="product-actions">
                      <StudioAudioPlayer src={prod.audioDataUrl} />
                      <a
                        className="icon-button product-download-button"
                        href={prod.audioDataUrl}
                        download={getArtifactDownloadFileName(`segment-${index + 1}.wav`, "segment.wav", workspace.name)}
                        title="下载"
                      >
                        <Download size={14} />
                      </a>
                      <button className="icon-button" type="button" onClick={() => void handleRetryProduct(prod.id)} title="重新生成">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  ) : prod.status === "generating" ? (
                    <span className="voice-status generating"><Loader2 className="spin" size={14} /> 合成中...</span>
                  ) : prod.status === "error" ? (
                    <div className="product-actions">
                      <span className="voice-status error">{prod.error || "失败"}</span>
                      <button className="icon-button" type="button" onClick={() => void handleRetryProduct(prod.id)} title="重试生成">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="product-actions">
                      <span className="voice-status">等待中</span>
                      <button className="icon-button" type="button" onClick={() => void handleRetryProduct(prod.id)} title="生成当前片段">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const ReferenceAudioNode = memo(function ReferenceAudioNode({ id, data }: NodeProps<StudioNode>) {
  useAutoUpdateNodeInternals(id, [data.audioAssets?.length, data.audio]);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      stopRecordingStream();
    };
  }, []);

  function processAudioFiles(files: File[]) {
    if (files.length === 0) return;
    const validFiles = files.filter(
      (file) =>
        allowedAudioTypes.has(file.type) ||
        /\.(mp3|m4a|mp4|wav|aac|ogg|flac)$/i.test(file.name)
    );
    const oversized = validFiles.find((file) => file.size > maxAudioBytes);
    if (oversized) {
      data.onPatch?.(id, { error: `${oversized.name} 超过 ${formatBytes(maxAudioBytes)}，未添加。` });
      return;
    }
    if (validFiles.length === 0) {
      data.onPatch?.(id, { error: "仅支持 mp3、m4a/mp4 或 wav 参考音频文件。" });
      return;
    }
    void Promise.all(validFiles.map(fileToAudioAsset)).then((assets) => {
      const audioAssets = [...(data.audioAssets ?? (data.audio ? [data.audio] : [])), ...assets];
      data.onPatch?.(id, {
        audio: audioAssets[0],
        audioAssets,
        error: validFiles.length === files.length ? undefined : "部分不支持的文件未添加。"
      });
    });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    processAudioFiles(files);
  }

  function removeAudio(index: number) {
    const audioAssets = (data.audioAssets ?? (data.audio ? [data.audio] : [])).filter((_, itemIndex) => itemIndex !== index);
    data.onPatch?.(id, { audio: audioAssets[0], audioAssets, error: undefined });
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      data.onPatch?.(id, { error: "当前浏览器不支持录音，请改用上传音频文件。" });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsRecording(true);
      data.onPatch?.(id, { error: undefined });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        void commitRecording(recorder.mimeType || mimeType || "audio/webm");
      };
      recorder.start();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);
    } catch (error) {
      stopRecordingStream();
      setIsRecording(false);
      data.onPatch?.(id, { error: error instanceof Error ? error.message : "录音启动失败。" });
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
    stopRecordingTimer();
  }

  async function commitRecording(mimeType: string) {
    const chunks = recordingChunksRef.current;
    recordingChunksRef.current = [];
    stopRecordingStream();

    if (chunks.length === 0) {
      data.onPatch?.(id, { error: "没有录到有效音频。" });
      return;
    }

    try {
      const recordedBlob = new Blob(chunks, { type: mimeType });
      const wavBlob = await convertRecordedBlobToWav(recordedBlob);

      if (wavBlob.size > maxAudioBytes) {
        data.onPatch?.(id, { error: `录音文件不能超过 ${formatBytes(maxAudioBytes)}。请缩短录制时长。` });
        return;
      }

      const fileName = `recorded-reference-${formatDateForFile(new Date())}.wav`;
      const dataUrl = await blobToDataUrl(wavBlob);
      const asset: AudioAsset = {
        fileName,
        mimeType: "audio/wav",
        size: wavBlob.size,
        dataUrl
      };
      const audioAssets = [...(data.audioAssets ?? (data.audio ? [data.audio] : [])), asset];
      data.onPatch?.(id, {
        audio: audioAssets[0],
        audioAssets,
        error: undefined
      });
    } catch (error) {
      data.onPatch?.(id, { error: error instanceof Error ? error.message : "录音处理失败。" });
    }
  }

  function stopRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  }

  return (
    <StudioNodeFrame id={id} data={data} icon={<FileAudio size={17} />} tone="audio">
      <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} />
      <label
        className={`file-picker nodrag ${isDraggingOver ? "dragging-over" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current += 1;
          setIsDraggingOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          if (!isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
          if (dragCounterRef.current === 0) {
            setIsDraggingOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current = 0;
          setIsDraggingOver(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          processAudioFiles(files);
        }}
      >
        <input accept="audio/*,video/mp4,.mp3,.m4a,.mp4,.wav,.flac,.aac,.ogg" type="file" multiple onChange={onFileChange} />
        <span>{data.audioAssets?.length ? `已添加 ${data.audioAssets.length} 段参考音频` : "上传参考音频 (支持多选与直接拖入)"}</span>
        <small>{data.audioAssets?.length ? "可继续拖入添加，连接至整合节点后按顺序输出" : "可直接拖入或选择多个 MP3、M4A、MP4 或 WAV"}</small>
      </label>
      {(data.audioAssets ?? (data.audio ? [data.audio] : [])).map((audio, index) => (
        <div className="reference-audio-card nodrag" key={`${audio.fileName}-${index}`}>
          <div className="reference-audio-card-header">
            <span title={audio.fileName}>{index + 1}. {audio.fileName}</span>
            <button className="icon-button" type="button" onClick={() => removeAudio(index)} title="移除此参考音频">
              <Trash2 size={13} />
            </button>
          </div>
          <StudioAudioPlayer src={audio.dataUrl} />
        </div>
      ))}
      <div className="recording-panel nodrag">
        <button className={isRecording ? "record-button recording" : "record-button"} type="button" onClick={() => void startRecording()} disabled={isRecording}>
          <Mic2 size={15} />
          开始录制
        </button>
        <button className="record-stop-button" type="button" onClick={stopRecording} disabled={!isRecording}>
          <Square size={13} />
          停止
        </button>
        <span>{isRecording ? `录制中 ${formatTime(recordingSeconds)}` : "当场录制参考音频"}</span>
      </div>
      {data.error ? <p className="node-error">{data.error}</p> : null}
    </StudioNodeFrame>
  );
});

function CompactAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  function seek(value: string) {
    const nextTime = Number(value);
    const audio = audioRef.current;
    if (!audio || Number.isNaN(nextTime)) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <div className="compact-audio-player nodrag">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />
      <button className="compact-player-button" type="button" onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
        {isPlaying ? <Pause size={11} /> : <Play size={11} />}
      </button>
      <input
        className="compact-player-range"
        type="range"
        min={0}
        max={duration || 100}
        step={0.01}
        value={currentTime}
        onChange={(e) => seek(e.target.value)}
        style={{ "--progress": `${progress}%` } as React.CSSProperties}
      />
      <span className="compact-player-time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

function getBezierControlPoints(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position = Position.Right,
  targetX: number,
  targetY: number,
  targetPosition: Position = Position.Left
): { x1: number; y1: number; x2: number; y2: number } {
  const isHorizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;

  if (isHorizontal) {
    const dist = Math.abs(targetX - sourceX);
    const offset = Math.max(dist * 0.5, 20);
    const x1 = sourcePosition === Position.Left ? sourceX - offset : sourceX + offset;
    const y1 = sourceY;
    const x2 = targetPosition === Position.Right ? targetX + offset : targetX - offset;
    const y2 = targetY;
    return { x1, y1, x2, y2 };
  } else {
    const dist = Math.abs(targetY - sourceY);
    const offset = Math.max(dist * 0.5, 20);
    const x1 = sourceX;
    const y1 = sourcePosition === Position.Top ? sourceY - offset : sourceY + offset;
    const x2 = targetX;
    const y2 = targetPosition === Position.Bottom ? targetY + offset : targetY - offset;
    return { x1, y1, x2, y2 };
  }
}

function getClosestPointOnBezier(
  mx: number,
  my: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position = Position.Right,
  targetPosition: Position = Position.Left
): { x: number; y: number } {
  const { x1, y1, x2, y2 } = getBezierControlPoints(
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  );

  const x0 = sourceX, y0 = sourceY;
  const x3 = targetX, y3 = targetY;

  function sample(t: number) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
    return { x, y };
  }

  let bestT = 0.5;
  let minDistanceSq = Infinity;

  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const pt = sample(t);
    const distSq = (pt.x - mx) ** 2 + (pt.y - my) ** 2;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestT = t;
    }
  }

  let step = 1 / 120;
  for (let i = 0; i < 8; i++) {
    const tLeft = Math.max(0, bestT - step);
    const tRight = Math.min(1, bestT + step);
    const ptL = sample(tLeft);
    const ptR = sample(tRight);
    const distL = (ptL.x - mx) ** 2 + (ptL.y - my) ** 2;
    const distR = (ptR.x - mx) ** 2 + (ptR.y - my) ** 2;
    if (distL < minDistanceSq) {
      minDistanceSq = distL;
      bestT = tLeft;
    } else if (distR < minDistanceSq) {
      minDistanceSq = distR;
      bestT = tRight;
    }
    step /= 2;
  }

  return sample(bestT);
}

function useAutoUpdateNodeInternals(id: string, deps: unknown[] = []) {
  const updateNodeInternals = useUpdateNodeInternals();

  useLayoutEffect(() => {
    updateNodeInternals(id);
    const timer1 = setTimeout(() => updateNodeInternals(id), 30);
    const timer2 = setTimeout(() => updateNodeInternals(id), 120);

    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
    if (!el) {
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }

    const ro = new ResizeObserver(() => {
      updateNodeInternals(id);
    });
    ro.observe(el);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      ro.disconnect();
    };
  }, [id, updateNodeInternals, ...deps]);
}

function getElementTopInNode(element: HTMLElement | null): number | null {
  if (!element) return null;
  const nodeEl = element.closest<HTMLElement>(".studio-node");
  if (!nodeEl) return null;
  let top = element.offsetHeight / 2;
  let current: HTMLElement | null = element;
  while (current && current !== nodeEl) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return Math.round(top);
}

const AudioMergeNode = memo(function AudioMergeNode({ id, data }: NodeProps<StudioNode>) {
  useAutoUpdateNodeInternals(id, [data.audio]);

  return (
    <StudioNodeFrame id={id} data={data} icon={<AudioLines size={17} />} tone="audio-merge">
      <Handle type="target" position={Position.Left} id="audio" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>音频</span>
      <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} />
      <p className="node-muted">将所有连入的音频按连接顺序拼接为一段 WAV；一个批量参考节点可提供多段音频。</p>
      {data.audio ? (
        <>
          <p className="merge-result">已整合：{data.audio.fileName} · {formatBytes(data.audio.size)}</p>
          <StudioAudioPlayer src={data.audio.dataUrl} />
        </>
      ) : null}
      {data.error ? <p className="node-error">{data.error}</p> : null}
      <button className="run-button nodrag" type="button" onClick={() => data.onRunAudioMerge?.(id)} disabled={data.isRunning}>
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <AudioLines size={16} />}
        {data.isRunning ? "整合中…" : "整合并输出"}
      </button>
    </StudioNodeFrame>
  );
});

const CommentNode = memo(function CommentNode({ id, data }: NodeProps<StudioNode>) {
  useAutoUpdateNodeInternals(id);

  return (
    <div className="comment-node">
      <textarea
        className="nodrag nopan nowheel"
        value={data.text ?? ""}
        onChange={(event) => data.onPatch?.(id, { text: event.target.value })}
        rows={3}
        placeholder="添加注释..."
      />
    </div>
  );
});

const PromptNode = memo(function PromptNode({ id, data }: NodeProps<StudioNode>) {
  useAutoUpdateNodeInternals(id);

  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="prompt">
      <Handle type="source" position={Position.Right} id="text" className="node-handle" style={{ top: "50%" }} />
      <textarea
        className="nodrag nopan nowheel"
        value={data.text ?? ""}
        onChange={(event) => data.onPatch?.(id, { text: event.target.value })}
        rows={6}
        placeholder="写入最终要生成成音频的文本，并连接到克隆节点的「文本」输入。"
      />
    </StudioNodeFrame>
  );
});

const VoiceStyleNode = memo(function VoiceStyleNode({ id, data }: NodeProps<StudioNode>) {
  useAutoUpdateNodeInternals(id);

  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="style">
      <Handle type="source" position={Position.Right} id="style" className="node-handle" style={{ top: "50%" }} />
      <textarea
        className="nodrag nopan nowheel"
        value={data.text ?? ""}
        onChange={(event) => data.onPatch?.(id, { text: event.target.value })}
        rows={6}
        placeholder="写入语气、情绪、语速、角色和导演指令，并连接到克隆节点的「风格」输入。"
      />
      {data.error ? <p className="node-error">{data.error}</p> : null}
    </StudioNodeFrame>
  );
});

const VoiceCloneNode = memo(function VoiceCloneNode({ id, data }: NodeProps<StudioNode>) {
  const label1Ref = useRef<HTMLSpanElement | null>(null);
  const label2Ref = useRef<HTMLSpanElement | null>(null);
  const [instTop, setInstTop] = useState(62);
  const [textTop, setTextTop] = useState(175);

  useAutoUpdateNodeInternals(id, [instTop, textTop]);

  useLayoutEffect(() => {
    function update() {
      const y1 = getElementTopInNode(label1Ref.current);
      const y2 = getElementTopInNode(label2Ref.current);
      if (y1 !== null && y1 !== instTop) {
        setInstTop(y1);
      }
      if (y2 !== null && y2 !== textTop) {
        setTextTop(y2);
      }
    }
    update();
    const ro = new ResizeObserver(update);
    const node = label1Ref.current?.closest<HTMLElement>(".studio-node");
    if (node) ro.observe(node);
    return () => ro.disconnect();
  }, [instTop, textTop]);

  const dynStyle = (top: number): React.CSSProperties => ({ top });

  return (
    <StudioNodeFrame id={id} data={data} icon={<Mic2 size={17} />} tone="clone">
      <Handle type="target" position={Position.Left} id="voice" className="node-handle handle-voice" />
      <span className="input-handle-label label-voice">参考</span>
      <Handle type="target" position={Position.Left} id="instruction" className="node-handle" style={dynStyle(instTop)} />
      <span className="input-handle-label" style={dynStyle(instTop)}>风格</span>
      <Handle type="target" position={Position.Left} id="text" className="node-handle" style={dynStyle(textTop)} />
      <span className="input-handle-label" style={dynStyle(textTop)}>文本</span>
      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />
      <label className="node-field nodrag">
        <span ref={label1Ref}>语音风格（导演文本）</span>
        <textarea className="nodrag nopan nowheel" value={data.instruction ?? ""} onChange={(event) => data.onPatch?.(id, { instruction: event.target.value })} rows={4} />
      </label>
      <label className="node-field nodrag">
        <span ref={label2Ref}>音频文本</span>
        <textarea className="nodrag nopan nowheel" value={data.text ?? ""} onChange={(event) => data.onPatch?.(id, { text: event.target.value })} rows={5} />
      </label>
      {data.error ? <p className="node-error">{data.error}</p> : null}
      <button className="run-button nodrag" type="button" onClick={() => data.onRunClone?.(id)} disabled={data.isRunning}>
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <AudioLines size={16} />}
        {data.isRunning ? "生成中" : "运行克隆"}
      </button>
    </StudioNodeFrame>
  );
});

const VOICE_DESIGN_PRESETS = [
  {
    name: "🎙️ 纪录片旁白",
    instruction: "沉稳睿智的男中音，说带自然磁性的标准普通话，语速沉稳缓慢，嗓音透出阅历感，仿佛一位饱经沧桑的人在倾情旁白记录。",
    naturalControl: "角色：严肃而充满敬畏感的纪录片主讲人。\n场景：大自然与人文历史探索纪录片结尾致词。\n指导：发声从容松弛，带自然的送气停顿，语气极具穿透力与思索感。"
  },
  {
    name: "📻 深夜电台情感主播",
    instruction: "温和、清澈且带有轻微沙哑气声的女性声音，说话轻柔舒缓，听感极其温暖舒适，充满陪伴感与治愈氛围。",
    naturalControl: "角色：深夜电台陪伴类节目主持人。\n场景：午夜零点为听众解答心事与朗读信件。\n指导：发声非常亲切柔和，语调偏低，带自然倾听的共情沉浸质感。"
  },
  {
    name: "🕵️ 悬疑解说古老老者",
    instruction: "一位年迈沧桑的老先生，嗓音略带干瘪沙哑与岁月沉淀，语气低沉神秘，仿佛隐藏着数十年不可告人的秘密。",
    naturalControl: "角色：深居祠堂阴影中的守密长者。\n场景：向深夜来访的探案主角缓缓讲述古宅几十年前的禁忌旧事。\n指导：语速偏慢，带有威严沉吟与断续的压迫感，发声通道保持紧凑肃杀。"
  },
  {
    name: "👑 霸道高冷御姐",
    instruction: "冰冷、慵懒却极具压迫感的高音御姐，口音纯正，语气不带任何谄媚讨好，阶级疏离感与掌控威压极强。",
    naturalControl: "角色：百年门阀岑家的现任大当家。\n场景：在祠堂阴影里居高临下斩断对方最后的妄想。\n指导：冰冷而慵懒，断句干净利落，没有剑拔弩张，却让人骨里生寒。"
  },
  {
    name: "💼 科技发布会高管",
    instruction: "自信、从容且富有节奏感的年轻男声，声音干练响亮，逻辑感强，带现代精英的专业度与科技说服力。",
    naturalControl: "角色：前沿科技公司创始人兼产品架构师。\n场景：年度旗舰产品发布会现场主讲阶段。\n指导：吐字清晰，语速偏快但富有重点下沉，带强烈的激情与信心。"
  },
  {
    name: "👧 活泼治愈少女",
    instruction: "清亮、甜美且充满活力的年轻女声，语气轻快自然，开朗随和，极具亲和力与笑容感染力。",
    naturalControl: "角色：开朗元气的有声书活泼女主角。\n场景：与好友阳光下嬉戏分享日常笑料。\n指导：语调轻盈快活，带有微微的笑容发声感，吐字活泼自然。"
  }
];

const VOICE_INSTRUCTION_TAGS = ["年轻女声", "沉稳男声", "沙哑老者", "低沉磁性", "清澈甜美", "纪录片旁白", "深夜电台"];
const VOICE_CONTROL_TAGS = ["冰冷威压", "慵懒疏离", "温柔共情", "激情宣讲", "断句克制", "松弛送气", "平缓慢速"];

const VoiceDesignNode = memo(function VoiceDesignNode({ id, data }: NodeProps<StudioNode>) {
  const label2Ref = useRef<HTMLSpanElement | null>(null);
  const [textTop, setTextTop] = useState(380);

  useAutoUpdateNodeInternals(id, [textTop]);

  useLayoutEffect(() => {
    function update() {
      const y = getElementTopInNode(label2Ref.current);
      if (y !== null && y !== textTop) {
        setTextTop(y);
      }
    }
    update();
    const ro = new ResizeObserver(update);
    const node = label2Ref.current?.closest<HTMLElement>(".studio-node");
    if (node) ro.observe(node);
    return () => ro.disconnect();
  }, [textTop]);

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value, 10);
    if (!isNaN(idx) && VOICE_DESIGN_PRESETS[idx]) {
      const p = VOICE_DESIGN_PRESETS[idx];
      data.onPatch?.(id, { instruction: p.instruction, naturalControl: p.naturalControl, error: undefined });
    }
  };

  const handleAppendInstructionTag = (tag: string) => {
    const current = data.instruction ?? "";
    const updated = current ? `${current}，${tag}` : tag;
    data.onPatch?.(id, { instruction: updated, error: undefined });
  };

  const handleAppendControlTag = (tag: string) => {
    const current = data.naturalControl ?? "";
    const updated = current ? `${current}；${tag}` : `指导：${tag}`;
    data.onPatch?.(id, { naturalControl: updated, error: undefined });
  };

  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="design">
      <Handle type="target" position={Position.Left} id="text" className="node-handle" style={{ top: textTop }} />
      <span className="input-handle-label" style={{ top: textTop }}>文本</span>
      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />

      <div className="design-toolbar nodrag">
        <select className="design-preset-select" defaultValue="" onChange={handleSelectPreset}>
          <option value="" disabled>✨ 快速加载音色预设模板…</option>
          {VOICE_DESIGN_PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.name}</option>
          ))}
        </select>
        <button
          className="design-action-btn"
          type="button"
          onClick={() => data.onOptimizeVoiceDesign?.(id)}
          title="使用 AI 智能扩展与润色描述"
          disabled={data.isRunning}
        >
          <Wand2 size={13} />
          AI 润色
        </button>
      </div>

      <label className="node-field nodrag">
        <div className="design-field-header">
          <span>音色描述词</span>
        </div>
        <textarea
          value={data.instruction ?? ""}
          onChange={(event) => data.onPatch?.(id, { instruction: event.target.value, error: undefined })}
          rows={3}
          className="nodrag nopan nowheel"
          placeholder='例：一位年迈的老先生，说带北方口音的普通话，语速缓慢沉稳，嗓音略带沧桑感...'
        />
        <div className="tag-cloud">
          {VOICE_INSTRUCTION_TAGS.map((tag) => (
            <span key={tag} className="tag-pill" onClick={() => handleAppendInstructionTag(tag)}>
              +{tag}
            </span>
          ))}
        </div>
      </label>

      <label className="node-field nodrag">
        <div className="design-field-header">
          <span>自然语言控制</span>
        </div>
        <textarea
          value={data.naturalControl ?? ""}
          onChange={(event) => data.onPatch?.(id, { naturalControl: event.target.value, error: undefined })}
          rows={4}
          className="nodrag nopan nowheel"
          placeholder={"可选填角色/场景/情绪指导，例：\n角色：百年门阀大当家\n场景：在祠堂阴影里居高临下\n指导：冰冷而慵懒，断句干净利落..."}
        />
        <div className="tag-cloud">
          {VOICE_CONTROL_TAGS.map((tag) => (
            <span key={tag} className="tag-pill" onClick={() => handleAppendControlTag(tag)}>
              +{tag}
            </span>
          ))}
        </div>
      </label>

      <label className="node-field nodrag">
        <span ref={label2Ref}>音频文本</span>
        <textarea
          value={data.text ?? ""}
          onChange={(event) => data.onPatch?.(id, { text: event.target.value, error: undefined })}
          rows={4}
          className="nodrag nopan nowheel"
          placeholder="写入需要直接合成音频的示范文本（或在节点左侧连接提示词节点）。"
        />
      </label>

      {data.error ? <p className="node-error">{data.error}</p> : null}
      <div className="voice-design-bottom-btn-group nodrag" style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className="run-button nodrag"
          type="button"
          onClick={() => data.onRunVoiceDesign?.(id, 1)}
          disabled={data.isRunning}
          style={{ flex: 1, margin: 0 }}
          title="生成 1 条音色产物"
        >
          {data.isRunning ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
          {data.isRunning ? "生成中..." : "运行音色创造"}
        </button>

        <button
          className="run-button batch-nine-btn nodrag"
          type="button"
          onClick={() => data.onRunVoiceDesign?.(id, 9)}
          disabled={data.isRunning}
          style={{ flex: 1, margin: 0 }}
          title="一次性批量创造 9 个不同音色产物"
        >
          {data.isRunning ? <Loader2 className="spin" size={15} /> : <Grid size={15} />}
          {data.isRunning ? "批量生成中..." : "批量音色 9个"}
        </button>
      </div>
    </StudioNodeFrame>
  );
});

const ArtifactNode = memo(function ArtifactNode({ id, data }: NodeProps<StudioNode>) {
  const artifact = data.artifact;
  const isStashed = artifact ? data.isArtifactStashed?.(artifact) : false;
  const artifactForStash = artifact ? { ...artifact, sourceNodeName: data.title } : null;

  useAutoUpdateNodeInternals(id, [artifact]);

  return (
    <StudioNodeFrame id={id} data={data} icon={<Archive size={17} />} tone="artifact">
      <Handle type="target" position={Position.Left} id="artifact" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>产物</span>
      {artifact ? <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} /> : null}
      {artifact ? (
        <>
          <StudioAudioPlayer src={artifact.audioDataUrl} />
          <div className="artifact-meta">
            <span>{artifact.elapsedMs} ms · {new Date(artifact.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
          </div>
          <div className="artifact-actions">
            <button
              className={isStashed ? "download-link nodrag stashed" : "download-link nodrag"}
              type="button"
              onClick={() => artifactForStash && data.onToggleStashArtifact?.(artifactForStash)}
              title={isStashed ? "已暂存 (点击取消暂存)" : "点击暂存此音频"}
            >
              <Archive size={15} />
              {isStashed ? "已暂存" : "暂存"}
            </button>
            <a
              className="download-link nodrag"
              href={artifact.audioDataUrl}
              download={getArtifactDownloadFileName(data.title, artifact.fileName, data.workspaceName)}
            >
              <Download size={15} />
              下载
            </a>
          </div>
        </>
      ) : (
        <p className="node-muted">等待音频克隆节点写入产物。</p>
      )}
    </StudioNodeFrame>
  );
});

function parseTableText(text: string): string[][] {
  if (!text.trim()) return [];

  const isTabSeparated = text.includes("\t");

  if (isTabSeparated) {
    const grid: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === '\t' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          grid.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        grid.push(currentRow);
      }
    }
    return grid;
  } else {
    const lines = text.split(/\r?\n/);
    const grid: string[][] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.includes(",")) {
        const cells: string[] = [];
        let cell = "";
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            inQ = !inQ;
          } else if (c === ',' && !inQ) {
            cells.push(cell.trim());
            cell = "";
          } else {
            cell += c;
          }
        }
        cells.push(cell.trim());
        if (cells.some((c) => c.length > 0)) {
          grid.push(cells);
        }
      } else {
        grid.push([line.trim()]);
      }
    }
    return grid;
  }
}

function ExcelPasteModal({
  onClose,
  onImport
}: {
  onClose: () => void;
  onImport: (
    parsedRows: BatchVoiceCloneRow[],
    mode: "replace" | "append",
    activeFields: Array<keyof BatchVoiceCloneRow>
  ) => void;
}) {
  const [rawText, setRawText] = useState("");
  const [colMap, setColMap] = useState<("title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore")[]>(["instruction", "text"]);

  const parsedGrid = useMemo(() => {
    return parseTableText(rawText);
  }, [rawText]);

  const maxCols = useMemo(() => {
    return parsedGrid.reduce((max, row) => Math.max(max, row.length), 0);
  }, [parsedGrid]);

  useEffect(() => {
    if (maxCols === 0) return;
    const initialMap: ("title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore")[] = [];
    const sampleRow = parsedGrid[0] || [];

    const isHeaderRow = sampleRow.some((cell) =>
      /^(标题|名字|标识|音色描述|描述|自然语言|自然控制|语音风格|风格|导演文本|音频文本|文本|title|instruction|style|text)/i.test(cell)
    );

    if (isHeaderRow) {
      sampleRow.forEach((cell) => {
        const c = cell.toLowerCase();
        if (/风格|style|导演/i.test(c)) {
          initialMap.push("voiceStyle");
        } else if (/控制|natural|角色/i.test(c)) {
          initialMap.push("naturalControl");
        } else if (/描述|instruction/i.test(c)) {
          initialMap.push("instruction");
        } else if (/文本|text|音频/i.test(c)) {
          initialMap.push("text");
        } else if (/标题|名字|标识|title|name|id/i.test(c)) {
          initialMap.push("title");
        } else {
          initialMap.push("ignore");
        }
      });
    } else if (maxCols >= 5) {
      initialMap.push("title", "instruction", "naturalControl", "voiceStyle", "text");
      for (let i = 5; i < maxCols; i++) initialMap.push("ignore");
    } else if (maxCols === 4) {
      initialMap.push("title", "instruction", "naturalControl", "text");
    } else if (maxCols === 3) {
      initialMap.push("title", "instruction", "text");
    } else if (maxCols === 2) {
      if (/^(VO_|ID_|#|[A-Za-z0-9_-]{3,15}$)/i.test(sampleRow[0] || "") && !sampleRow[0]?.includes(" ")) {
        initialMap.push("title", "text");
      } else {
        initialMap.push("voiceStyle", "text");
      }
    } else {
      initialMap.push("voiceStyle");
    }
    setColMap(initialMap);
  }, [maxCols, parsedGrid]);

  function handleColSelect(colIdx: number, value: "title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore") {
    const updated = [...colMap];
    updated[colIdx] = value;
    setColMap(updated);
  }

  function joinCellValues(list: string[]): string {
    if (list.length === 0) return "";
    if (list.length === 1) return list[0];

    let result = list[0];
    for (let i = 1; i < list.length; i++) {
      const prev = result.trimEnd();
      const curr = list[i].trim();
      if (!curr) continue;

      const lastChar = prev.slice(-1);
      if (/[.,!?;:。，！？；：]/.test(lastChar)) {
        result = `${prev} ${curr}`;
      } else {
        result = `${prev}, ${curr}`;
      }
    }
    return result;
  }

  function handleCommit(mode: "replace" | "append") {
    if (parsedGrid.length === 0) return;

    type ValidField = "title" | "instruction" | "naturalControl" | "voiceStyle" | "text";
    const activeFields: Array<keyof BatchVoiceCloneRow> = Array.from(
      new Set(colMap.filter((f): f is ValidField => f !== "ignore"))
    );

    const isHeaderRow = (parsedGrid[0] || []).some((cell) =>
      /^(标题|名字|标识|音色描述|描述|自然语言|自然控制|语音风格|风格|导演文本|音频文本|文本|title|instruction|style|text)/i.test(cell)
    );
    const dataRows = isHeaderRow ? parsedGrid.slice(1) : parsedGrid;

    const resultRows: BatchVoiceCloneRow[] = dataRows.map((gridRow, idx) => {
      const fieldValues: Record<string, string[]> = {};
      gridRow.forEach((cell, colIdx) => {
        const mappedField = colMap[colIdx];
        if (mappedField && mappedField !== "ignore" && cell.trim()) {
          if (!fieldValues[mappedField]) {
            fieldValues[mappedField] = [];
          }
          fieldValues[mappedField].push(cell.trim());
        }
      });

      const getMergedVal = (field: string) => joinCellValues(fieldValues[field] || []);

      const styleVal = getMergedVal("voiceStyle") || getMergedVal("instruction");
      const instVal = getMergedVal("instruction") || getMergedVal("voiceStyle");
      const natVal = getMergedVal("naturalControl");
      const textVal = getMergedVal("text");
      const titleVal = getMergedVal("title");

      return {
        id: createId("row"),
        title: titleVal || `句段 ${idx + 1}`,
        instruction: instVal || styleVal,
        naturalControl: natVal,
        voiceStyle: styleVal || instVal,
        text: textVal
      };
    });

    onImport(resultRows, mode, activeFields);
    onClose();
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="api-key-modal-content excel-paste-modal" onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <Table size={18} />
            从 Excel / 飞书 / 腾讯文档表格一键粘贴导入
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="api-key-modal-body">
          <p className="api-key-modal-hint">
            请在 Excel / WPS / 飞书表格中选中多行多列区域并复制（Ctrl+C），直接在下方输入框内按 <strong>Ctrl + V</strong> 粘贴：
          </p>
          <textarea
            className="excel-paste-textarea nodrag nopan nowheel"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"点击此处直接按 Ctrl + V 粘贴表格内容，例如：\n疑惑而友善，语气自然。\tCan I help you?\n惊讶、错愕又有点无奈\tA pirate?! Me? Hold on..."}
            rows={5}
            autoFocus
          />

          {parsedGrid.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <strong className="excel-preview-heading" style={{ fontSize: 13 }}>
                  数据预览（智能解析共 {parsedGrid.length} 行 {maxCols} 列，鼠标悬停可滚轮滑动浏览，可自定义列对应字段）：
                </strong>
              </div>
              <div className="nodrag nopan nowheel excel-preview-scroll-wrap" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 240, borderRadius: 6 }}>
                <table className="excel-paste-preview-table" style={{ marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      {Array.from({ length: maxCols }).map((_, cIdx) => (
                        <th key={cIdx}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span>第 {cIdx + 1} 列</span>
                            <select
                              className="excel-col-select"
                              value={colMap[cIdx] || "ignore"}
                              onChange={(e) => handleColSelect(cIdx, e.target.value as "title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore")}
                            >
                              <option value="instruction">音色描述词</option>
                              <option value="naturalControl">自然语言控制 (角色/指导)</option>
                              <option value="voiceStyle">语音风格 (导演文本/语气)</option>
                              <option value="text">音频文本</option>
                              <option value="title">名字 / 标识</option>
                              <option value="ignore">❌ 忽略此列</option>
                            </select>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedGrid.map((gridRow, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ textAlign: "center", color: "#9f947b", fontSize: 11 }}>{rIdx + 1}</td>
                        {Array.from({ length: maxCols }).map((_, cIdx) => (
                          <td key={cIdx} style={{ whiteSpace: "pre-wrap", maxWidth: 220 }}>
                            {gridRow[cIdx] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
        <div className="api-key-modal-footer excel-modal-footer" style={{ gap: 10 }}>
          <button type="button" className="excel-modal-btn cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="excel-modal-btn append"
            disabled={parsedGrid.length === 0}
            onClick={() => handleCommit("append")}
          >
            追加到表格末尾 ({parsedGrid.length} 条)
          </button>
          <button
            type="button"
            className="excel-modal-btn replace"
            disabled={parsedGrid.length === 0}
            onClick={() => handleCommit("replace")}
          >
            覆盖现有表格 ({parsedGrid.length} 条)
          </button>
        </div>
      </div>
    </div>
  );
}

const BatchVoiceCloneNode = memo(function BatchVoiceCloneNode({ id, data }: NodeProps<StudioNode>) {
  const rows = data.batchRows || [
    { id: "row_1", title: "句段 1", instruction: "自然、清晰的讲述感", text: "今天我们验证批量音频克隆的第一条生成句段。" },
    { id: "row_2", title: "句段 2", instruction: "轻松自然的语调", text: "这是批量生成的第二条句段，声音连贯稳定。" }
  ];

  const [isExcelPasteOpen, setIsExcelPasteOpen] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);

  useAutoUpdateNodeInternals(id, [rows.length]);

  function patchRows(newRows: BatchVoiceCloneRow[]) {
    data.onPatch?.(id, { batchRows: newRows });
  }

  function handleAddRow() {
    const nextNum = rows.length + 1;
    const newRow: BatchVoiceCloneRow = {
      id: createId("row"),
      title: `句段 ${nextNum}`,
      instruction: rows[rows.length - 1]?.instruction || "",
      text: ""
    };
    patchRows([...rows, newRow]);
  }

  function handleRemoveRow(rowId: string) {
    if (rows.length <= 1) return;
    patchRows(rows.filter((r) => r.id !== rowId));
  }

  function handleDuplicateRow(index: number) {
    const target = rows[index];
    if (!target) return;
    const newRow = {
      ...target,
      id: createId("row"),
      title: `${target.title}_副本`
    };
    const nextRows = [...rows];
    nextRows.splice(index + 1, 0, newRow);
    patchRows(nextRows);
  }

  function handleMoveRow(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const nextRows = [...rows];
    const [moved] = nextRows.splice(index, 1);
    nextRows.splice(targetIndex, 0, moved);
    patchRows(nextRows);
  }

  function handleClearRows() {
    patchRows([
      { id: createId("row"), title: "句段 1", instruction: "", text: "" }
    ]);
  }

  function handleUpdateRow(rowId: string, field: keyof BatchVoiceCloneRow, value: string) {
    patchRows(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        if (field === "instruction" || field === "voiceStyle") {
          return { ...r, instruction: value, voiceStyle: value };
        }
        return { ...r, [field]: value };
      })
    );
  }

  function handleImportFromExcel(
    importedRows: BatchVoiceCloneRow[],
    mode: "replace" | "append",
    activeFields?: Array<keyof BatchVoiceCloneRow>
  ) {
    const normalizedImported = importedRows.map((r) => {
      const val = r.instruction || r.voiceStyle || "";
      return {
        ...r,
        instruction: val,
        voiceStyle: val
      };
    });

    if (mode === "replace") {
      const fieldsToUpdate = activeFields && activeFields.length > 0
        ? Array.from(new Set([...activeFields, "instruction" as keyof BatchVoiceCloneRow, "voiceStyle" as keyof BatchVoiceCloneRow]))
        : (["title", "instruction", "naturalControl", "voiceStyle", "text"] as Array<keyof BatchVoiceCloneRow>);

      const mergedRows = normalizedImported.map((imported, i) => {
        const existing = rows[i];
        if (existing) {
          const updatedRow = { ...existing };
          fieldsToUpdate.forEach((field) => {
            if (field in imported) {
              (updatedRow as any)[field] = imported[field];
            }
          });
          if (updatedRow.voiceStyle && !updatedRow.instruction) {
            updatedRow.instruction = updatedRow.voiceStyle;
          } else if (updatedRow.instruction && !updatedRow.voiceStyle) {
            updatedRow.voiceStyle = updatedRow.instruction;
          }
          return updatedRow;
        }
        return imported;
      });
      patchRows(mergedRows);
    } else {
      patchRows([...rows, ...normalizedImported]);
    }
    setPasteToast(`已成功表格导入 ${importedRows.length} 条数据！`);
    setTimeout(() => setPasteToast(null), 3500);
  }

  function handlePasteAtRow(
    startIndex: number,
    field: "title" | "instruction" | "voiceStyle" | "text",
    event: React.ClipboardEvent
  ) {
    const pasteText = event.clipboardData.getData("text/plain");
    if (!pasteText) return;

    const hasTabs = pasteText.includes("\t");

    if (hasTabs) {
      event.preventDefault();
      const parsedGrid = parseTableText(pasteText);
      const updatedRows = [...rows];

      parsedGrid.forEach((cols, offset) => {
        const idx = startIndex + offset;
        const item: Partial<BatchVoiceCloneRow> = {};

        if (cols.length >= 3) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.voiceStyle = cols[1];
          item.text = cols[2];
        } else if (cols.length === 2) {
          if (/^(VO_|ID_|#|[A-Za-z0-9_-]{3,15}$)/i.test(cols[0]) && !cols[0].includes(" ")) {
            item.title = cols[0];
            item.text = cols[1];
          } else {
            item.instruction = cols[0];
            item.voiceStyle = cols[0];
            item.text = cols[1];
          }
        } else {
          item[field === "voiceStyle" ? "instruction" : field] = cols[0];
          if (field === "instruction" || field === "voiceStyle") {
            item.instruction = cols[0];
            item.voiceStyle = cols[0];
          }
        }

        if (idx < updatedRows.length) {
          updatedRows[idx] = {
            ...updatedRows[idx],
            ...item
          };
        } else {
          updatedRows.push({
            id: createId("row"),
            title: item.title || `句段 ${idx + 1}`,
            instruction: item.instruction || item.voiceStyle || "",
            text: item.text || ""
          });
        }
      });

      patchRows(updatedRows);
      setPasteToast(`自动从剪贴板表格更新了 ${parsedGrid.length} 行！`);
      setTimeout(() => setPasteToast(null), 3500);
    }
  }

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDropRow(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("text/plain");
    const sourceIndex = sourceIndexStr ? parseInt(sourceIndexStr, 10) : draggedIndex;
    setDraggedIndex(null);
    if (sourceIndex === null || sourceIndex === undefined || isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const nextRows = [...rows];
    const [moved] = nextRows.splice(sourceIndex, 1);
    nextRows.splice(targetIndex, 0, moved);
    patchRows(nextRows);
  }

  return (
    <StudioNodeFrame id={id} data={data} icon={<AudioLines size={17} />} tone="batch-clone">
      <Handle type="target" position={Position.Left} id="voice" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>参考</span>
      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />

      <div className="batch-toolbar-row nodrag">
        <button
          type="button"
          className="batch-excel-paste-btn"
          onClick={() => setIsExcelPasteOpen(true)}
          title="从 Excel / 飞书 / 腾讯文档批量复制并粘贴导入"
        >
          <ClipboardPaste size={14} /> 📋 从 Excel / 表格一键粘贴...
        </button>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {data.isRunning ? (
            <button
              type="button"
              className="batch-abort-btn"
              onClick={() => {
                data.onPatch?.(id, { isRunning: false, error: "用户已手动暂停/中断生成。" });
              }}
              title="一键暂停/中断当前正在运行的批量生成任务"
            >
              <Square size={12} /> 暂停生成
            </button>
          ) : null}
          {rows.length > 1 || rows[0]?.text || rows[0]?.instruction ? (
            <button
              type="button"
              className="batch-clear-btn"
              onClick={handleClearRows}
              title="清空表格"
            >
              <Trash2 size={12} /> 清空
            </button>
          ) : null}
        </div>
      </div>

      {pasteToast ? (
        <div className="batch-paste-toast nodrag">
          ✨ {pasteToast}
        </div>
      ) : null}

      <div className="batch-table-header nodrag">
        <div className="batch-col-meta">
          <span>音频克隆</span>
        </div>
        <div className="batch-col-style">语音风格</div>
        <div className="batch-col-text">音频文本</div>
        <div className="batch-col-action">操作</div>
      </div>

      <div className="batch-row-list nodrag">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={`batch-row-card ${draggedIndex === index ? "is-dragging" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropRow(e, index)}
          >
            <div className="batch-row-meta-col">
              <div className="batch-row-meta-top">
                <span className="node-muted" style={{ fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2, cursor: "grab" }} title="按住拖拽可上下排序">
                  <GripVertical size={12} style={{ color: "#c5a45d" }} /> #{index + 1}
                </span>
                <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    onClick={() => handleDuplicateRow(index)}
                    title="复制此行"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    disabled={index === 0}
                    onClick={() => handleMoveRow(index, "up")}
                    title="向上移动"
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    disabled={index === rows.length - 1}
                    onClick={() => handleMoveRow(index, "down")}
                    title="向下移动"
                  >
                    <ChevronDown size={11} />
                  </button>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="batch-row-remove-btn"
                      onClick={() => handleRemoveRow(row.id)}
                      title="删除此行"
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                className="batch-row-title-input nodrag nopan nowheel"
                value={row.title}
                onChange={(e) => handleUpdateRow(row.id, "title", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "title", e)}
                placeholder="标识/名字"
                title="名字/标识（可直接从 Excel 粘贴多列数据）"
              />
            </div>

            <div className="batch-row-style-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.instruction}
                onChange={(e) => handleUpdateRow(row.id, "instruction", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "instruction", e)}
                rows={2}
                placeholder="输入语音风格 (导演文本)..."
              />
            </div>

            <div className="batch-row-text-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.text}
                onChange={(e) => handleUpdateRow(row.id, "text", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "text", e)}
                rows={2}
                placeholder="输入音频文本..."
              />
            </div>

            <div className="batch-row-action-col">
              <button
                type="button"
                className="batch-row-single-clone-btn"
                onClick={() => data.onRunSingleRowBatchVoiceClone?.(id, row.id)}
                disabled={data.isRunning || data.singleRunningRowId === row.id || !row.text.trim()}
                title="单条克隆：仅生成此行音频并精准更新至专属产物节点"
              >
                {data.singleRunningRowId === row.id ? (
                  <Loader2 size={13} className="spin-icon" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>{data.singleRunningRowId === row.id ? "克隆中" : "单生成"}</span>
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="batch-add-row-btn" onClick={handleAddRow}>
          <Plus size={14} /> 加一行 音频克隆、语音风格、音频文本
        </button>
      </div>

      {data.error ? <p className="node-error">{data.error}</p> : null}

      <button
        className="run-button nodrag"
        type="button"
        onClick={() => data.onRunBatchVoiceClone?.(id)}
        disabled={data.isRunning}
        style={{ marginTop: 12 }}
      >
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
        {data.isRunning ? "正在批量生成音频..." : "运行批量克隆"}
      </button>

      {isExcelPasteOpen ? (
        <ExcelPasteModal
          onClose={() => setIsExcelPasteOpen(false)}
          onImport={handleImportFromExcel}
        />
      ) : null}
    </StudioNodeFrame>
  );
});

const BatchVoiceDesignNode = memo(function BatchVoiceDesignNode({ id, data }: NodeProps<StudioNode>) {
  const rows = data.batchRows || [
    { id: "row_1", title: "句段 1", instruction: "30岁成熟女性，声音温润清亮，具有优雅自然的旁白质感", naturalControl: "角色：旁白/讲述人\n指导：沉静自然", text: "今天我们验证批量音色创造的第一条生成句段。" },
    { id: "row_2", title: "句段 2", instruction: "40岁中年男性，嗓音低沉有磁性，语气稳重沉稳", naturalControl: "角色：老掌柜\n指导：温和沧桑", text: "这是批量生成的第二条音色创造句段。" }
  ];

  const [isExcelPasteOpen, setIsExcelPasteOpen] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);

  useAutoUpdateNodeInternals(id, [rows.length]);

  function patchRows(newRows: BatchVoiceCloneRow[]) {
    data.onPatch?.(id, { batchRows: newRows });
  }

  function handleAddRow() {
    const nextNum = rows.length + 1;
    const newRow: BatchVoiceCloneRow = {
      id: createId("row"),
      title: `句段 ${nextNum}`,
      instruction: rows[rows.length - 1]?.instruction || "",
      naturalControl: rows[rows.length - 1]?.naturalControl || "",
      voiceStyle: rows[rows.length - 1]?.voiceStyle || "",
      text: ""
    };
    patchRows([...rows, newRow]);
  }

  function handleRemoveRow(rowId: string) {
    if (rows.length <= 1) return;
    patchRows(rows.filter((r) => r.id !== rowId));
  }

  function handleDuplicateRow(index: number) {
    const target = rows[index];
    if (!target) return;
    const newRow = {
      ...target,
      id: createId("row"),
      title: `${target.title}_副本`
    };
    const nextRows = [...rows];
    nextRows.splice(index + 1, 0, newRow);
    patchRows(nextRows);
  }

  function handleMoveRow(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const nextRows = [...rows];
    const [moved] = nextRows.splice(index, 1);
    nextRows.splice(targetIndex, 0, moved);
    patchRows(nextRows);
  }

  function handleClearRows() {
    patchRows([
      { id: createId("row"), title: "句段 1", instruction: "", naturalControl: "", voiceStyle: "", text: "" }
    ]);
  }

  function handleUpdateRow(rowId: string, field: keyof BatchVoiceCloneRow, value: string) {
    patchRows(
      rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
  }

  function handleImportFromExcel(
    importedRows: BatchVoiceCloneRow[],
    mode: "replace" | "append",
    activeFields?: Array<keyof BatchVoiceCloneRow>
  ) {
    if (mode === "replace") {
      const fieldsToUpdate = activeFields && activeFields.length > 0
        ? activeFields
        : (["title", "instruction", "naturalControl", "voiceStyle", "text"] as Array<keyof BatchVoiceCloneRow>);

      const mergedRows = importedRows.map((imported, i) => {
        const existing = rows[i];
        if (existing) {
          const updatedRow = { ...existing };
          fieldsToUpdate.forEach((field) => {
            if (field in imported) {
              (updatedRow as any)[field] = imported[field];
            }
          });
          return updatedRow;
        }
        return imported;
      });
      patchRows(mergedRows);
    } else {
      patchRows([...rows, ...importedRows]);
    }
    setPasteToast(`已成功表格导入 ${importedRows.length} 条数据！`);
    setTimeout(() => setPasteToast(null), 3500);
  }

  function handlePasteAtRow(
    startIndex: number,
    field: "title" | "instruction" | "naturalControl" | "voiceStyle" | "text",
    event: React.ClipboardEvent
  ) {
    const pasteText = event.clipboardData.getData("text/plain");
    if (!pasteText) return;

    const hasTabs = pasteText.includes("\t");

    if (hasTabs) {
      event.preventDefault();
      const parsedGrid = parseTableText(pasteText);
      const updatedRows = [...rows];

      parsedGrid.forEach((cols, offset) => {
        const idx = startIndex + offset;
        const item: Partial<BatchVoiceCloneRow> = {};

        if (cols.length >= 5) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.naturalControl = cols[2];
          item.voiceStyle = cols[3];
          item.text = cols[4];
        } else if (cols.length === 4) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.naturalControl = cols[2];
          item.text = cols[3];
        } else if (cols.length === 3) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.text = cols[2];
        } else if (cols.length === 2) {
          if (/^(VO_|ID_|#|[A-Za-z0-9_-]{3,15}$)/i.test(cols[0]) && !cols[0].includes(" ")) {
            item.title = cols[0];
            item.text = cols[1];
          } else {
            item.voiceStyle = cols[0];
            item.text = cols[1];
          }
        } else {
          item[field] = cols[0];
        }

        if (idx < updatedRows.length) {
          updatedRows[idx] = {
            ...updatedRows[idx],
            ...item
          };
        } else {
          updatedRows.push({
            id: createId("row"),
            title: item.title || `句段 ${idx + 1}`,
            instruction: item.instruction || "",
            naturalControl: item.naturalControl || "",
            voiceStyle: item.voiceStyle || "",
            text: item.text || ""
          });
        }
      });

      patchRows(updatedRows);
      setPasteToast(`已成功识别并直接粘贴填充了 ${parsedGrid.length} 行数据！`);
      setTimeout(() => setPasteToast(null), 3000);
    }
  }

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDropRow(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("text/plain");
    const sourceIndex = sourceIndexStr ? parseInt(sourceIndexStr, 10) : draggedIndex;
    setDraggedIndex(null);
    if (sourceIndex === null || sourceIndex === undefined || isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const nextRows = [...rows];
    const [moved] = nextRows.splice(sourceIndex, 1);
    nextRows.splice(targetIndex, 0, moved);
    patchRows(nextRows);
  }

  return (
    <StudioNodeFrame id={id} data={data} icon={<Wand2 size={17} />} tone="batch-design">
      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />

      <div className="batch-toolbar-row nodrag">
        <button
          type="button"
          className="batch-excel-paste-btn"
          onClick={() => setIsExcelPasteOpen(true)}
          title="从 Excel / 飞书 / 腾讯文档批量复制并粘贴导入"
        >
          <ClipboardPaste size={14} /> 📋 从 Excel / 表格一键粘贴...
        </button>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {data.isRunning ? (
            <button
              type="button"
              className="batch-abort-btn"
              onClick={() => {
                data.onPatch?.(id, { isRunning: false, error: "用户已手动暂停/中断生成。" });
              }}
              title="一键暂停/中断当前正在运行的批量生成任务"
            >
              <Square size={12} /> 暂停生成
            </button>
          ) : null}
          {rows.length > 1 || rows[0]?.text || rows[0]?.instruction || rows[0]?.naturalControl || rows[0]?.voiceStyle ? (
            <button
              type="button"
              className="batch-clear-btn"
              onClick={handleClearRows}
              title="清空表格"
            >
              <Trash2 size={12} /> 清空
            </button>
          ) : null}
        </div>
      </div>

      {pasteToast ? (
        <div className="batch-paste-toast nodrag">
          ✨ {pasteToast}
        </div>
      ) : null}

      <div className="batch-table-header design-mode nodrag">
        <div className="batch-col-meta">
          <span>音色创造</span>
        </div>
        <div className="batch-col-style">音色描述词</div>
        <div className="batch-col-style">自然语言控制</div>
        <div className="batch-col-style">语音风格</div>
        <div className="batch-col-text">音频文本</div>
        <div className="batch-col-action">操作</div>
      </div>

      <div className="batch-row-list nodrag">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={`batch-row-card design-mode ${draggedIndex === index ? "is-dragging" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropRow(e, index)}
          >
            <div className="batch-row-meta-col">
              <div className="batch-row-meta-top">
                <span className="node-muted" style={{ fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2, cursor: "grab" }} title="按住拖拽可上下排序">
                  <GripVertical size={12} style={{ color: "#c5a45d" }} /> #{index + 1}
                </span>
                <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    onClick={() => handleDuplicateRow(index)}
                    title="复制此行"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    disabled={index === 0}
                    onClick={() => handleMoveRow(index, "up")}
                    title="向上移动"
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    disabled={index === rows.length - 1}
                    onClick={() => handleMoveRow(index, "down")}
                    title="向下移动"
                  >
                    <ChevronDown size={11} />
                  </button>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="batch-row-remove-btn"
                      onClick={() => handleRemoveRow(row.id)}
                      title="删除此行"
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                className="batch-row-title-input nodrag nopan nowheel"
                value={row.title}
                onChange={(e) => handleUpdateRow(row.id, "title", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "title", e)}
                placeholder="标识/名字"
                title="名字/标识（可直接从 Excel 粘贴多列数据）"
              />
            </div>

            <div className="batch-row-style-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.instruction}
                onChange={(e) => handleUpdateRow(row.id, "instruction", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "instruction", e)}
                rows={2}
                placeholder="输入音色描述词..."
              />
            </div>

            <div className="batch-row-style-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.naturalControl || ""}
                onChange={(e) => handleUpdateRow(row.id, "naturalControl", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "naturalControl", e)}
                rows={2}
                placeholder="输入自然语言控制..."
              />
            </div>

            <div className="batch-row-style-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.voiceStyle || ""}
                onChange={(e) => handleUpdateRow(row.id, "voiceStyle", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "voiceStyle", e)}
                rows={2}
                placeholder="输入语音风格 (导演文本/语气)..."
              />
            </div>

            <div className="batch-row-text-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.text}
                onChange={(e) => handleUpdateRow(row.id, "text", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "text", e)}
                rows={2}
                placeholder="输入音频文本..."
              />
            </div>

            <div className="batch-row-action-col">
              <button
                type="button"
                className="batch-row-single-clone-btn design-btn"
                onClick={() => data.onRunSingleRowBatchVoiceDesign?.(id, row.id)}
                disabled={data.isRunning || data.singleRunningRowId === row.id || !row.text.trim()}
                title="单条创造：仅生成此行音色音频并精准更新至专属产物节点"
              >
                {data.singleRunningRowId === row.id ? (
                  <Loader2 size={13} className="spin-icon" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>{data.singleRunningRowId === row.id ? "生成中" : "单生成"}</span>
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="batch-add-row-btn" onClick={handleAddRow}>
          <Plus size={14} /> 加一行 音色创造、描述词、自然控制、语音风格、音频文本
        </button>
      </div>

      {data.error ? <p className="node-error">{data.error}</p> : null}

      <button
        className="run-button design-mode-run nodrag"
        type="button"
        onClick={() => data.onRunBatchVoiceDesign?.(id)}
        disabled={data.isRunning}
        style={{ marginTop: 12 }}
      >
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
        {data.isRunning ? "正在批量生成音色创造..." : "运行批量音色创造"}
      </button>

      {isExcelPasteOpen ? (
        <ExcelPasteModal
          onClose={() => setIsExcelPasteOpen(false)}
          onImport={handleImportFromExcel}
        />
      ) : null}
    </StudioNodeFrame>
  );
});

const BatchArtifactNode = memo(function BatchArtifactNode({ id, data }: NodeProps<StudioNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [isZipping, setIsZipping] = useState(false);
  const items = data.batchArtifacts || [];
  const listRef = useRef<HTMLDivElement>(null);
  const lastItemRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, items.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (lastItemRef.current) {
        lastItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [items.length, items[items.length - 1]?.id]);

  async function handleDownloadZip() {
    if (!items || items.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const nodeTitle = data.title || "批量产物";
      const parentTitle = data.parentTitle || "批量节点";
      const folderName = `${parentTitle}_${nodeTitle}`.replace(/[:：\s]/g, "_");
      const folder = zip.folder(folderName) || zip;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.audioDataUrl) {
          const itemSeq = item.seqIndex ?? (i + 1);
          const fullItemFileName = `${formatHierarchyName(parentTitle, nodeTitle, itemSeq)}.wav`.replace(/[\\/:*?"<>|]/g, "_");
          const bytes = await fetchAudioUint8Array(item.audioDataUrl);
          folder.file(fullItemFileName, bytes);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP packaging failed", err);
    } finally {
      setIsZipping(false);
    }
  }

  return (
    <StudioNodeFrame id={id} data={data} icon={<Archive size={17} />} tone="batch-artifact">
      <Handle type="target" position={Position.Left} id="artifact" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>产物</span>
      {items.length > 0 ? (
        <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} />
      ) : null}

      {items.length === 0 ? (
        <p className="node-muted">等待批量节点写入产物。</p>
      ) : (
        <>
          <div
            ref={listRef}
            className="batch-artifact-item-list nodrag nowheel nopan"
            onWheel={(e) => e.stopPropagation()}
          >
            {items.map((item, index) => {
              const nodeTitle = data.title || "产物";
              const itemSeq = item.seqIndex ?? (index + 1);
              const parentTitle = data.parentTitle || "";
              const fullStashName = formatHierarchyName(parentTitle, nodeTitle, itemSeq);
              const isLatest = index === items.length - 1;

              const artifactForStash: ArtifactData = {
                fileName: item.fileName,
                audioDataUrl: item.audioDataUrl,
                elapsedMs: item.elapsedMs,
                createdAt: item.createdAt,
                sourceNodeName: fullStashName,
                sourceNodeId: id,
                sourceRowId: data.batchRowId
              };
              const isStashed = data.isArtifactStashed?.(artifactForStash) ?? false;

              return (
                <div
                  key={item.id}
                  ref={isLatest ? lastItemRef : undefined}
                  className={`batch-artifact-item-card ${isLatest && items.length > 1 ? "is-latest" : ""}`}
                >
                  <div className="batch-artifact-item-header">
                    <div className="batch-artifact-name-wrap">
                      <span className="batch-artifact-item-name">{fullStashName}</span>
                      {isLatest && items.length > 1 && (
                        <span className="batch-artifact-latest-tag">最新</span>
                      )}
                    </div>
                    <div className="batch-artifact-item-actions">
                      <button
                        type="button"
                        className={isStashed ? "batch-artifact-item-btn stashed" : "batch-artifact-item-btn"}
                        onClick={() => data.onToggleStashArtifact?.(artifactForStash)}
                        title={isStashed ? "已暂存 (点击取消暂存)" : "暂存此音频"}
                      >
                        <Archive size={12} />
                        {isStashed ? "已暂存" : "暂存"}
                      </button>
                      <a
                        className="batch-artifact-item-btn download-btn"
                        href={item.audioDataUrl}
                        download={getArtifactDownloadFileName(fullStashName, item.fileName, data.workspaceName)}
                        title="单条下载"
                      >
                        <Download size={12} />
                        下载
                      </a>
                      <button
                        type="button"
                        className="batch-artifact-item-btn"
                        onClick={() => data.onDeleteBatchArtifactItem?.(id, item.id)}
                        title="删除此音频"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <StudioAudioPlayer src={item.audioDataUrl} />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="batch-download-all-btn nodrag"
            onClick={() => void handleDownloadZip()}
            disabled={isZipping}
          >
            {isZipping ? <Loader2 className="spin" size={16} /> : <FileDown size={16} />}
            {isZipping ? "正在打包中..." : `批量打包下载此节点语音 (.zip)`}
          </button>
        </>
      )}
    </StudioNodeFrame>
  );
});

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
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

async function mergeAudioFiles(files: File[]): Promise<{ dataUrl: string; fileName: string }> {
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

interface AudioRowMapping {
  file: File;
  targetRowIndex: number;
}

function BatchAudioUploadModal({
  rows,
  onClose,
  onApply
}: {
  rows: BatchVoiceCloneRow[];
  onClose: () => void;
  onApply: (mappings: { file: File; targetRowIndex: number }[]) => void;
}) {
  const [items, setItems] = useState<AudioRowMapping[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function handleFileAdd(e: ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    setItems((prev) => {
      const startIdx = prev.length;
      const added: AudioRowMapping[] = newFiles.map((file, i) => {
        const targetIdx = Math.min(startIdx + i, Math.max(0, rows.length - 1));
        return { file, targetRowIndex: targetIdx };
      });
      return [...prev, ...added];
    });
  }

  function handleDropFiles(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []).filter(
      (file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac|mp4)$/i.test(file.name)
    );
    if (droppedFiles.length === 0) return;

    setItems((prev) => {
      const startIdx = prev.length;
      const added: AudioRowMapping[] = droppedFiles.map((file, i) => {
        const targetIdx = Math.min(startIdx + i, Math.max(0, rows.length - 1));
        return { file, targetRowIndex: targetIdx };
      });
      return [...prev, ...added];
    });
  }

  function handleRemoveItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleUpdateTargetRow(itemIdx: number, newTargetIdx: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === itemIdx ? { ...item, targetRowIndex: newTargetIdx } : item))
    );
  }

  function handleAutoSequential() {
    setItems((prev) =>
      prev.map((item, i) => ({
        ...item,
        targetRowIndex: Math.min(i, Math.max(0, rows.length - 1))
      }))
    );
  }

  function handleAllToOneRow(targetIdx: number) {
    setItems((prev) => prev.map((item) => ({ ...item, targetRowIndex: targetIdx })));
  }

  function handleConfirm() {
    if (items.length === 0) {
      alert("请先添加至少一个音频文件！");
      return;
    }
    onApply(items);
    onClose();
  }

  const rowCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    items.forEach((item) => {
      counts[item.targetRowIndex] = (counts[item.targetRowIndex] || 0) + 1;
    });
    return counts;
  }, [items]);

  return createPortal(
    <div
      className="batch-upload-portal-backdrop nodrag nopan nowheel"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        className={`integrated-multi-audio-card ${isDraggingOver ? "dragging-over" : ""} nodrag nopan nowheel`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }}
        onDrop={handleDropFiles}
      >
        <div className="integrated-multi-audio-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📁</span>
            <h3>音频文件 ➔ 目标句段行 分配与合并表</h3>
          </div>
          <button type="button" className="excel-modal-close" style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer" }} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="integrated-multi-audio-banner">
          <label className="integrated-multi-audio-upload-btn" style={{ cursor: "pointer", fontWeight: 700, padding: "8px 16px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={15} />
            <span>📁 添加/拖入音频文件 (支持多选与拖拽)</span>
            <input type="file" accept="audio/*" multiple onChange={handleFileAdd} hidden />
          </label>

          {items.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="integrated-mini-tool" style={{ padding: "5px 10px", fontSize: 12 }} onClick={handleAutoSequential}>
                🔄 1对1顺序填入
              </button>
              <button type="button" className="integrated-mini-tool" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => handleAllToOneRow(0)}>
                🔀 全部对齐第1行
              </button>
              <button type="button" className="integrated-mini-tool danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setItems([])}>
                🗑️ 清空
              </button>
            </div>
          )}
        </div>

        <div className="integrated-multi-audio-table-wrap">
          {items.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: isDraggingOver ? "#38bdf8" : "#94a3b8", fontSize: 13 }}>
              {isDraggingOver ? "✨ 松开鼠标直接导入音频文件..." : "暂未添加音频文件，请点击上方“添加音频文件”或直接将音频文件拖拽至此处。"}
            </div>
          ) : (
            <table className="integrated-multi-audio-table">
              <thead>
                <tr>
                  <th style={{ width: "55%" }}>音频文件名称</th>
                  <th style={{ width: "35%" }}>目标分配行 (选择对应句段)</th>
                  <th style={{ width: "10%", textAlign: "center" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const countForThisRow = rowCounts[item.targetRowIndex] || 0;
                  const isMerged = countForThisRow > 1;

                  return (
                    <tr key={idx}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#94a3b8", fontSize: 11, minWidth: 18 }}>#{idx + 1}</span>
                          <span style={{ wordBreak: "break-all" }}>{item.file.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <select
                            className="nodrag nopan nowheel integrated-multi-audio-select"
                            value={item.targetRowIndex}
                            onChange={(e) => handleUpdateTargetRow(idx, Number(e.target.value))}
                          >
                            {rows.map((r, rIdx) => (
                              <option key={r.id} value={rIdx}>
                                第 {rIdx + 1} 行 ({r.title || `句段 ${rIdx + 1}`})
                              </option>
                            ))}
                            {item.targetRowIndex >= rows.length && (
                              <option value={item.targetRowIndex}>
                                第 {item.targetRowIndex + 1} 行 (自动新建句段行)
                              </option>
                            )}
                            <option value={rows.length}>
                              + 新增第 {rows.length + 1} 行
                            </option>
                          </select>
                          {isMerged && (
                            <span style={{ fontSize: 10, color: "#38bdf8", background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.5)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                              自动合并
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <button type="button" className="integrated-mini-tool danger" onClick={() => handleRemoveItem(idx)} title="移除此项">
                          &times;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {items.length > 0 && (
          <div className="integrated-multi-audio-summary">
            <span style={{ fontWeight: 700 }}>分配概览:</span>
            {Object.entries(rowCounts).map(([rowIdxStr, count]) => {
              const rIdx = Number(rowIdxStr);
              const rowTitle = rows[rIdx]?.title || `句段 ${rIdx + 1}`;
              return (
                <span key={rIdx} style={{ color: count > 1 ? "#38bdf8" : undefined, fontWeight: 600 }}>
                  第 {rIdx + 1} 行 ({rowTitle}): {count} 个文件 {count > 1 ? "(多文件自动融合)" : ""}
                </span>
              );
            })}
          </div>
        )}

        <div className="integrated-multi-audio-footer">
          <button type="button" className="integrated-modal-cancel-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="integrated-modal-confirm-btn" onClick={handleConfirm}>
            ⚡ 确定导入并整合
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const IntegratedStudioNode = memo(function IntegratedStudioNode({ id, data, selected }: NodeProps<StudioNode>) {
  const rows = data.batchRows || [
    { id: "row_1", title: "句段 1", instruction: "自然、清晰的讲述感", text: "今天我们验证全能综合工作台的第一条生成句段。" },
    { id: "row_2", title: "句段 2", instruction: "轻松自然的语调", text: "这是全能综合工作台的第二条生成句段，自动分行生成产物。" }
  ];

  const [isExcelPasteOpen, setIsExcelPasteOpen] = useState(false);
  const [isBatchAudioModalOpen, setIsBatchAudioModalOpen] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [recordingRowId, setRecordingRowId] = useState<string | null>(null);
  const [recordSec, setRecordSec] = useState(0);
  const [isZipping, setIsZipping] = useState(false);
  const [draggingRefRowId, setDraggingRefRowId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useAutoUpdateNodeInternals(id, [rows.length]);

  function patchRows(newRows: BatchVoiceCloneRow[]) {
    data.onPatch?.(id, { batchRows: newRows });
  }

  function handleAddRow() {
    const nextNum = rows.length + 1;
    const newRow: BatchVoiceCloneRow = {
      id: createId("row"),
      title: `句段 ${nextNum}`,
      instruction: rows[rows.length - 1]?.instruction || "",
      text: "",
      artifacts: []
    };
    patchRows([...rows, newRow]);
  }

  function handleRemoveRow(rowId: string) {
    if (rows.length <= 1) return;
    patchRows(rows.filter((r) => r.id !== rowId));
  }

  function handleClearRows() {
    patchRows([
      { id: createId("row"), title: "句段 1", instruction: "", text: "", artifacts: [] }
    ]);
  }

  function handleUpdateRow(rowId: string, field: keyof BatchVoiceCloneRow, value: string) {
    patchRows(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        if (field === "instruction" || field === "voiceStyle") {
          return { ...r, instruction: value, voiceStyle: value };
        }
        return { ...r, [field]: value };
      })
    );
  }

  function handleImportFromExcel(
    importedRows: BatchVoiceCloneRow[],
    mode: "replace" | "append",
    activeFields?: Array<keyof BatchVoiceCloneRow>
  ) {
    const normalizedImported = importedRows.map((r) => {
      const val = r.instruction || r.voiceStyle || "";
      return { ...r, instruction: val, voiceStyle: val, artifacts: [] };
    });

    if (mode === "replace") {
      const fieldsToUpdate = activeFields && activeFields.length > 0
        ? Array.from(new Set([...activeFields, "instruction" as keyof BatchVoiceCloneRow, "voiceStyle" as keyof BatchVoiceCloneRow]))
        : (["title", "instruction", "naturalControl", "voiceStyle", "text"] as Array<keyof BatchVoiceCloneRow>);

      const mergedRows = normalizedImported.map((imported, i) => {
        const existing = rows[i];
        if (existing) {
          const updatedRow = { ...existing };
          fieldsToUpdate.forEach((field) => {
            if (field in imported) {
              (updatedRow as any)[field] = imported[field];
            }
          });
          return updatedRow;
        }
        return imported;
      });
      patchRows(mergedRows);
    } else {
      patchRows([...rows, ...normalizedImported]);
    }
    setPasteToast(`已成功表格导入 ${importedRows.length} 条数据！`);
    setTimeout(() => setPasteToast(null), 3500);
  }

  function handlePasteAtRow(
    startIndex: number,
    field: "title" | "instruction" | "voiceStyle" | "text",
    event: React.ClipboardEvent
  ) {
    const pasteText = event.clipboardData.getData("text/plain");
    if (!pasteText) return;

    const hasTabs = pasteText.includes("\t");

    if (hasTabs) {
      event.preventDefault();
      const parsedGrid = parseTableText(pasteText);
      const updatedRows = [...rows];

      parsedGrid.forEach((cols, offset) => {
        const idx = startIndex + offset;
        const item: Partial<BatchVoiceCloneRow> = {};

        if (cols.length >= 3) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.voiceStyle = cols[1];
          item.text = cols[2];
        } else if (cols.length === 2) {
          if (/^(VO_|ID_|#|[A-Za-z0-9_-]{3,15}$)/i.test(cols[0]) && !cols[0].includes(" ")) {
            item.title = cols[0];
            item.text = cols[1];
          } else {
            item.instruction = cols[0];
            item.voiceStyle = cols[0];
            item.text = cols[1];
          }
        } else {
          item[field === "voiceStyle" ? "instruction" : field] = cols[0];
          if (field === "instruction" || field === "voiceStyle") {
            item.instruction = cols[0];
            item.voiceStyle = cols[0];
          }
        }

        if (idx < updatedRows.length) {
          updatedRows[idx] = { ...updatedRows[idx], ...item };
        } else {
          updatedRows.push({
            id: createId("row"),
            title: item.title || `句段 ${idx + 1}`,
            instruction: item.instruction || item.voiceStyle || "",
            text: item.text || "",
            artifacts: []
          });
        }
      });

      patchRows(updatedRows);
      setPasteToast(`自动从剪贴板表格更新了 ${parsedGrid.length} 行！`);
      setTimeout(() => setPasteToast(null), 3500);
    }
  }

  // Row-level reference audio upload: ONLY targets rowId, merges multiple files into 1 combined reference audio for rowId
  async function handleSingleRowRefAudioUpload(rowId: string, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 1) {
      setPasteToast(`正在自动拼接整合 ${files.length} 个音频文件到本行...`);
    }

    try {
      const merged = await mergeAudioFiles(files);
      patchRows(
        rows.map((r) => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            refAudioUrl: merged.dataUrl,
            refAudioName: merged.fileName
          };
        })
      );
      if (files.length > 1) {
        setPasteToast(`✨ 成功将 ${files.length} 个音频整合为 1 个参考音频导入本行！`);
        setTimeout(() => setPasteToast(null), 3500);
      }
    } catch (err) {
      alert("音频整合解码失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Row-level drag & drop: ONLY targets rowId, merges multiple files into 1 combined reference audio for rowId
  async function handleDropRefAudioOnRow(rowId: string, event: React.DragEvent) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter(
      (f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name)
    );
    if (files.length === 0) return;

    if (files.length > 1) {
      setPasteToast(`正在自动拼接整合拖入的 ${files.length} 个音频文件到本行...`);
    }

    try {
      const merged = await mergeAudioFiles(files);
      patchRows(
        rows.map((r) => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            refAudioUrl: merged.dataUrl,
            refAudioName: merged.fileName
          };
        })
      );
      if (files.length > 1) {
        setPasteToast(`✨ 成功将拖入的 ${files.length} 个音频整合为 1 个参考音频导入本行！`);
        setTimeout(() => setPasteToast(null), 3500);
      }
    } catch (err) {
      alert("音频整合解码失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleApplyBatchAudioTable(mappings: { file: File; targetRowIndex: number }[]) {
    if (mappings.length === 0) return;

    const rowGroups: Record<number, File[]> = {};
    mappings.forEach((m) => {
      if (!rowGroups[m.targetRowIndex]) {
        rowGroups[m.targetRowIndex] = [];
      }
      rowGroups[m.targetRowIndex].push(m.file);
    });

    const targetIndices = Object.keys(rowGroups).map(Number).sort((a, b) => a - b);
    setPasteToast(`正在自动分发与拼接整合 ${mappings.length} 个音频文件到 ${targetIndices.length} 个句段行...`);

    const updatedRows = [...rows];
    let maxIdxNeeded = Math.max(...targetIndices);

    while (updatedRows.length <= maxIdxNeeded) {
      const nextNum = updatedRows.length + 1;
      updatedRows.push({
        id: createId("row"),
        title: `句段 ${nextNum}`,
        instruction: updatedRows[updatedRows.length - 1]?.instruction || "",
        text: "",
        artifacts: []
      });
    }

    try {
      for (const targetIdx of targetIndices) {
        const files = rowGroups[targetIdx];
        if (files.length === 1) {
          const dataUrl = await blobToDataUrl(files[0]);
          const cleanName = files[0].name.replace(/\.[^/.]+$/, "");
          updatedRows[targetIdx] = {
            ...updatedRows[targetIdx],
            refAudioUrl: dataUrl,
            refAudioName: files[0].name,
            title: updatedRows[targetIdx].title.startsWith("句段") ? cleanName : updatedRows[targetIdx].title
          };
        } else if (files.length > 1) {
          const merged = await mergeAudioFiles(files);
          updatedRows[targetIdx] = {
            ...updatedRows[targetIdx],
            refAudioUrl: merged.dataUrl,
            refAudioName: merged.fileName
          };
        }
      }

      patchRows(updatedRows);
      setPasteToast(`✨ 成功按表格完成 ${mappings.length} 个音频文件的分发与合并导入！`);
      setTimeout(() => setPasteToast(null), 3500);
    } catch (err) {
      alert("音频处理与整合解码失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  function handleClearRowRefAudio(rowId: string) {
    patchRows(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        return { ...r, refAudioUrl: undefined, refAudioName: undefined };
      })
    );
  }

  async function startRecordingRow(rowId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          patchRows(
            rows.map((r) => {
              if (r.id !== rowId) return r;
              return {
                ...r,
                refAudioUrl: dataUrl,
                refAudioName: `录制句段音频_${new Date().toLocaleTimeString().replace(/:/g, "")}.wav`
              };
            })
          );
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecordingRowId(rowId);
      setRecordSec(0);
      timerRef.current = window.setInterval(() => {
        setRecordSec((s) => s + 1);
      }, 1000);
    } catch (err) {
      alert("无法开启麦克风录音：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recordingRowId) {
      mediaRecorderRef.current.stop();
      setRecordingRowId(null);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  async function handleDownloadAllZip() {
    const allArtifacts: { rowTitle: string; item: IntegratedRowArtifact }[] = [];
    rows.forEach((r) => {
      (r.artifacts || []).forEach((art) => {
        allArtifacts.push({ rowTitle: r.title, item: art });
      });
    });

    if (allArtifacts.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folderName = (data.title || "全能工作台产物").replace(/[:：\s]/g, "_");
      const folder = zip.folder(folderName) || zip;

      for (let idx = 0; idx < allArtifacts.length; idx++) {
        const { rowTitle, item } = allArtifacts[idx];
        if (item.audioDataUrl) {
          const parentTitle = data.title || "全能工作台";
          const itemSeq = item.seqIndex ?? (idx + 1);
          const fullItemFileName = `${formatHierarchyName(parentTitle, rowTitle, itemSeq)}.wav`.replace(/[\\/:*?"<>|]/g, "_");
          const bytes = await fetchAudioUint8Array(item.audioDataUrl);
          folder.file(fullItemFileName, bytes);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP打包失败", err);
    } finally {
      setIsZipping(false);
    }
  }

  const recordTimeStr = `${Math.floor(recordSec / 60).toString().padStart(2, "0")}:${(recordSec % 60).toString().padStart(2, "0")}`;

  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="integrated-studio">

      {pasteToast ? (
        <div className="batch-paste-toast nodrag">
          ✨ {pasteToast}
        </div>
      ) : null}

      {data.error ? <p className="node-error nodrag">{data.error}</p> : null}

      {/* Top 3 Column Headers */}
      <div className="integrated-top-headers nodrag">
        <div className="integrated-header-cell col-1">
          <Mic size={15} />
          <span>参考音频 (上传/录制)</span>
          <button
            type="button"
            className="integrated-mini-tool"
            style={{ marginLeft: "auto" }}
            onClick={() => setIsBatchAudioModalOpen(true)}
            title="打开批量上传参考音频设置，可选择目标起始行或多文件合并"
          >
            <Upload size={12} /> 批量上传(多选)
          </button>
        </div>

        <div className="integrated-header-cell col-2">
          <AudioLines size={15} />
          <span>音频克隆 (批量/单生成)</span>
          <div className="integrated-col-tools">
            <button
              type="button"
              className="integrated-mini-tool"
              onClick={() => setIsExcelPasteOpen(true)}
              title="从 Excel / 飞书 / 腾讯文档批量粘贴导入"
            >
              <ClipboardPaste size={12} /> Excel一键粘贴
            </button>
            <button type="button" className="integrated-mini-tool" onClick={handleAddRow} title="加一行">
              <Plus size={12} /> 加一行
            </button>
            <button type="button" className="integrated-mini-tool danger" onClick={handleClearRows} title="清空所有句段">
              <Trash2 size={12} /> 清空
            </button>
          </div>
        </div>

        <div className="integrated-header-cell col-3">
          <Archive size={15} />
          <span>音频产物 (自动按行排列)</span>
          {rows.some((r) => (r.artifacts || []).length > 0) && (
            <button
              type="button"
              className="integrated-mini-tool"
              onClick={() => void handleDownloadAllZip()}
              disabled={isZipping}
              style={{ marginLeft: "auto" }}
            >
              <Download size={12} /> 打包全产物
            </button>
          )}
        </div>
      </div>

      {/* Row-by-Row 3-Column Pipelines List */}
      <div className="integrated-pipeline-rows-list nodrag">
        {rows.map((row, index) => (
          <div key={row.id} className="integrated-pipeline-row">
            {/* Col 1: Reference Audio Cell */}
            <div
              className={`integrated-cell cell-ref ${draggingRefRowId === row.id ? "dragging-over" : ""}`}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingRefRowId(row.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
                if (draggingRefRowId !== row.id) setDraggingRefRowId(row.id);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const related = e.relatedTarget as HTMLElement | null;
                if (!related || !e.currentTarget.contains(related)) {
                  setDraggingRefRowId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingRefRowId(null);
                void handleDropRefAudioOnRow(row.id, e);
              }}
            >
              <div className="cell-title">
                <span title={row.refAudioName || row.title}>
                  {index + 1}. {row.refAudioName || "暂无参考音频"}
                </span>
                {row.refAudioUrl && (
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    onClick={() => handleClearRowRefAudio(row.id)}
                    title="清除此行参考音频"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {row.refAudioUrl ? (
                <div className="integrated-ref-player-box">
                  <StudioAudioPlayer src={row.refAudioUrl} />
                </div>
              ) : (
                <div className="integrated-ref-placeholder">
                  <p className="node-muted" style={{ fontSize: 11 }}>可拖入/上传音频 (多选文件自动合并为本行参考)</p>
                </div>
              )}

              <div className="integrated-ref-actions nodrag">
                <label className="integrated-btn" style={{ flex: 1 }} title="点击上传1个或多个音频文件，选多个将自动在本行拼接整合">
                  <Upload size={13} />
                  <span>{row.refAudioUrl ? "更换/多选" : "上传(多选整合)"}</span>
                  <input type="file" accept="audio/*" multiple onChange={(e) => handleSingleRowRefAudioUpload(row.id, e)} hidden />
                </label>

                {recordingRowId === row.id ? (
                  <button type="button" className="integrated-btn recording" style={{ flex: 1 }} onClick={stopRecording}>
                    <Square size={13} />
                    <span>停止({recordTimeStr})</span>
                  </button>
                ) : (
                  <button type="button" className="integrated-btn" style={{ flex: 1 }} onClick={() => void startRecordingRow(row.id)}>
                    <Mic size={13} />
                    <span>录制</span>
                  </button>
                )}
              </div>
            </div>

            {/* Col 2: Voice Clone Cell */}
            <div className={data.singleRunningRowId === row.id ? "integrated-cell cell-clone is-row-generating" : "integrated-cell cell-clone"}>
              <div className="integrated-row-top">
                <span className="node-muted" style={{ fontSize: 11, fontWeight: 700 }}>#{index + 1}</span>
                <input
                  className="batch-row-title-input nodrag nopan nowheel"
                  value={row.title}
                  onChange={(e) => handleUpdateRow(row.id, "title", e.target.value)}
                  onPaste={(e) => handlePasteAtRow(index, "title", e)}
                  placeholder="标识/名字"
                />
                {rows.length > 1 && (
                  <button type="button" className="batch-row-remove-btn" onClick={() => handleRemoveRow(row.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <textarea
                className="nodrag nopan nowheel integrated-textarea"
                value={row.instruction || ""}
                onChange={(e) => handleUpdateRow(row.id, "instruction", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "instruction", e)}
                rows={2}
                placeholder="输入语音风格 (导演文本/语气)..."
              />

              <textarea
                className="nodrag nopan nowheel integrated-textarea"
                value={row.text}
                onChange={(e) => handleUpdateRow(row.id, "text", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "text", e)}
                rows={2}
                placeholder="输入音频文本..."
              />

              <button
                type="button"
                className={data.singleRunningRowId === row.id ? "batch-row-single-clone-btn is-generating" : "batch-row-single-clone-btn"}
                onClick={() => data.onRunIntegratedSingleRow?.(id, row.id)}
                disabled={data.isRunning || data.singleRunningRowId === row.id || !row.text.trim()}
              >
                {data.singleRunningRowId === row.id ? (
                  <Loader2 size={13} className="spin-icon spin" />
                ) : (
                  <Zap size={13} />
                )}
                <span>{data.singleRunningRowId === row.id ? "生成中..." : "⚡ 运行生成"}</span>
              </button>
            </div>

            {/* Col 3: Audio Artifact Cell */}
            <div className="integrated-cell cell-artifact">
              <IntegratedRowArtifactList
                nodeId={id}
                row={row}
                data={data}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        className={data.isRunning ? "run-button nodrag is-generating" : "run-button nodrag"}
        type="button"
        onClick={() => data.onRunIntegratedBatch?.(id)}
        disabled={data.isRunning}
        style={{ marginTop: 12 }}
      >
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <Zap size={16} />}
        {data.isRunning ? "正在批量全员生成中..." : "⚡ 运行批量全部生成"}
      </button>

      {isExcelPasteOpen ? (
        <ExcelPasteModal
          onClose={() => setIsExcelPasteOpen(false)}
          onImport={handleImportFromExcel}
        />
      ) : null}

      {isBatchAudioModalOpen ? (
        <BatchAudioUploadModal
          rows={rows}
          onClose={() => setIsBatchAudioModalOpen(false)}
          onApply={handleApplyBatchAudioTable}
        />
      ) : null}
    </StudioNodeFrame>
  );
});

function IntegratedRowArtifactList({
  nodeId,
  row,
  data
}: {
  nodeId: string;
  row: BatchVoiceCloneRow;
  data: NodeData;
}) {
  const artifacts = row.artifacts || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const lastItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (lastItemRef.current) {
        lastItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      const parentCell = containerRef.current?.closest(".cell-artifact");
      if (parentCell) {
        parentCell.scrollTop = parentCell.scrollHeight;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [artifacts.length, artifacts[artifacts.length - 1]?.id]);

  return (
    <div
      ref={containerRef}
      className="integrated-row-artifact-box nodrag nowheel nopan"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="integrated-row-artifact-header">
        <span className="node-muted" style={{ fontSize: 12, fontWeight: 700 }}>
          {row.title} 产物 ({artifacts.length})
        </span>
      </div>

      {artifacts.length === 0 ? (
        <span className="node-muted" style={{ fontSize: 11 }}>等待生成产物…</span>
      ) : (
        <div className="integrated-artifact-cards-list">
          {artifacts.map((art, index) => {
            const rowName = row.title || "句段";
            const itemSeq = art.seqIndex ?? (index + 1);
            const itemSubTitle = `${rowName}_${String(itemSeq).padStart(2, "0")}`;
            const parentTitle = data.title || "全能综合台";
            const fullStashName = `${parentTitle}_${rowName}_${itemSubTitle}`;
            const isLatest = index === artifacts.length - 1;

            const artifactForStash: ArtifactData = {
              fileName: art.fileName,
              audioDataUrl: art.audioDataUrl,
              elapsedMs: art.elapsedMs,
              createdAt: art.createdAt,
              sourceNodeName: fullStashName,
              sourceNodeId: nodeId,
              sourceRowId: row.id
            };
            const isStashed = data.isArtifactStashed?.(artifactForStash) ?? false;

            return (
              <div
                key={art.id}
                ref={isLatest ? lastItemRef : undefined}
                className={`batch-artifact-item-card ${isLatest && artifacts.length > 1 ? "is-latest" : ""}`}
              >
                <div className="batch-artifact-item-header">
                  <div className="batch-artifact-name-wrap">
                    <span className="batch-artifact-item-name">{itemSubTitle}</span>
                    {isLatest && artifacts.length > 1 && (
                      <span className="batch-artifact-latest-tag">最新</span>
                    )}
                  </div>
                  <div className="batch-artifact-item-actions">
                    <button
                      type="button"
                      className={isStashed ? "batch-artifact-item-btn stashed" : "batch-artifact-item-btn"}
                      onClick={() => data.onToggleStashArtifact?.(artifactForStash)}
                      title={isStashed ? "已暂存 (点击取消暂存)" : "暂存此音频"}
                    >
                      <Archive size={12} />
                      {isStashed ? "已暂存" : "暂存"}
                    </button>
                    <a
                      className="batch-artifact-item-btn download-btn"
                      href={art.audioDataUrl}
                      download={getArtifactDownloadFileName(fullStashName, art.fileName, data.workspaceName)}
                      title="单条下载"
                    >
                      <Download size={12} />
                      下载
                    </a>
                    <button
                      type="button"
                      className="batch-artifact-item-btn"
                      onClick={() => data.onDeleteIntegratedArtifactItem?.(nodeId, row.id, art.id)}
                      title="删除此音频"
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <StudioAudioPlayer src={art.audioDataUrl} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudioNodeFrame({
  id,
  data,
  icon,
  tone,
  children
}: {
  id: string;
  data: NodeData;
  icon: ReactNode;
  tone: string;
  children: ReactNode;
}) {
  return (
    <section className={`studio-node node-${tone}`}>
      <header className="node-header" title="按住拖拽移动节点">
        <div className="node-title-wrap">
          {icon}
          <input
            className="node-title-input nodrag"
            title="点击修改节点名称"
            value={data.title ?? ""}
            placeholder="节点名称"
            onChange={(event) => data.onPatch?.(id, { title: event.target.value })}
          />
        </div>
        <div className="node-header-actions">
          {tone === "style" || tone === "design" ? (
            <button
              className="icon-button optimize-icon nodrag"
              type="button"
              onClick={() => (tone === "style" ? data.onOptimizeStyle?.(id) : data.onOptimizeVoiceDesign?.(id))}
              disabled={data.isRunning}
              title={data.isRunning ? "AI优化中" : tone === "style" ? "AI优化语音风格" : "AI润色音色描述"}
            >
              {data.isRunning ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
            </button>
          ) : null}
          <button className="icon-button nodrag" type="button" onClick={() => data.onDelete?.(id)} title="删除节点">
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      <div className="node-body-container nowheel">
        {children}
      </div>
    </section>
  );
}

function ContextMenu({
  menu,
  onAdd,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedCount,
  onTidySelection
}: {
  menu: { x: number; y: number };
  onAdd: (type: StudioNodeType) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  selectedCount?: number;
  onTidySelection?: () => void;
}) {
  return (
    <div
      className="context-menu nodrag nopan nowheel"
      style={{ left: menu.x, top: menu.y, maxHeight: "85vh", overflowY: "auto" }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {selectedCount && selectedCount >= 2 && onTidySelection ? (
        <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <button
            type="button"
            className="context-menu-item"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(224, 185, 102, 0.12)",
              borderColor: "rgba(224, 185, 102, 0.35)",
              color: "#e8c97e",
              fontWeight: 600,
              padding: "8px 12px",
              borderRadius: 6,
              cursor: "pointer"
            }}
            onClick={onTidySelection}
          >
            <LayoutGrid size={15} style={{ flexShrink: 0 }} />
            <span>整理框选节点 ({selectedCount})</span>
          </button>
        </div>
      ) : null}
      <strong>添加工作节点</strong>
      <div className="context-menu-node-grid">
        {(Object.keys(nodeCatalog) as StudioNodeType[])
          .filter((type) => type !== "artifact" && type !== "batchArtifact")
          .map((type) => (
            <button key={type} type="button" className={`context-menu-item tone-${type}`} onClick={() => onAdd(type)}>
              <span>{nodeCatalog[type].label}</span>
              <small>{nodeCatalog[type].description}</small>
            </button>
          ))}
      </div>
    </div>
  );
}

function StatusPill({ apiKey, onOpenModal }: { apiKey: string; onOpenModal: () => void }) {
  const masked = apiKey.length > 8 ? `${apiKey.slice(0, 3)}***${apiKey.slice(-4)}` : "***";
  const isDefault = apiKey === DEFAULT_API_KEY;
  return (
    <button className={`status-pill ${isDefault ? "warn" : "good"}`} type="button" onClick={onOpenModal}>
      <Key size={14} />
      <span>API Key: {masked}</span>
    </button>
  );
}

function StashPanel({
  isOpen,
  items,
  workspaceName,
  onBatchDownload,
  onDelete,
  onToggle,
  onConvertToRefAudio
}: {
  isOpen: boolean;
  items: StashItem[];
  workspaceName?: string;
  onBatchDownload: () => void;
  onDelete: (itemId: string) => void;
  onToggle: () => void;
  onConvertToRefAudio?: (title: string, audioAsset: AudioAsset) => void;
}) {
  return (
    <section className="stash-panel">
      <button className="stash-header" type="button" onClick={onToggle} aria-expanded={isOpen}>
        <span>
          <ChevronDown className={isOpen ? "stash-chevron open" : "stash-chevron"} size={14} />
          暂存 {items.length}
        </span>
      </button>
      {isOpen ? (
        <div
          className="stash-body nodrag nopan nowheel"
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="stash-toolbar">
            <span style={{ fontSize: 12, fontWeight: 700, color: "#c5a45d" }}>共暂存 {items.length} 个音效产物</span>
            <button className="stash-download-all" type="button" onClick={onBatchDownload} title="打包下载全部 ZIP">
              <Download size={13} />
              ZIP 打包
            </button>
          </div>
          {items.map((item) => (
            <StashItemCard key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StashItemCard({
  item,
  onDelete
}: {
  item: StashItem;
  onDelete: (itemId: string) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <article
      className={`stash-item ${isPlaying ? "is-playing" : ""}`}
      style={{
        background: isPlaying
          ? `linear-gradient(90deg, rgba(197, 164, 93, 0.35) 0%, rgba(197, 164, 93, 0.35) ${progress.toFixed(1)}%, rgba(24, 23, 19, 0.92) ${progress.toFixed(1)}%, rgba(24, 23, 19, 0.92) 100%)`
          : undefined
      }}
    >
      <div className="stash-item-info">
        <strong title={item.sourceNodeName || item.fileName}>{item.sourceNodeName || item.fileName}</strong>
      </div>
      <div className="stash-item-actions">
        <StashMiniPlayer
          src={item.audioDataUrl}
          onProgressChange={(p, playing) => {
            setProgress(p);
            setIsPlaying(playing);
          }}
        />
        <button className="stash-square-btn nodrag" type="button" onClick={() => onDelete(item.id)} title="删除暂存">
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

function StashMiniPlayer({
  src,
  onProgressChange
}: {
  src: string;
  onProgressChange?: (progressPercent: number, isPlaying: boolean) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget;
    if (audio.duration > 0) {
      const p = (audio.currentTime / audio.duration) * 100;
      onProgressChange?.(p, true);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      if (activeGlobalAudio && activeGlobalAudio !== audio) {
        activeGlobalAudio.pause();
      }
      activeGlobalAudio = audio;
      void audio.play();
    } else {
      audio.pause();
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => {
          setIsPlaying(true);
          onProgressChange?.(0, true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onProgressChange?.(0, false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          onProgressChange?.(0, false);
        }}
      />
      <button className="stash-square-btn nodrag" type="button" onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </button>
    </>
  );
}

const DeletableEdge = memo(function DeletableEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data
}: EdgeProps<StudioEdge>) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const { screenToFlowPosition, getNode } = useReactFlow();

  const sourceNode = getNode(source);
  let strokeColor = style?.stroke || "#c5a45d";

  if (sourceNode) {
    if (sourceNode.type === "voiceDesign" || sourceNode.type === "batchVoiceDesign") {
      strokeColor = "#38bdf8";
    } else if (sourceNode.type === "voiceClone" || sourceNode.type === "batchVoiceClone") {
      strokeColor = "#facc15";
    } else if (sourceNode.type === "audioMerge") {
      strokeColor = "#ea580c";
    } else if (sourceNode.type === "referenceAudio") {
      strokeColor = "#facc15";
    } else if (sourceNode.type === "integratedStudio") {
      strokeColor = "#38bdf8";
    }
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const updatePosFromEvent = useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const closest = getClosestPointOnBezier(
        pos.x,
        pos.y,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition
      );
      setHoverPos(closest);
    },
    [screenToFlowPosition, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      updatePosFromEvent(e);
      setIsHovered(true);
    },
    [updatePosFromEvent]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updatePosFromEvent(e);
      if (!isHovered) setIsHovered(true);
    },
    [updatePosFromEvent, isHovered]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const buttonX = hoverPos ? hoverPos.x : labelX;
  const buttonY = hoverPos ? hoverPos.y : labelY;

  const edgeStyle = useMemo(
    () => ({
      strokeWidth: 2,
      ...style,
      stroke: strokeColor
    }),
    [style, strokeColor]
  );

  return (
    <>
      <g
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <path className="edge-hover-path" d={edgePath} />
        <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      </g>
      <EdgeLabelRenderer>
        <button
          className={isHovered ? "edge-delete visible" : "edge-delete"}
          onClick={(event) => {
            event.stopPropagation();
            data?.onDeleteEdge?.(id);
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          style={{
            transform: `translate(-50%, -50%) translate(${buttonX}px, ${buttonY}px)`,
            borderColor: strokeColor,
            color: strokeColor
          }}
          title="断开链接"
          type="button"
        >
          <X size={13} style={{ display: "block", flexShrink: 0 }} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
});

let activeGlobalAudio: HTMLAudioElement | null = null;

function StudioAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      if (activeGlobalAudio && activeGlobalAudio !== audio) {
        activeGlobalAudio.pause();
      }
      activeGlobalAudio = audio;
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

  function seek(value: string) {
    const nextTime = Number(value);
    const audio = audioRef.current;
    if (!audio || Number.isNaN(nextTime)) {
      return;
    }
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <div className="studio-player nodrag">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          event.currentTarget.playbackRate = playbackRate;
        }}
        onDurationChange={(event) => {
          if (event.currentTarget.duration) {
            setDuration(event.currentTarget.duration);
          }
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={(event) => {
          if (activeGlobalAudio && activeGlobalAudio !== event.currentTarget) {
            activeGlobalAudio.pause();
          }
          activeGlobalAudio = event.currentTarget;
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button className="player-button" type="button" onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <span className="player-time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <input
        aria-label="播放进度"
        className="player-range player-progress"
        max={duration || 0}
        min={0}
        onChange={(event) => seek(event.target.value)}
        style={{ "--progress": `${progress}%` } as React.CSSProperties}
        type="range"
        value={currentTime}
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
}

function extractAudioAssetFromNode(node?: StudioNode): AudioAsset | undefined {
  if (!node) return undefined;

  if (node.data.audio) {
    return node.data.audio;
  }
  if (node.data.audioAssets && node.data.audioAssets.length > 0) {
    return node.data.audioAssets[0];
  }

  if (node.data.artifact) {
    const artifact = node.data.artifact;
    return {
      fileName: artifact.fileName,
      mimeType: guessMimeFromName(artifact.fileName),
      size: dataUrlToUint8Array(artifact.audioDataUrl).byteLength,
      dataUrl: artifact.audioDataUrl
    };
  }

  if (node.data.batchArtifacts && node.data.batchArtifacts.length > 0) {
    const lastItem = node.data.batchArtifacts[node.data.batchArtifacts.length - 1];
    return {
      fileName: lastItem.fileName,
      mimeType: guessMimeFromName(lastItem.fileName),
      size: dataUrlToUint8Array(lastItem.audioDataUrl).byteLength,
      dataUrl: lastItem.audioDataUrl
    };
  }

  return undefined;
}

function resolveCloneInputs(cloneNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  const incoming = edges.filter((edge) => edge.target === cloneNode.id);
  const getSource = (targetHandle: string) => {
    const edge = incoming.find((item) => item.targetHandle === targetHandle);
    return edge ? nodes.find((node) => node.id === edge.source) : undefined;
  };

  const voiceNode = getSource("voice");
  const instructionNode = getSource("instruction");
  const textNode = getSource("text");

  const voiceAudio = extractAudioAssetFromNode(voiceNode);

  return {
    audio: voiceAudio ?? cloneNode.data.audio,
    instruction: instructionNode?.data.text ?? cloneNode.data.instruction ?? "",
    text: textNode?.data.text ?? cloneNode.data.text ?? ""
  };
}

function resolveMergeAudioInputs(mergeNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]): AudioAsset[] {
  return edges
    .filter((edge) => edge.target === mergeNode.id && edge.targetHandle === "audio")
    .flatMap((edge) => {
      const source = nodes.find((node) => node.id === edge.source);
      if (!source) return [];
      if (source.type === "referenceAudio") return source.data.audioAssets ?? (source.data.audio ? [source.data.audio] : []);
      const asset = extractAudioAssetFromNode(source);
      return asset ? [asset] : [];
    });
}

async function mergeAudioAssets(assets: AudioAsset[]): Promise<AudioAsset> {
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

async function resampleAudioBuffer(input: AudioBuffer, sampleRate: number, channelCount: number): Promise<AudioBuffer> {
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

function resolveCloneTextInputs(cloneNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  return edges
    .filter((edge) => edge.target === cloneNode.id && edge.targetHandle === "text")
    .map((edge) => nodes.find((node) => node.id === edge.source && node.type === "prompt"))
    .filter((node): node is StudioNode => Boolean(node))
    .map((node) => ({
      title: node.data.title,
      text: String(node.data.text || "")
    }));
}

function resolveVoiceDesignInputs(designNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  return edges
    .filter((edge) => edge.target === designNode.id && edge.targetHandle === "text")
    .map((edge) => nodes.find((node) => node.id === edge.source && node.type === "prompt"))
    .filter((node): node is StudioNode => Boolean(node))
    .map((node) => ({
      title: node.data.title,
      text: String(node.data.text || "")
    }));
}

function resolveVoiceDesignInstructionInputs(designNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  return edges
    .filter((edge) => edge.target === designNode.id && (edge.targetHandle === "instruction" || edge.targetHandle === "style"))
    .map((edge) => nodes.find((node) => node.id === edge.source && (node.type === "voiceStyle" || node.type === "prompt")))
    .filter((node): node is StudioNode => Boolean(node))
    .map((node) => String(node.data.instruction || node.data.text || "").trim())
    .filter(Boolean);
}

function createArtifactNode(
  sourceNode: StudioNode,
  result: DebugResponse,
  _title?: string,
  index: number = 0,
  currentNodes?: StudioNode[],
  currentEdges?: StudioEdge[]
): StudioNode {
  const sourceTitle = sourceNode.data.title?.trim() || "产物";

  let initialMaxSeq = 0;
  if (currentNodes && currentEdges) {
    const downstreamArtifactNodes = currentNodes.filter(
      (n) => n.type === "artifact" && currentEdges.some((e) => e.source === sourceNode.id && e.target === n.id)
    );
    downstreamArtifactNodes.forEach((n) => {
      if (n.data.seqIndex) {
        initialMaxSeq = Math.max(initialMaxSeq, n.data.seqIndex);
      } else if (n.data.title) {
        const match = n.data.title.match(/_(\d+)$/);
        if (match) {
          initialMaxSeq = Math.max(initialMaxSeq, parseInt(match[1], 10));
        }
      }
    });
  }

  const seqNum = initialMaxSeq + index + 1;

  const itemIndexStr = String(seqNum).padStart(2, "0");
  const artifactTitle = `${sourceTitle}_${itemIndexStr}`;

  const col = (seqNum - 1) % 3;
  const rowPos = Math.floor((seqNum - 1) / 3);
  const stepX = 400;
  const stepY = 205;
  const startX = sourceNode.position.x + (sourceNode.type === "voiceDesign" ? 420 : 380);

  return {
    id: createId("artifact"),
    type: "artifact",
    position: {
      x: startX + col * stepX,
      y: sourceNode.position.y + rowPos * stepY
    },
    data: {
      title: artifactTitle,
      seqIndex: seqNum,
      artifact: {
        fileName: result.fileName,
        audioDataUrl: result.audioDataUrl,
        elapsedMs: result.elapsedMs,
        createdAt: new Date().toISOString(),
        sourceNodeName: artifactTitle,
        sourceNodeId: sourceNode.id
      }
    }
  };
}

function stripNodeCallbacks(node: StudioNode): StudioNode {
  const { workspaceName, onPatch, onDelete, onRunClone, onRunVoiceDesign, onRunAudioMerge, onOptimizeStyle, onOptimizeVoiceDesign, onStashArtifact, onToggleStashArtifact, isArtifactStashed, ...data } = node.data;
  return { ...node, data };
}

async function fileToAudioAsset(file: File): Promise<AudioAsset> {
  return {
    fileName: file.name,
    mimeType: file.type || guessMimeFromName(file.name),
    size: file.size,
    dataUrl: await blobToDataUrl(file)
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
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

async function fetchAudioUint8Array(urlOrData: string): Promise<Uint8Array> {
  if (!urlOrData) return new Uint8Array(0);
  if (urlOrData.startsWith("data:")) {
    const base64 = urlOrData.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  const res = await fetch(urlOrData);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string): File {
  const [meta, base64] = dataUrl.split(",");
  const resolvedMime = mimeType || meta.match(/data:(.*);base64/)?.[1] || "audio/mpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: resolvedMime });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getSupportedRecordingMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

async function convertRecordedBlobToWav(blob: Blob): Promise<Blob> {
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

function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
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

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取录音失败。"));
    reader.readAsDataURL(blob);
  });
}

function splitScriptInput(script: string): string[] {
  return script
    .split(/\n?\s*----\s*\n?/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function guessMimeFromName(fileName: string): string {
  if (/\.wav$/i.test(fileName)) {
    return "audio/wav";
  }
  if (/\.(m4a|mp4)$/i.test(fileName)) {
    return "audio/m4a";
  }
  return "audio/mp3";
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "audio.wav";
}

function getArtifactDownloadFileName(title: string, originalFileName: string, workspaceName?: string): string {
  const safeTitle = sanitizeFileName(title).replace(/\.[a-z0-9]{1,8}$/i, "") || "audio";
  const ext = getFileExtension(originalFileName);
  if (workspaceName && workspaceName.trim()) {
    const safeWsName = sanitizeFileName(workspaceName.trim());
    if (safeTitle.startsWith(safeWsName)) {
      return `${safeTitle}${ext}`;
    }
    return `${safeWsName}_${safeTitle}${ext}`;
  }
  return `${safeTitle}${ext}`;
}

function getFileExtension(fileName: string): string {
  const match = sanitizeFileName(fileName).match(/(\.[a-z0-9]{1,8})$/i);
  return match?.[1] ?? ".wav";
}

function getUniqueFileName(fileName: string, usedNames: Map<string, number>): string {
  const count = usedNames.get(fileName) ?? 0;
  usedNames.set(fileName, count + 1);
  if (count === 0) {
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return `${fileName}-${count + 1}`;
  }

  return `${fileName.slice(0, dotIndex)}-${count + 1}${fileName.slice(dotIndex)}`;
}

function formatDateForFile(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function SaveAsModal({
  workspace,
  onClose,
  onConfirm
}: {
  workspace: WorkspaceSummary;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
}) {
  const [name, setName] = useState(`${workspace.name} 副本`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("画板名称不能为空");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "另存为失败");
      setIsSubmitting(false);
    }
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="api-key-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <Copy size={18} />
            另存为新画板
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="api-key-modal-body">
            <p className="api-key-modal-hint">原画板：{workspace.name}</p>
            <p className="api-key-modal-hint">请输入新画板的名称：</p>
            <input
              type="text"
              className="api-key-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="新画板名称"
              autoFocus
            />
            {error && (
              <p className="api-key-modal-warn">
                <AlertTriangle size={14} />
                {error}
              </p>
            )}
          </div>
          <div className="api-key-modal-footer">
            <button type="button" className="api-key-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              取消
            </button>
            <button type="submit" className="api-key-btn-save" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "确定另存为"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SaveAsTemplateModal({
  workspace,
  onClose,
  onConfirm
}: {
  workspace: WorkspaceSummary;
  onClose: () => void;
  onConfirm: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(`${workspace.name} 模板`);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("模板名称不能为空");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmedName, description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存为模板失败");
      setIsSubmitting(false);
    }
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="api-key-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <LayoutTemplate size={18} />
            存为画板模板
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="api-key-modal-body">
            <p className="api-key-modal-hint">原画板：{workspace.name}</p>
            <label className="node-field">
              <span>模板名称：</span>
              <input
                type="text"
                className="api-key-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="模板名称"
                autoFocus
              />
            </label>
            <label className="node-field" style={{ marginTop: 10 }}>
              <span>模板说明（可选）：</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简短说明该模板适用场景和流程结构..."
                rows={3}
              />
            </label>
            {error && (
              <p className="api-key-modal-warn">
                <AlertTriangle size={14} />
                {error}
              </p>
            )}
          </div>
          <div className="api-key-modal-footer">
            <button type="button" className="api-key-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              取消
            </button>
            <button type="submit" className="api-key-btn-save" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "存为模板"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExportWorkspaceModal({
  workspaces,
  activeWorkspace,
  initialSelectedIds,
  initialTargetId,
  onClose,
  onSaveActiveWorkspace,
  onShowToast
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspacePayload | null;
  initialSelectedIds?: Set<string>;
  initialTargetId?: string;
  onClose: () => void;
  onSaveActiveWorkspace?: () => Promise<void>;
  onShowToast?: (text: string, actionText?: string, onAction?: () => void) => void;
}) {
  const [mode, setMode] = useState<"single" | "multiple">(() => {
    if (initialTargetId) return "single";
    if (initialSelectedIds && initialSelectedIds.size > 1) return "multiple";
    return "multiple";
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (initialTargetId) {
      return new Set([initialTargetId]);
    }
    if (initialSelectedIds && initialSelectedIds.size > 0) {
      return new Set(initialSelectedIds);
    }
    if (activeWorkspace?.id) {
      return new Set([activeWorkspace.id]);
    }
    if (workspaces.length > 0) {
      return new Set([workspaces[0].id]);
    }
    return new Set();
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [exportFormat, setExportFormat] = useState<"individual_json" | "bundle_json" | "zip">("individual_json");
  const [isTemplateFormat, setIsTemplateFormat] = useState(false);
  const [exportDestinationDir, setExportDestinationDir] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredWorkspaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, searchQuery]);

  function handleModeChange(newMode: "single" | "multiple") {
    setMode(newMode);
    if (newMode === "single") {
      const firstId = Array.from(selectedIds)[0] || initialTargetId || activeWorkspace?.id || workspaces[0]?.id;
      if (firstId) {
        setSelectedIds(new Set([firstId]));
      }
    }
  }

  function handleRowClick(id: string) {
    if (mode === "single") {
      setSelectedIds(new Set([id]));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredWorkspaces.map((w) => w.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  function handleInvertSelection() {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      filteredWorkspaces.forEach((w) => {
        if (!prev.has(w.id)) {
          next.add(w.id);
        }
      });
      return next;
    });
  }

  function handleSelectActive() {
    if (activeWorkspace?.id) {
      setSelectedIds(new Set([activeWorkspace.id]));
    }
  }

  const selectedCount = selectedIds.size;

  const exportFileNamePreview = useMemo(() => {
    const selectedList = workspaces.filter((w) => selectedIds.has(w.id));
    const dateStr = new Date().toISOString().slice(0, 10);
    const templateTag = isTemplateFormat ? "_模板" : "";

    if (selectedList.length === 0) {
      return "未选择画板";
    }
    if (selectedList.length === 1) {
      const safeName = sanitizeFileName(selectedList[0].name || "workspace");
      const ext = exportFormat === "zip" ? ".zip" : ".json";
      return `${safeName}${templateTag}_${dateStr}${ext}`;
    }

    const firstSafe = sanitizeFileName(selectedList[0].name || "画板");
    if (exportFormat === "individual_json") {
      return `${firstSafe}${templateTag}_${dateStr}.json 等 ${selectedList.length} 个独立文件`;
    }
    if (exportFormat === "zip") {
      return `${firstSafe}等${selectedList.length}个画板${templateTag}_${dateStr}.zip`;
    }
    return `${firstSafe}等${selectedList.length}个画板${templateTag}_${dateStr}.json`;
  }, [workspaces, selectedIds, exportFormat, isTemplateFormat]);

  function cleanWorkspaceForTemplate(ws: WorkspacePayload): WorkspacePayload & { isTemplate?: boolean } {
    if (ws.type === "board" && ws.nodes) {
      const cleanNodes = ws.nodes.map((n) => {
        const copyData = { ...n.data };
        delete copyData.artifact;
        delete copyData.batchArtifacts;
        delete copyData.singleRunningRowId;
        delete copyData.error;
        delete copyData.isRunning;
        return { ...n, data: copyData };
      });
      return {
        ...ws,
        name: ws.name.endsWith("模板") ? ws.name : `${ws.name} 模板`,
        isTemplate: true,
        nodes: cleanNodes
      };
    }
    return ws;
  }

  async function executeDirectExportToDirectory(targetDir: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("请至少选择一个要导出的画板");
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      if (activeWorkspace && selectedIds.has(activeWorkspace.id) && onSaveActiveWorkspace) {
        await onSaveActiveWorkspace();
      }

      const res = await fetch("/api/workspaces/export-to-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDir,
          ids,
          exportFormat,
          isTemplateFormat
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "导出到目录失败");
      }

      const result = await res.json();
      setIsExporting(false);
      onClose();

      if (onShowToast) {
        onShowToast(
          `✨ 成功导出 ${result.count || ids.length} 个画板到：${targetDir}`,
          "在文件夹中打开",
          () => {
            void fetch("/api/workspaces/open-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ folderPath: targetDir })
            });
          }
        );
      }
    } catch (err) {
      setIsExporting(false);
      setError(err instanceof Error ? err.message : "导出画板失败");
    }
  }

  async function handleSelectFolderAndExport(autoExport = true) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("请至少选择一个要导出的画板");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/settings/select-folder", { method: "POST" });
      if (!res.ok) throw new Error("调起文件夹选择器失败");
      const data = await res.json();
      if (data.canceled || !data.folderPath) {
        return;
      }
      const chosenPath = data.folderPath;
      setExportDestinationDir(chosenPath);
      if (autoExport) {
        await executeDirectExportToDirectory(chosenPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "选择导出文件夹失败");
    }
  }

  async function handleExecuteExport() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("请至少选择一个要导出的画板");
      return;
    }

    if (exportDestinationDir.trim()) {
      await executeDirectExportToDirectory(exportDestinationDir.trim());
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      if (activeWorkspace && selectedIds.has(activeWorkspace.id) && onSaveActiveWorkspace) {
        await onSaveActiveWorkspace();
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const templateTag = isTemplateFormat ? "_模板" : "";

      if (exportFormat === "individual_json") {
        let exportWorkspaces: WorkspacePayload[] = [];

        if (ids.length === 1) {
          const response = await fetch(`/api/workspaces/${ids[0]}`);
          if (!response.ok) throw new Error("获取画板数据失败");
          const payload = await response.json();
          exportWorkspaces = [payload];
        } else {
          const response = await fetch("/api/workspaces/batch-export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids })
          });
          if (!response.ok) throw new Error("批量获取画板数据失败");
          const bundleData = await response.json();
          exportWorkspaces = bundleData.workspaces || [];
        }

        if (isTemplateFormat) {
          exportWorkspaces = exportWorkspaces.map(cleanWorkspaceForTemplate);
        }

        const usedNames = new Set<string>();
        for (let i = 0; i < exportWorkspaces.length; i++) {
          const ws = exportWorkspaces[i];
          let baseName = sanitizeFileName(ws.name || "workspace");
          let fileName = `${baseName}${templateTag}_${dateStr}.json`;
          let counter = 1;
          while (usedNames.has(fileName)) {
            fileName = `${baseName}_${counter}${templateTag}_${dateStr}.json`;
            counter++;
          }
          usedNames.add(fileName);

          const text = JSON.stringify(ws, null, 2);
          const blob = new Blob([text], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          if (exportWorkspaces.length > 1 && i < exportWorkspaces.length - 1) {
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      } else {
        const response = await fetch("/api/workspaces/batch-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        if (!response.ok) throw new Error("批量获取画板数据失败");
        const bundleData = await response.json();
        let exportWorkspaces: WorkspacePayload[] = bundleData.workspaces || [];

        if (isTemplateFormat) {
          exportWorkspaces = exportWorkspaces.map(cleanWorkspaceForTemplate);
        }

        if (exportFormat === "zip") {
          const zip = new JSZip();
          const usedNames = new Set<string>();

          for (const ws of exportWorkspaces) {
            let baseName = sanitizeFileName(ws.name || "workspace");
            let fileName = `${baseName}.json`;
            let counter = 1;
            while (usedNames.has(fileName)) {
              fileName = `${baseName}_${counter}.json`;
              counter++;
            }
            usedNames.add(fileName);
            zip.file(fileName, JSON.stringify(ws, null, 2));
          }

          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const a = document.createElement("a");
          a.href = url;
          a.download = exportFileNamePreview;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          // bundle_json
          const payload = ids.length === 1 ? exportWorkspaces[0] : {
            exportedAt: new Date().toISOString(),
            count: exportWorkspaces.length,
            workspaces: exportWorkspaces
          };
          const text = JSON.stringify(payload, null, 2);
          const blob = new Blob([text], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = exportFileNamePreview;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }

      setIsExporting(false);
      onClose();
      onShowToast?.(`✨ 成功导出 ${selectedCount} 个画板文件！`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出画板失败");
      setIsExporting(false);
    }
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="export-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <FileDown size={19} />
            导出画板
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="api-key-modal-body export-modal-body">
          {/* Mode Switcher Tabs */}
          <div className="export-mode-tabs">
            <button
              type="button"
              className={`export-tab-btn ${mode === "single" ? "active" : ""}`}
              onClick={() => handleModeChange("single")}
            >
              <Square size={15} />
              导出一个画板
            </button>
            <button
              type="button"
              className={`export-tab-btn ${mode === "multiple" ? "active" : ""}`}
              onClick={() => handleModeChange("multiple")}
            >
              <CheckSquare size={15} />
              导出多个画板 ({selectedCount})
            </button>
          </div>

          {/* Search and Quick Action Toolbar */}
          <div className="export-toolbar">
            <div className="export-search-input-wrap">
              <Search size={14} className="export-search-icon" />
              <input
                type="text"
                className="export-search-input"
                placeholder="搜索画板名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="export-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {mode === "multiple" && (
              <div className="export-quick-actions">
                <button type="button" className="export-mini-btn" onClick={handleSelectAll}>
                  全选
                </button>
                <button type="button" className="export-mini-btn" onClick={handleInvertSelection}>
                  反选
                </button>
                <button type="button" className="export-mini-btn" onClick={handleDeselectAll}>
                  取消全选
                </button>
                {activeWorkspace && (
                  <button type="button" className="export-mini-btn highlight" onClick={handleSelectActive}>
                    仅当前画板
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Workspace List Container */}
          <div className="export-workspace-list">
            {filteredWorkspaces.length === 0 ? (
              <div className="export-empty-tip">未找到匹配的画板</div>
            ) : (
              filteredWorkspaces.map((w) => {
                const isSelected = selectedIds.has(w.id);
                const isActive = w.id === activeWorkspace?.id;
                return (
                  <div
                    key={w.id}
                    className={`export-workspace-row ${isSelected ? "selected" : ""} ${isActive ? "is-active" : ""}`}
                    onClick={() => handleRowClick(w.id)}
                  >
                    <div className="export-row-checkbox">
                      {mode === "single" ? (
                        <span className={`export-radio-dot ${isSelected ? "checked" : ""}`} />
                      ) : (
                        <span className={`export-check-box ${isSelected ? "checked" : ""}`}>
                          {isSelected && <Check size={12} />}
                        </span>
                      )}
                    </div>
                    <div className="export-row-info">
                      <div className="export-row-header">
                        <strong className="export-row-title">{w.name}</strong>
                        {isActive && <span className="export-tag active-tag">当前打开</span>}
                        <span className="export-tag type-tag">
                          {w.type === "audiobook" ? "有声书工作台" : "节点画板"}
                        </span>
                      </div>
                      <div className="export-row-meta">
                        <span>
                          {w.type === "audiobook"
                            ? `${w.characterCount ?? 0} 角色 · ${w.segmentCount ?? 0} 段落`
                            : `${w.nodeCount ?? 0} 节点 · ${w.edgeCount ?? 0} 连线`}
                        </span>
                        {w.stashCount && w.stashCount > 0 ? (
                          <span className="export-stash-badge">含 {w.stashCount} 音效暂存</span>
                        ) : null}
                        {w.updatedAt && (
                          <span className="export-date">{w.updatedAt.slice(0, 10)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Export Options */}
          <div className="export-options-panel">
            {/* Format Selection Row */}
            <div className="export-option-row">
              <span className="export-option-row-header">
                <FileDown size={15} /> 导出格式：
              </span>
              <div className="export-format-grid">
                <div
                  className={`export-format-card ${exportFormat === "individual_json" ? "active" : ""}`}
                  onClick={() => setExportFormat("individual_json")}
                >
                  <div className="export-format-card-main">
                    <div className="export-format-icon-wrap">
                      <FileJson size={20} />
                    </div>
                    <div className="export-format-text-wrap">
                      <div className="export-format-card-title">
                        {selectedCount > 1 ? "独立 JSON 文件 (.json)" : "标准 JSON 文件 (.json)"}
                      </div>
                      <div className="export-format-card-desc">
                        {selectedCount > 1 ? "每个画板保存为一个单独的 .json 格式文件" : "包含完整节点配置、参数与连线拓扑"}
                      </div>
                    </div>
                  </div>
                  <div className="export-capsule-indicator">
                    <span className="export-capsule-dot" />
                    <span className="export-capsule-text">{exportFormat === "individual_json" ? "已选择" : "选择"}</span>
                  </div>
                </div>

                {selectedCount > 1 && (
                  <div
                    className={`export-format-card ${exportFormat === "bundle_json" ? "active" : ""}`}
                    onClick={() => setExportFormat("bundle_json")}
                  >
                    <div className="export-format-card-main">
                      <div className="export-format-icon-wrap">
                        <FileJson size={20} />
                      </div>
                      <div className="export-format-text-wrap">
                        <div className="export-format-card-title">JSON 整合包 (.json)</div>
                        <div className="export-format-card-desc">将选中的所有画板合并打包存储在单个 .json 文件中</div>
                      </div>
                    </div>
                    <div className="export-capsule-indicator">
                      <span className="export-capsule-dot" />
                      <span className="export-capsule-text">{exportFormat === "bundle_json" ? "已选择" : "选择"}</span>
                    </div>
                  </div>
                )}

                <div
                  className={`export-format-card ${exportFormat === "zip" ? "active" : ""}`}
                  onClick={() => setExportFormat("zip")}
                >
                  <div className="export-format-card-main">
                    <div className="export-format-icon-wrap">
                      <Archive size={20} />
                    </div>
                    <div className="export-format-text-wrap">
                      <div className="export-format-card-title">ZIP 压缩包 (.zip)</div>
                      <div className="export-format-card-desc">自动将所有画板 .json 归档打包为单个 ZIP 压缩包</div>
                    </div>
                  </div>
                  <div className="export-capsule-indicator">
                    <span className="export-capsule-dot" />
                    <span className="export-capsule-text">{exportFormat === "zip" ? "已选择" : "选择"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Toggle with Capsule Switch */}
            <div className="export-option-row">
              <div
                className={`export-template-card ${isTemplateFormat ? "active" : ""}`}
                onClick={() => setIsTemplateFormat(!isTemplateFormat)}
              >
                <div className="export-template-left">
                  <Sparkles size={18} className="export-template-icon" />
                  <div className="export-template-text">
                    <div className="export-template-title">导出为轻量模板</div>
                    <div className="export-template-desc">自动去除生成的音频二进制与临时缓存，大幅减小导出文件体积，便于备份分享</div>
                  </div>
                </div>
                <div className={`capsule-switch ${isTemplateFormat ? "checked" : ""}`}>
                  <span className="capsule-switch-thumb" />
                </div>
              </div>
            </div>

            {/* Export Destination Directory Row */}
            <div className="export-option-row">
              <span className="export-option-row-header">
                <FolderOpen size={15} /> 导出保存路径：
              </span>
              <div className="export-path-input-group">
                <input
                  type="text"
                  value={exportDestinationDir}
                  onChange={(e) => setExportDestinationDir(e.target.value)}
                  placeholder="默认保存到浏览器下载目录 (或点击右侧选择本地文件夹)..."
                />
                <button
                  type="button"
                  className="export-path-btn-auto"
                  onClick={() => void handleSelectFolderAndExport(true)}
                  title="调起本地文件夹选择窗口，选择后自动将画板导出到该目录"
                >
                  <FolderOpen size={15} />
                  选择路径并自动导出
                </button>
                {exportDestinationDir && (
                  <button
                    type="button"
                    className="export-path-btn-change"
                    onClick={() => setExportDestinationDir("")}
                    title="重置为默认浏览器下载"
                  >
                    重置默认
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <p className="api-key-modal-warn">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="api-key-modal-footer export-modal-footer">
          <div className="export-footer-summary">
            <span className="export-count-pill">
              已选 <strong>{selectedCount}</strong> / {workspaces.length} 个画板
            </span>
            <span className="export-filename-preview" title={exportFileNamePreview}>
              {exportFileNamePreview}
            </span>
          </div>
          <div className="export-footer-btns">
            <button
              type="button"
              className="api-key-btn-cancel"
              onClick={onClose}
              disabled={isExporting}
            >
              取消
            </button>
            <button
              type="button"
              className="api-key-btn-save"
              onClick={() => void handleExecuteExport()}
              disabled={isExporting || selectedCount === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 size={15} className="spin" />
                  正在打包导出...
                </>
              ) : (
                <>
                  <FileDown size={15} />
                  {exportDestinationDir ? `导出到所选目录 (${selectedCount})` : `确认下载导出 (${selectedCount})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeSearchModal({
  activeWorkspace,
  workspaces,
  onClose,
  onSelectNode
}: {
  activeWorkspace: WorkspacePayload | null;
  workspaces: WorkspaceSummary[];
  onClose: () => void;
  onSelectNode: (workspaceId: string, node: StudioNode) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [allNodesMap, setAllNodesMap] = useState<Array<{ workspaceId: string; workspaceName: string; node: StudioNode }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setIsLoading(true);

    Promise.all(
      workspaces.map(async (ws) => {
        try {
          if (ws.id === activeWorkspace?.id && activeWorkspace.type === "board") {
            return {
              workspaceId: ws.id,
              workspaceName: ws.name,
              nodes: activeWorkspace.nodes || []
            };
          }
          const res = await fetch(`/api/workspaces/${ws.id}`);
          if (!res.ok) return null;
          const data = (await res.json()) as WorkspacePayload;
          if (data.type === "board") {
            return {
              workspaceId: ws.id,
              workspaceName: ws.name,
              nodes: data.nodes || []
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    )
      .then((results) => {
        const combined: Array<{ workspaceId: string; workspaceName: string; node: StudioNode }> = [];
        results.forEach((item) => {
          if (item) {
            item.nodes.forEach((node) => {
              combined.push({
                workspaceId: item.workspaceId,
                workspaceName: item.workspaceName,
                node
              });
            });
          }
        });
        setAllNodesMap(combined);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [workspaces, activeWorkspace]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNodesMap;
    return allNodesMap.filter(({ workspaceName, node }) => {
      const wsTitle = String(workspaceName).toLowerCase();
      const title = String(node.data.title || "").toLowerCase();
      const text = String(node.data.text || "").toLowerCase();
      const instruction = String(node.data.instruction || "").toLowerCase();
      const voiceDescription = String(node.data.voiceDescription || "").toLowerCase();
      const rowsText = (node.data.batchRows || [])
        .map((r) => `${r.title} ${r.text} ${r.instruction || ""}`)
        .join(" ")
        .toLowerCase();
      const typeLabel = (nodeCatalog[node.type as StudioNodeType]?.label || node.type).toLowerCase();

      return (
        wsTitle.includes(q) ||
        title.includes(q) ||
        text.includes(q) ||
        instruction.includes(q) ||
        voiceDescription.includes(q) ||
        rowsText.includes(q) ||
        typeLabel.includes(q)
      );
    });
  }, [allNodesMap, query]);

  return (
    <div className="api-key-modal" onClick={onClose}>
      <div className="api-key-modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <Search size={18} />
            全库画板节点全局搜索 (Ctrl+F)
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="api-key-modal-body">
          <div className="search-input-box" style={{ marginBottom: 12 }}>
            <input
              ref={inputRef}
              type="text"
              className="api-key-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="跨全库画板搜索节点名字、台词文本、提示词、行内数据..."
              spellCheck={false}
            />
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto", display: "grid", gap: 8 }}>
            {isLoading ? (
              <p className="node-muted" style={{ textAlign: "center", padding: "20px 0" }}>
                <Loader2 size={16} className="spin" style={{ display: "inline-block", verticalAlign: "-3px", marginRight: 6 }} />
                正在检索全库 {workspaces.length} 个画板的数据...
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="node-muted" style={{ textAlign: "center", padding: "20px 0" }}>全库画板中未找到匹配的节点</p>
            ) : (
              filteredItems.map(({ workspaceId, workspaceName, node }) => {
                const label = nodeCatalog[node.type as StudioNodeType]?.label || node.type;
                const snippet = node.data.text || node.data.instruction || node.data.voiceDescription || "";
                return (
                  <button
                    key={`${workspaceId}-${node.id}`}
                    type="button"
                    className="node-search-item-card"
                    onClick={() => void onSelectNode(workspaceId, node)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <strong style={{ color: "#f5ecd4", fontSize: 14 }}>
                        <span style={{ color: "#c5a45d", marginRight: 6 }}>[{workspaceName}]</span>
                        {node.data.title || label}
                      </strong>
                      <span className="template-badge">{label}</span>
                    </div>
                    {snippet ? (
                      <p style={{ margin: "4px 0 0", color: "#9f947b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {snippet}
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
