# WiFi Time Tracker 📶

> 真实统计电脑连接 WiFi 的时长 — 支持 Windows + macOS

## 功能

- 📊 **自动记录** WiFi 连接/断开时间，后台常驻
- 📈 **今日统计** — 今日总连接时长、连接次数
- 📉 **历史趋势** — 近 7 天 / 30 天图表
- 📤 **导出数据** — CSV 格式导出
- 🖥️ **系统托盘** — 后台运行，不打扰

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包
npm run package:win   # Windows
npm run package:mac   # macOS
```

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript + Vite |
| 数据库 | SQLite (sql.js / WASM) |
| 图表 | Chart.js |
| 系统托盘 | Electron Tray API |
| WiFi 监控 Win | `netsh wlan show interfaces` 命令 |
| WiFi 监控 Mac | `airport -I` 命令 |

## 如何工作

App 在系统托盘后台常驻，每 10 秒通过系统命令查询 WiFi 状态：

- **Windows**: `netsh wlan show interfaces` → 解析 SSID、信号、连接状态
- **macOS**: `airport -I` → 解析 SSID、RSSI、运行状态

对比前后两次状态，检测 **连接/断开/切换** 事件，记录到本地 SQLite 数据库。

## 开发环境

- Node.js 20+
- npm 9+
- 无需 Rust、无需 C++ Build Tools

## 项目结构

```
wifi-time-tracker/
├── src/main/           # Electron 主进程
│   ├── index.ts        # 入口 + 生命周期
│   ├── tray.ts         # 系统托盘
│   ├── ipc-handlers.ts # IPC 通信 + WiFi 事件处理
│   ├── monitor/        # WiFi 监控
│   │   ├── index.ts    # WiFiMonitor 类
│   │   └── platforms/  # 平台实现 (macos.ts / windows.ts)
│   └── storage/        # SQLite 数据库
├── src/preload/        # Electron preload (contextBridge)
├── src/renderer/       # React 前端
│   ├── App.tsx
│   └── components/     # StatusCard, TodayStats, HistoryChart, Settings
└── resources/icons/    # 托盘图标
```

## 许可证

MIT
