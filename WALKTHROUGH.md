# 🚀 v0.8.12 严格恢复批量产物原设计排版 & 批量9单产物间距两倍严格等距 Walkthrough

针对您反馈的 **【批量产物节点严格按照原设计排版】** 以及 **【批量9个单产物间距扩大为两倍（60px），上下间距与左右间距严格等距】**，已在 **v0.8.12** 中严格执行并落地！

---

### ✨ 核心调整说明 (v0.8.12)

#### 1. 📋 严格执行原始批量产物排版设计
- 严格遵循原设计的 Level 分层规则：
  - `Level 0`: 参考音频 (`referenceAudio`)、提示词 (`prompt`)、音色描述 (`voiceStyle`)、音色设计 (`voiceDesign`)；
  - `Level 1`: 音色克隆 (`voiceClone`)、批量音频克隆 (`batchVoiceClone`)、批量音色设计 (`batchVoiceDesign`)、工作台 (`integratedStudio`)；
  - `Level 2`: 批量产物 (`batchArtifact`)、单产物 (`artifact`)；
  - `Level 3`: 音频整合 (`audioMerge`)。
- **批量产物卡片 (`batchArtifact`)**：严格排列在生成节点的下游列，自上而下规整垂直排列；
- **多工作流自动换列**：依然支持超过 5 组工作流自动换至右侧第二列（保持 280px 宽敞间距）。

#### 2. 📐 批量 9 个单产物间距扩大为两倍（60px 等距）
- **左右间距扩大为现在的两倍**：`colGap = 60px`（原为 28px）；
- **上下间距与左右间距完全一致**：`rowGap = 60px`；
- **实时生成与一键排版完全同步**：
  - `stepX = 400`（340 + 60）；
  - `stepY = 205`（145 + 60）；
  - 无论是点击批量生成 9 个还是点击「整齐排版」，九宫格均呈现规整、通透、严格等距的布局！

---

### 📦 最终打包产物 (Windows v0.8.12)
- **Windows Setup 安装包 (.exe)**：`desktop-build/MiMo-Audio-Workstation-Setup-v0.8.12-win64.exe`
- **免解压便携压缩包 (.zip)**：`desktop-build/MiMo-Audio-Workstation-v0.8.12-win64-portable.zip`
- **本地绿色客户端目录**：`desktop-build/MiMo-Audio-Workstation-win32-x64/MiMo-Audio-Workstation.exe`
