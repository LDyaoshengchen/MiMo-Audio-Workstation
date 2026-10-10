// Node palettes are independent of the application/background theme.
export const NODE_TONE_ROLES = ["audio", "merge", "style", "prompt", "clone", "design", "artifact", "integrated", "game", "comment", "batchClone", "batchDesign", "batchArtifact"] as const;
export const NODE_TONE_LABELS = ["参考音频", "音频整合", "语音风格", "提示词", "音频克隆", "音色创造", "音频产物", "综合工作台", "游戏语音", "注释", "批量克隆", "批量创造", "批量产物"];

export const nodePalettePresets: Record<string, { label: string; description: string; colors?: string[] }> = {
  apple: { label: "苹果 · 鲜明分色", description: "经典蓝、红、紫、绿、橙、青与靛蓝，扩展玫红和黄绿；不同功能独立分色。" },
  natural: { label: "自然 · 柔和分色", description: "保留自然柔和的风格，提高色彩辨识度；不再重复使用近似灰调。" },
  monet: { label: "莫奈 · 海蓝日光", description: "参考日出画面的海蓝、暖橙、米金与薄雾青。", colors: ["#30475e", "#56739e", "#5d9f99", "#e88b45", "#c59e57", "#df7565"] },
  liuli: { label: "琉璃 · 青金朱红", description: "参考琉璃建筑的灰青、琥珀、赭石与深朱红。", colors: ["#4c777b", "#8ca9ab", "#875f43", "#bd8a58", "#8b1737", "#50695a"] },
  sky: { label: "天青 · 蓝绿鎏金", description: "参考屋檐与天空的天蓝、深蓝、松绿和金色。", colors: ["#1453a0", "#279ace", "#5b765c", "#bb8b39", "#9e6c35", "#387b7d"] },
  ochre: { label: "赭石 · 陶红晴空", description: "参考建筑的赭褐、陶红、灰玫瑰和晴空蓝。", colors: ["#673d2f", "#b53428", "#86636b", "#b7796a", "#689bbc", "#b7884b"] },
  stilllife: { label: "静物 · 灰紫玫瑰", description: "参考静物画的灰紫、蓝灰、玫瑰与深葡萄色。", colors: ["#62454e", "#70738c", "#8291b2", "#a87d81", "#8f7295", "#718886"] },
  macaron: { label: "海滨 · 青橙马卡龙", description: "参考海滨建筑的湖蓝、薄荷青、明橙和珊瑚粉。", colors: ["#0698bb", "#36b6c4", "#e66b37", "#df9451", "#439478", "#d58180"] },
  mucha: { label: "穆夏 · 橄榄金蓝", description: "参考装饰画的橄榄、米金、孔雀蓝和陶红。", colors: ["#605b3e", "#848463", "#bd9b55", "#266e92", "#b85f45", "#5e8876"] },
  ghibli: { label: "夏日 · 苔绿珊瑚", description: "参考夏日画面的珊瑚红、森林绿、湖青和暖金。", colors: ["#cb4147", "#ed7767", "#387e81", "#78b7a9", "#7d8b39", "#c59b55"] },
  ponyo: { label: "海洋 · 红绿童话", description: "参考海洋画面的鲜红、橄榄、浅绿、暖橙与深青。", colors: ["#ed3c4e", "#70872e", "#a5b733", "#65a268", "#e29663", "#236c67"] },
  ukiyoe: { label: "浮世绘 · 靛蓝朱橙", description: "参考浮世绘的靛蓝、朱红、橙、深青与松绿。", colors: ["#424b73", "#b94b27", "#df8638", "#275c54", "#547756", "#80734d"] },
  sakura: { label: "樱庭 · 朱红青瓦", description: "参考樱庭的朱红、藕粉、青瓦与松绿。", colors: ["#a83d32", "#c37e73", "#b79584", "#657d76", "#365e54", "#75566c"] },
  cinema: { label: "暮光 · 玫瑰蓝紫", description: "参考电影画面的玫瑰、珊瑚、灰蓝紫与暖桃色。", colors: ["#92565c", "#c77778", "#656781", "#8c707e", "#aa829e", "#d88972"] },
  picasso: { label: "毕加索 · 彩色对比", description: "参考绘画的钴蓝、橄榄金、陶橙、草绿与深褐。", colors: ["#6668ce", "#ada139", "#c96530", "#74a563", "#734d30", "#963e67"] },
};

export function normalizeNodePalette(value: unknown): string {
  return typeof value === "string" && Object.hasOwn(nodePalettePresets, value) ? value : "apple";
}

const appleLight = ["#007aff", "#f13d2b", "#af52de", "#34c759", "#ff9500", "#00b899", "#5856d6", "#d63391", "#899b15", "#8e8e93", "#b96800", "#00816c", "#8587e8"];
const appleDark = ["#0a84ff", "#ff6b4a", "#bf5af2", "#30d158", "#ff9f0a", "#55dfc8", "#9291ff", "#ff73bd", "#c3d85b", "#aeaeb2", "#ffd078", "#16ae95", "#bab7ff"];

// Keep the art-inspired temperature/saturation, but allocate a whole color wheel.
// Cycling six seeds produced unrelated lookalikes; every family now owns its hue.
const paletteStyles: Record<string, [shift: number, saturation: number, lightness: number]> = {
  natural: [0, 52, 42], monet: [-5, 64, 49], liuli: [5, 68, 39], sky: [0, 76, 44],
  ochre: [8, 62, 42], stilllife: [-8, 48, 46], macaron: [-3, 76, 51], mucha: [10, 57, 40],
  ghibli: [2, 65, 46], ponyo: [-2, 76, 45], ukiyoe: [7, 68, 41], sakura: [-6, 57, 45],
  cinema: [-10, 53, 46], picasso: [4, 72, 43],
};
// Audio, merge, style, prompt, clone, design, artifact, integrated, game; gray is comment.
const familyHues = [210, 10, 290, 130, 50, 170, 250, 330, 90];
function hslHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360 / 60, s = saturation / 100, l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
  const channels = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return "#" + channels.map(value => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("");
}
export function getReferenceNodeTones(palette: string, isLight: boolean): Record<string, string> {
  const id = normalizeNodePalette(palette);
  const [shift, saturation, lightness] = paletteStyles[id] || paletteStyles.natural;
  const level = isLight ? lightness : 65;
  const sat = isLight ? saturation : Math.max(62, saturation);
  const colors = id === "apple" ? (isLight ? appleLight : appleDark) : [
    ...familyHues.map(hue => hslHex(hue + shift, sat, level)),
    isLight ? "#717982" : "#afb7c1",
    ...[4, 5, 6].map(index => hslHex(familyHues[index] + shift, sat, isLight ? level + 13 : level - 14)),
  ];
  return Object.fromEntries(NODE_TONE_ROLES.map((role, index) => [role, colors[index]]));
}
