import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'

function getTrayIconPath(): string {
  const devPath = path.join(__dirname, '../../resources/icons/tray-icon.png')
  if (fs.existsSync(devPath)) return devPath
  const pkgPath = path.join(app.getAppPath(), 'resources/icons/tray-icon.png')
  if (fs.existsSync(pkgPath)) return pkgPath
  return path.join(app.getAppPath(), 'resources/build/icon.png')
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = getTrayIconPath()
  let tray: Tray

  try {
    const img = nativeImage.createFromPath(iconPath)
    tray = new Tray(img.resize({ width: 22, height: 22 }))
  } catch {
    const fallbackPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
      0x60, 0x82
    ])
    tray = new Tray(nativeImage.createFromBuffer(fallbackPng))
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => { mainWindow.show(); mainWindow.focus() } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])

  tray.setToolTip('Network Time Tracker')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
  tray.on('click', () => {
    if (process.platform === 'win32') tray.popUpContextMenu()
    else { mainWindow.show(); mainWindow.focus() }
  })

  return tray
}
