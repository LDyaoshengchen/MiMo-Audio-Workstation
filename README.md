# 🎙️ MiMo Audio Workstation (MiMo 语音工作站)

> **基于 React Flow 的下一代节点可视化 AI 语音克隆、音色设计与多轨音频工作站**  
> 深度接入小米 MiMo 大模型 TTS 核心能力（`mimo-v2.5-tts-voiceclone` / `mimo-v2.5-tts-voicedesign`），支持单轨/批量克隆、音色创造、全能综合工作台、多工作区管理与 Windows 绿色桌面客户端。

---

## 🌟 核心功能特性

### 1. 🎛️ 可视化节点画布 (Node-based Canvas)
- **拖拽连线拓扑**：基于 `@xyflow/react` 深度定制，支持参考音频、音色风格、提示词、克隆与设计节点的自由拓扑连线。
- **智能一键整理**：支持按上下游层级自动化排版整理画布，产物卡片自动采用 3 列矩阵排列。
- **动态吸附与连线主题**：拖动节点时实时对齐吸附参考线，连线颜色 100% 动态跟随源节点主题色。

### 2. ⚡ 核心工作节点
- **🎙️ 参考音频节点 (Reference Audio)**：支持本地音频拖拽快速上传、录音导入、节点原生拖放高亮投递与多音频自动拼接。
- **✨ 单轨 / 批量音色创造 (Voice Design & Batch Voice Design)**：无需参考音频，仅通过自然语言描述（如“磁性大叔音”、“甜美少女音”）即可生成全新音色，支持一键批量生成 9 种预设音色或 Excel 表格批量导入。
- **🚀 单轨 / 批量语音克隆 (Voice Clone & Batch Voice Clone)**：高保真克隆参考音频音色，支持 Excel 复制一键粘贴多行、表格拖拽排序与一键并发合成。
- **🏆 钛金全能综合工作台 (Integrated Studio Node)**：集【参考音频】+【批量克隆】+【产物管理】于一体的超宽流水线工作台，支持直接将外部音频拖入对应行、在线麦克风录音与单行/全量打包导出。
- **🔗 参考音频合并 (Audio Merge)**：基于 Web Audio API 实现前端无损重采样拼接，一键生成单一合并参考音频。

### 3. 🎨 高奢钛金双主题 (Dark / Light)
- **深色黑曜石主题**：黑金/钛银暗色科技质感，长时间使用不疲劳。
- **浅色钛银白主题**：高对比度黑白灰钛银质感，字迹清晰锐利，告别发黄发灰。
- **可折叠外观调色盘**：支持针对深色与浅色模式自定义微调节点色阶。

### 4. 📦 画板管理与高质感导出体系
- **画板库与快速检索**：支持多画板独立存储、一键另存为副本、跨画板节点全文搜索 (`Ctrl+F`)。
- **大方美观的导出中心**：
  - 支持 **独立 JSON 文件 (.json)**、**JSON 整合包 (.json)**、**ZIP 压缩包 (.zip)** 格式；
  - 配备 **iOS 风格胶囊开关** 支持一键导出为轻量分享模板；
  - **本地路径直存**：支持选择任意本地硬盘目录一键自动保存，并弹出带「在文件夹中打开」的全局浮动提示。

### 5. 🖥️ 本地独立免安装绿色桌面版
- 提供免安装便携版 Windows 客户端，解压即用，自带本地 Express 服务与极速响应。

---

## 🛠️ 技术栈

| 模块 | 核心技术 |
| :--- | :--- |
| **前端框架** | React 19 + TypeScript + Vite |
| **画布引擎** | `@xyflow/react` (React Flow 12) |
| **UI 图标** | Lucide React |
| **后端服务** | Express 5 + TypeScript + JSZip + Form-Data |
| **桌面客户端** | Electron + 原生绿色便携打包脚本 |
| **AI 模型引擎** | 小米 MiMo TTS API (`mimo-v2.5-tts-voiceclone` / `mimo-v2.5-tts-voicedesign`) |

---

## 🚀 快速开始

### 1. 环境准备
- Node.js >= 20
- npm / pnpm

### 2. 安装依赖
```bash
git clone https://github.com/LDyaoshengchen/mimo-tts-studio-game.git
cd mimo-tts-studio-game
npm install
```

### 3. 配置 API Key
复制 `.env.example` 为 `.env`，填入你的 MiMo API Key（也可在启动后点击界面右上角进行设置）：
```bash
cp .env.example .env
```
```env
MIMO_API_KEY=your_api_key_here
PORT=3001
```

### 4. 启动开发环境
```bash
npm run dev
```
启动后在浏览器打开：
- 前端界面：`http://localhost:5173`
- 后端服务：`http://localhost:3001`

---

## 📦 构建与打包

### Web 生产构建
```bash
npm run build
```

### Windows 桌面绿色客户端打包
```bash
npm run dist:win
```
打包产物将自动生成于 `desktop-build/` 目录下：
- **可执行文件目录**：`desktop-build/MiMo-Audio-Workstation-win32-x64/MiMo-Audio-Workstation.exe`
- **免解压便携压缩包**：`desktop-build/MiMo-Audio-Workstation-v0.2.0-win64-portable.zip`

---

## 📁 目录结构

```
mimo-tts-studio-main/
├── src/                  # 前端 React 主应用源码
│   ├── App.tsx          # 画布核心、工作区、所有工作节点组件
│   ├── main.tsx         # 入口文件
│   └── styles.css       # 核心样式与双主题系统
├── server/               # Express 后端 API
│   └── index.ts         # TTS 代理、工作区存储、文件导出与系统接口
├── electron/             # Electron 桌面端主进程
│   └── main.cjs
├── scripts/              # 自动化构建与便携打包脚本
│   └── package-win.js
├── public/               # 应用图标与静态资源
├── UPDATE_HISTORY.md     # 完整版本更新演进明细
└── WALKTHROUGH.md        # 最新修复与功能 Walkthrough 说明
```

---

## 📄 License & 声明

本项目基于小米 MiMo 模型 API 提供核心语音合成能力，仅供交流与学习使用。
