# Network Time Tracker 项目规则

## 发版规则（铁律）

**永远不要主动创建 tag 或触发流水线。** 只有用户明确说"发版"、"打标签"、"触发流水线"时才可以操作。

正确流程：
```
用户说"发版" → 改 package.json 版本号 → git commit → git tag → git push tag
```

## 禁止操作

| 操作 | 允许？ |
|------|:------:|
| 自己决定发版 | ❌ **禁止** |
| 主动打 tag | ❌ **禁止** |
| 主动推 tag | ❌ **禁止** |
| 删除 tag | ❌ **禁止** |
| 用户说"发版"后执行 | ✅ |

## 技术栈

- Electron 33 + React 18 + TypeScript
- 网络检测：TCP 连接（1.1.1.1:80 / 443, 8.8.8.8:53）
- 数据存储：JSON 文件（零外部依赖）
- 打包：electron-builder（Win: NSIS, Mac: DMG universal）

## 项目结构

- `src/main/tracker.ts` — 核心计时逻辑
- `src/main/index.ts` — 入口、系统托盘、单实例锁
- `src/renderer/` — React 前端
