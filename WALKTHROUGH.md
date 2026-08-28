# 🚀 v0.8.11 递归树状分支流式排版 (图4完美对齐) & 进程标题全生命周期动态同步 Walkthrough

针对您反馈的 **【任务管理器/任务栏画板名称实时响应更新】** 以及 **【自己产出的产物节点与连线节点，严格在自身后方按分支排版（图4效果）】**，已在 **v0.8.11** 中彻底重构并完美落地！

---

### ✨ 核心升级亮点

#### 1. 🌲 递归树状分支流式排版（100% 呈现图 4 效果）
- **根因分析**：过去的排版算法是将整张图按 Level 0, Level 1, Level 2 进行全局粗暴分列，导致上游 `AudioMerge` 分叉出的两个 `BatchVoiceClone` 的下游产物被混合堆在同一个全局大列里，造成图 3 的错位与混乱；
- **全新递归子树分支排版 (Hierarchical Subtree Layout)**：
  - **分支严格归属**：从根节点（如 `ReferenceAudio` -> `AudioMerge`）开始，每个子分支（如 `BatchVoiceClone 1`）及其名下的所有产物链（`VO_00047` -> `VO_00050` -> `VO_00051`、`VO_00052` -> `VO_00053_JMDZ`）**被视为一个独立封闭的水平通道/几何子树**；
  - **紧跟自身后方**：所有产物节点与下游连线节点，**严格排列在生成它们的父节点正后方**；
  - **分支独立堆叠**：`BatchVoiceClone 2` 及其名下的产物链整齐堆叠在 `BatchVoiceClone 1` 子树的下方，分支之间互不干扰、界限清晰！
  - **九宫格与换列**：音色设计的 9 个单产物维持整齐的 3 列九宫格，超过 5 个工作流自动换至右侧第 2 列（保留 280px 宽敞间距通道）！

#### 2. 🏷️ Electron 任务栏 & 任务管理器标题全生命周期同步
- 在 Electron 主进程中设置 `app.name = "MiMo 音色复刻调试台"`，并增加 `page-title-updated` 实时同步窗口标题；
- 无论是在左侧画板库中快速切换任意画板，还是就地修改画板名称，Windows 任务栏与任务管理器进程名称都会**毫秒级即时更新**，方便跟踪具体画板的真实内存与性能！

---

### 📦 最终打包产物 (Windows v0.8.11)
- **Windows Setup 安装包 (.exe)**：`desktop-build/MiMo-Audio-Workstation-Setup-v0.8.11-win64.exe`
- **免解压便携压缩包 (.zip)**：`desktop-build/MiMo-Audio-Workstation-v0.8.11-win64-portable.zip`
- **本地绿色客户端目录**：`desktop-build/MiMo-Audio-Workstation-win32-x64/MiMo-Audio-Workstation.exe`
