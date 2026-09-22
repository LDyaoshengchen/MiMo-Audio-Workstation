export type GameCharacterType = "human" | "monster" | "beast" | "mecha";

export interface CharacterTagGroup {
  id: string;
  nameZh: string;
  nameEn: string;
  tags: string[];
}

export interface CharacterTypeCategory {
  id: GameCharacterType;
  nameZh: string;
  nameEn: string;
  emoji: string;
  groups: CharacterTagGroup[];
  defaultSelectedTags: string[];
}

export const GAME_CHARACTER_TYPES: CharacterTypeCategory[] = [
  {
    id: "human",
    nameZh: "人物角色",
    nameEn: "Human / Humanoid",
    emoji: "👤",
    defaultSelectedTags: ["青年男声", "消瘦干练", "低沉微沙", "冷静警惕"],
    groups: [
      {
        id: "gender_age",
        nameZh: "性别与年龄",
        nameEn: "Gender & Age",
        tags: [
          "青年男声",
          "成熟大叔",
          "粗粝糙汉",
          "苍老老者",
          "娇柔少女",
          "清冷御姐",
          "英气女侠",
          "元气少年",
          "苍老老妪",
          "可爱幼童",
          "阴柔公子"
        ]
      },
      {
        id: "body_shape",
        nameZh: "体型体魄",
        nameEn: "Body & Physique",
        tags: [
          "胖的 (肥胖圆润)",
          "瘦的 (消瘦骨感)",
          "魁梧壮硕 (高大肌肉)",
          "精炼干练",
          "娇小瘦弱",
          "高挑修长",
          "矮小敦实",
          "臃肿迟缓",
          "干瘦精悍"
        ]
      },
      {
        id: "vocal_texture",
        nameZh: "声音质感",
        nameEn: "Vocal Timbre",
        tags: [
          "低沉浑厚",
          "尖细高亢",
          "沙哑粗粝",
          "清脆干净",
          "磁性烟嗓",
          "破锣大嗓",
          "中气十足",
          "气声虚弱",
          "浑浊鼻音",
          "撕裂喉音"
        ]
      },
      {
        id: "personality",
        nameZh: "性格气质",
        nameEn: "Personality",
        tags: [
          "威严刚烈",
          "狡猾阴险",
          "冷酷无情",
          "狂妄嚣张",
          "胆小懦弱",
          "阳光元气",
          "暴躁易怒",
          "呆萌憨厚",
          "神经质紧绷",
          "傲慢轻蔑"
        ]
      }
    ]
  },
  {
    id: "monster",
    nameZh: "怪物魔物",
    nameEn: "Monster / Demon",
    emoji: "👾",
    defaultSelectedTags: ["高大", "威猛", "狡猾", "喉部撕裂嘶鸣", "深渊共鸣"],
    groups: [
      {
        id: "physique",
        nameZh: "体魄气势",
        nameEn: "Physique & Stature",
        tags: [
          "高大",
          "威猛",
          "庞大巨型",
          "干瘪骨瘦",
          "矮小畸形",
          "细长扭曲",
          "粘稠异化",
          "石质重铠",
          "四足爬行",
          "多肢异变"
        ]
      },
      {
        id: "trait",
        nameZh: "性格与习性",
        nameEn: "Nature & Temperament",
        tags: [
          "狡猾",
          "凶残暴虐",
          "嗜血疯狂",
          "阴暗诡谲",
          "贪婪卑劣",
          "狂暴失控",
          "冷血狩猎",
          "幽怨哀嚎",
          "混沌虚无"
        ]
      },
      {
        id: "acoustic",
        nameZh: "发声声学质感",
        nameEn: "Acoustic Timbre",
        tags: [
          "喉部撕裂嘶鸣",
          "深渊共鸣",
          "胸腔沉闷轰鸣",
          "刺耳凄厉尖啸",
          "粘液湿润吞吐",
          "低频腹腔震颤",
          "腐蚀嘶嘶抽吸",
          "枯骨摩擦声",
          "空灵幽魂回响"
        ]
      }
    ]
  },
  {
    id: "beast",
    nameZh: "凶猛野兽",
    nameEn: "Feral Beast",
    emoji: "🐺",
    defaultSelectedTags: ["巨型猛兽", "野性咆哮", "利齿摩擦", "凶猛威慑"],
    groups: [
      {
        id: "beast_type",
        nameZh: "野兽种类与体格",
        nameEn: "Beast Form",
        tags: [
          "巨型猛兽",
          "凶狠恶犬",
          "狡黠孤狼",
          "狂暴熊罴",
          "致命毒蛇",
          "敏捷猫科",
          "深海巨兽",
          "巨禽飞龙"
        ]
      },
      {
        id: "beast_vocal",
        nameZh: "野兽声线特质",
        nameEn: "Roar & Vocal Texture",
        tags: [
          "野性咆哮",
          "喉间呼噜低鸣",
          "低吼警告",
          "利齿摩擦",
          "狂躁狂吠",
          "凶猛威慑",
          "受伤悲鸣",
          "尖锐嘶鸣"
        ]
      }
    ]
  },
  {
    id: "mecha",
    nameZh: "机械构装",
    nameEn: "Mecha / Synthetic",
    emoji: "🤖",
    defaultSelectedTags: ["重装机甲", "冰冷机械合成", "伺服舵机运转", "低频机械共振"],
    groups: [
      {
        id: "mecha_form",
        nameZh: "构装机体形态",
        nameEn: "Machine Type",
        tags: [
          "重装机甲",
          "轻量侦察机",
          "生化改装人",
          "仿生人偶",
          "古代发条魔像",
          "外星纳米核心"
        ]
      },
      {
        id: "synthetic_audio",
        nameZh: "合成音色质感",
        nameEn: "Synthetic Texture",
        tags: [
          "冰冷机械合成",
          "伺服舵机运转",
          "失真电流破音",
          "数字合成器滤波",
          "低频机械共振",
          "故障电流噼啪",
          "金属摩擦回音"
        ]
      }
    ]
  }
];

/**
 * 根据选中的形容词标签和角色类别，生成针对 MiMo Voice Design 的专业角色描述
 */
export function buildVoiceDescriptionFromTags(
  characterType: GameCharacterType,
  selectedTags: string[],
  extraPrompt?: string
): string {
  const cat = GAME_CHARACTER_TYPES.find((c) => c.id === characterType) || GAME_CHARACTER_TYPES[0];
  const tags = selectedTags && selectedTags.length > 0 ? selectedTags : cat.defaultSelectedTags;

  // 清理标签中的说明括号，例如 "胖的 (肥胖圆润)" -> "胖的、体型肥胖圆润"
  const tagDescriptions = tags.map((t) => {
    if (t.includes("(") && t.includes(")")) {
      return t.replace(" (", "，").replace(")", "");
    }
    return t;
  });

  const baseLine = `【角色类型】：${cat.nameZh}（${cat.nameEn}）`;
  const tagLine = `【声线与人设特征】：${tagDescriptions.join("，")}`;
  const acousticLine = `【声学指导】：发音短促有力，瞬态爆发干脆，富有游戏角色拟声的临场感与辨识度，避免拖长音。`;

  const extraLine = extraPrompt?.trim() ? `【自定义细节】：${extraPrompt.trim()}` : "";

  return [baseLine, tagLine, acousticLine, extraLine].filter(Boolean).join("\n");
}

/**
 * 从指定角色大类中随机摇出一套好玩又极具特征的形容词组合
 */
export function getRandomCharacterTags(characterType: GameCharacterType): string[] {
  const cat = GAME_CHARACTER_TYPES.find((c) => c.id === characterType) || GAME_CHARACTER_TYPES[0];
  const picked: string[] = [];

  for (const group of cat.groups) {
    if (group.tags.length > 0) {
      // 随机挑 1~2 个
      const count = Math.random() > 0.4 ? 1 : 2;
      const shuffled = [...group.tags].sort(() => 0.5 - Math.random());
      picked.push(...shuffled.slice(0, count));
    }
  }

  return Array.from(new Set(picked));
}
