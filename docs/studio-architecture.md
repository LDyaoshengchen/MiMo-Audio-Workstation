# 前端模块结构

`src/App.tsx` 只保留 ReactFlowProvider、入口组件及兼容已有调用的公开导出。具体实现不再从入口文件反向导入。

## 模块职责

| 位置 | 职责 |
| --- | --- |
| `src/types/studio.ts` | 画板、有声书、节点、服务商及响应的共享类型 |
| `src/types/studioAudio.ts` | 音频、句段及产物的共享类型 |
| `src/studio/StudioApp.tsx` | 根状态、画板加载/保存、撤销重做、事件协调及模块装配 |
| `src/studio/*Actions.ts` | 语音合成、有声书、画板操作、存储目录操作 |
| `src/studio/config.ts` | 节点目录与默认值、服务商配置、常量 |
| `src/studio/graph.ts` | 节点输入解析、产物创建、序号迁移、保存数据清理 |
| `src/studio/audio.ts` | 录音转换、音频合并及浏览器音频处理 |
| `src/studio/theme.ts` | 主题类型、预设与初始化 |
| `src/studio/confirmation.ts` | 统一确认框入口及处理器注册 |
| `src/studio/nodeInternals.ts` | 按帧合并节点尺寸更新 |
| `src/studio/format.ts`, `tableText.ts`, `edgeGeometry.ts`, `voicePresets.ts` | 格式化、表格解析、连线计算、音色预设 |
| `src/components/nodes/` | 全部 13 类节点、共享节点框架与稳定节点注册表 |
| `src/components/studio/` | 画板视图、画板库、顶栏、API/外观/存储设置、确认框 |
| `src/components/dialogs/` | 创建、上传、Excel 粘贴、另存、模板、导出和搜索弹窗 |
| `src/components/audiobook/` | 有声书控制台界面 |
| `src/components/canvas/` | 暂存、连线删除、画布控件、右键菜单等 |

## 约束

- 共享类型只通过 `import type` 引用。入口保留原有导出，便于已有调用兼容；新增内部实现直接依赖共享模块。
- 节点及连线注册表使用模块级常量，不能在每次渲染时重新创建组件类型，避免导致节点重新挂载。
- 业务动作通过显式类型的依赖读取器获得状态和处理函数；工厂初始化不读取控制器状态，不触发请求。调用时才读取依赖，避免初始化顺序问题。
- 新增节点时同时更新 `StudioNodeType`、节点目录和注册表。架构测试检查三者对应，并检测运行时循环依赖。
- 继续保留播放器/综合台句段/产物列表的记忆化边界、长列表窗口化、命名设置、按帧缩放以及浮动保存通知。
- 文件拆分不是帧率保证。性能变化要通过实际渲染验证，不能用行数下降代替帧率测量。

## 当前边界

本次移出原入口内的独立组件、共享声明和四类业务动作，入口缩为 14 行。根控制器约 2,900 行，仍负责相互关联的画板状态、加载/保存、拖拽/连接、撤销与快捷键；并未宣称这些状态逻辑已全部拆成独立 hooks。后续抽取必须先明确状态生命周期，保留切换画板、保存队列、最新引用和撤销快照的语义。

## 验证

- `tests/studioActions.test.ts`：动作初始化、厂商头/WAV、生成序号、保存、能力拦截和确认框。
- `tests/studioViews.test.tsx`：下载命名开关、API 选择、确认/取消。
- `tests/studioArchitecture.test.ts`：注册表完整性、入口大小及运行时无循环依赖。
- `node scripts/run-zoom-benchmark.cjs dist 100`：实际生产构建的隔离缩放验证。
- 同一工具的 `--save-layout` 模式检查保存前/中/后的画布几何；`--studio-smoke` 模式检查全部 13 类节点与设置面板。测试只使用独立临时配置及本地模拟接口，不访问真实画板或厂商服务。
