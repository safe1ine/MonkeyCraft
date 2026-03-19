# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

### 项目技术栈与架构
- Date: 2026-03-19
- Context: Agent 在执行前端性能优化任务时发现
- Category: 代码结构
- Instructions:
  - 项目是纯前端 Minecraft 风格 3D 体素沙盒游戏，无构建工具、无 npm 依赖
  - 渲染引擎：Three.js（本地打包在 src/lib/three.js）
  - 模块系统：原生 ES Modules，通过 `<script type="module">` 加载
  - 静态文件服务：`python3 -m http.server 8000`
  - 部署方式：GitHub Pages 直接上传，无构建步骤
  - 存储：IndexedDB（用于存档区块和玩家数据）
  - 音频：Web Audio API 程序化合成

### 项目核心文件结构
- Date: 2026-03-19
- Context: Agent 在执行前端性能优化任务时发现
- Category: 代码结构
- Instructions:
  - `src/engine/Game.js` - 游戏主循环、渲染器初始化、事件绑定
  - `src/world/World.js` - 世界系统、区块管理、地形生成、方块渲染（合并几何体）
  - `src/world/blockMaterials.js` - 方块材质系统，NearestFilter 像素风
  - `src/player/PlayerController.js` - 玩家控制、碰撞检测、DDA 射线投射
  - `src/ui/Hud.js` - HUD 系统、快捷栏、生命值/饥饿值
  - `src/constants.js` - 游戏配置常量（区块大小16、最大高度64、渲染距离3）

### 渲染性能优化方案
- Date: 2026-03-19
- Context: Agent 在执行前端性能优化任务时发现
- Category: 代码模式
- Instructions:
  - World.js 使用按区块合并几何体（Merged Geometry）方案，每个区块按材质分组生成少量 Mesh
  - 只构建暴露面（face culling），不构建被遮挡的面，大幅减少顶点数
  - 植物类方块（cross renderType）仍使用独立 Mesh，因为数量少且需要特殊渲染
  - 方块变更时只重建受影响的区块及边界邻居区块
  - DDA 射线投射用于方块选择，不依赖 Three.js Raycaster 遍历 mesh
