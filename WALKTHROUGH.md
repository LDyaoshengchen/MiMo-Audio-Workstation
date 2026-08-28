# 🚀 v0.8.3 批量产物自动展示最新音频 & 批量克隆节点自定义改名 Walkthrough

已成功为您完成 **【批量产物节点自动展示最新音频产出】** 以及 **【批量音频克隆节点名称自定义修改与全节点命名逻辑校验】**！

---

### ✨ 核心修复与优化细节

#### 1. 🎬 批量产物节点自动定位并突出展示最新音频 (`src/App.tsx`, `src/styles.css`)
- **自动平滑滚动**：在 `BatchArtifactNode` 中引入 `lastItemRef` 监测机制，每次单生成或批量生成新音频时，容器自动平滑滚动至最新音频卡片处，和单产物节点一样第一时间呈现最新成果；
- **金色「最新」标识与光晕高亮**：对最后生成的一条音频卡片自动打上专属的金色 **`最新`** 标签并带有柔和金色呼吸光晕边框，多轮生成一目了然！

#### 2. ✏️ 批量音频克隆节点名称支持自由编辑 (`src/App.tsx`)
- **修复根源**：移除了 `StudioNodeFrame` 中对 `batch-clone` 渲染静态 `<span>` 的硬编码限制；
- **全节点命名自由**：现在包含「批量音频克隆」在内的全部节点均可直接在顶部标题框中点击任意修改节点名称！
- **级联命名机制正常**：修改批量节点名称（如从「批量音频克隆」改为「海马」）后，自动向后级批量产物节点与暂存项同步级联更新前缀（例如生成文件名自动为 `海马_VO_00050_01`）。

---

### 📦 最终打包产物 (Windows v0.8.3)
- **Windows Setup 安装包 (.exe)**：`desktop-build/MiMo-Audio-Workstation-Setup-v0.8.3-win64.exe`
- **免解压便携压缩包 (.zip)**：`desktop-build/MiMo-Audio-Workstation-v0.8.3-win64-portable.zip`
- **本地绿色客户端目录**：`desktop-build/MiMo-Audio-Workstation-win32-x64/MiMo-Audio-Workstation.exe`
