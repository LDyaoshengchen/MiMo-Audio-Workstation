export const MIMO_PRESET_TTS_MODEL = "mimo-v2.5-tts";
export const MIMO_OFFICIAL_PRESET_GROUP_ID = "builtin-mimo-official-presets";
export const MIMO_OFFICIAL_PRESET_GROUP_NAME = "官方预制音色";

export const OFFICIAL_MIMO_PRESET_VOICES = [
  { id: "mimo-preset-default", name: "MiMo-默认", voiceId: "mimo_default", language: "部署默认", gender: "随部署集群", description: "官方预置音色 · 中国集群默认为冰糖，其他集群默认为 Mia。" },
  { id: "mimo-preset-bingtang", name: "冰糖", voiceId: "冰糖", language: "中文", gender: "女性", description: "官方预置音色 · 中文 · 女性。" },
  { id: "mimo-preset-moli", name: "茉莉", voiceId: "茉莉", language: "中文", gender: "女性", description: "官方预置音色 · 中文 · 女性。" },
  { id: "mimo-preset-soda", name: "苏打", voiceId: "苏打", language: "中文", gender: "男性", description: "官方预置音色 · 中文 · 男性。" },
  { id: "mimo-preset-baihua", name: "白桦", voiceId: "白桦", language: "中文", gender: "男性", description: "官方预置音色 · 中文 · 男性。" },
  { id: "mimo-preset-mia", name: "Mia", voiceId: "Mia", language: "英文", gender: "女性", description: "官方预置音色 · 英文 · 女性。" },
  { id: "mimo-preset-chloe", name: "Chloe", voiceId: "Chloe", language: "英文", gender: "女性", description: "官方预置音色 · 英文 · 女性。" },
  { id: "mimo-preset-milo", name: "Milo", voiceId: "Milo", language: "英文", gender: "男性", description: "官方预置音色 · 英文 · 男性。" },
  { id: "mimo-preset-dean", name: "Dean", voiceId: "Dean", language: "英文", gender: "男性", description: "官方预置音色 · 英文 · 男性。" },
] as const;
