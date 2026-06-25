# WiFi Time Tracker 项目规则

## 版本管理（铁律）

**永远不要删除已存在的 tag。** 发新版本时在旧版本号基础上加 1：

```bash
git tag v1.0.3  # 当前版本
git tag v1.0.4  # 下次发版（正确）
git tag -d v1.0.3  # ❌ 绝对禁止
```

流程：改 package.json 版本号 → 提交 → `git tag v新版本` → `git push origin v新版本`

## 技术栈

- Electron 33 + React 18 + TypeScript
- 网络检测：ping 1.1.1.1（跨平台，非 WiFi 专用）
- 数据库：sql.js（SQLite WASM，零原生依赖）
- 打包：electron-builder（Win: NSIS, Mac: DMG universal）

## 项目结构

- `src/main/monitor/ping.ts` — ping 检测逻辑
- `src/main/storage/index.ts` — SQLite 数据库
- `src/main/index.ts` — 入口、系统托盘、单实例锁
- `src/renderer/` — React 前端
