import React, { useState, useEffect, useCallback } from 'react'
import { ConnectionEventData, formatDuration, formatDate } from '../lib/api'

interface Props {
  onRefresh: () => void
}

function Settings({ onRefresh }: Props) {
  const [events, setEvents] = useState<ConnectionEventData[]>([])
  const [showEvents, setShowEvents] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [autoStartLoaded, setAutoStartLoaded] = useState(false)

  useEffect(() => {
    if (showEvents) {
      window.electronAPI.stats.getEvents(7).then(setEvents).catch(console.error)
    }
  }, [showEvents])

  useEffect(() => {
    window.electronAPI.settings.getAutoStart().then(val => {
      setAutoStart(val)
      setAutoStartLoaded(true)
    }).catch(console.error)
  }, [])

  const handleToggleAutoStart = useCallback(async () => {
    const newVal = !autoStart
    setAutoStart(newVal)
    try {
      await window.electronAPI.settings.setAutoStart(newVal)
    } catch (err) {
      console.error('Failed to set auto-start:', err)
      setAutoStart(!newVal) // revert
    }
  }, [autoStart])

  const handleExport = useCallback(() => {
    window.electronAPI.stats.getEvents(365).then(allEvents => {
      const csv = [
        'ID,SSID,Platform,Start Time,End Time,Duration (s)',
        ...allEvents.map(e =>
          `${e.id},${e.ssid},${e.platform},${e.start_time},${e.end_time || ''},${e.duration_seconds || ''}`
        )
      ].join('\n')

      // Create a Blob and trigger download via a temporary anchor
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      // We need to use a preload method to save file, or create anchor in renderer
      const downloadLink = document.createElement('a')
      downloadLink.href = url
      downloadLink.download = `wifi-stats-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      URL.revokeObjectURL(url)
    })
  }, [])

  return (
    <div>
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>通用设置</h2>
        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleLabel}>开机自启动</div>
            <div style={styles.toggleHint}>电脑开机后自动在后台运行</div>
          </div>
          <button
            style={{
              ...styles.toggleSwitch,
              backgroundColor: autoStart ? '#34c759' : '#e8e8ed',
            }}
            onClick={handleToggleAutoStart}
            disabled={!autoStartLoaded}
          >
            <div style={{
              ...styles.toggleKnob,
              transform: autoStart ? 'translateX(20px)' : 'translateX(0)',
            }} />
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>数据管理</h2>
        <button style={styles.button} onClick={handleExport}>
          📤 导出数据 (CSV)
        </button>
        <div style={styles.hint}>导出最近一年的连接记录</div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>最近连接记录</h2>
        <button
          style={{ ...styles.button, ...(showEvents ? styles.buttonActive : {}) }}
          onClick={() => setShowEvents(!showEvents)}
        >
          {showEvents ? '收起' : '展开'} 近7天记录
        </button>

        {showEvents && (
          <div style={styles.eventList}>
            {events.length === 0 ? (
              <div style={styles.empty}>暂无记录</div>
            ) : (
              events.map(evt => (
                <div key={evt.id} style={styles.eventItem}>
                  <div style={styles.eventTop}>
                    <span style={styles.eventSSID}>{evt.ssid}</span>
                    <span style={styles.eventDuration}>
                      {evt.duration_seconds ? formatDuration(evt.duration_seconds) : '进行中'}
                    </span>
                  </div>
                  <div style={styles.eventTime}>
                    {formatDate(evt.start_time)} {new Date(evt.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    {evt.end_time && ` → ${new Date(evt.end_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>关于</h2>
        <div style={styles.about}>
          <p>WiFi Time Tracker v1.0.1</p>
          <p style={styles.aboutSub}>自动统计电脑连接 WiFi 的时长</p>
          <p style={styles.aboutSub}>数据存储在本地，不会上传</p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0'
  },
  toggleLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#1d1d1f'
  },
  toggleHint: {
    fontSize: '11px',
    color: '#86868b',
    marginTop: '2px'
  },
  toggleSwitch: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background-color 0.2s',
    padding: 0,
    flexShrink: 0
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    transition: 'transform 0.2s'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '12px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1d1d1f',
    margin: '0 0 12px 0'
  },
  button: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#f5f5f7',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#1d1d1f',
    textAlign: 'left' as const,
    transition: 'background-color 0.2s'
  },
  buttonActive: {
    backgroundColor: '#e8e8ed'
  },
  hint: {
    fontSize: '11px',
    color: '#86868b',
    marginTop: '6px'
  },
  eventList: {
    marginTop: '12px',
    maxHeight: '300px',
    overflow: 'auto'
  },
  eventItem: {
    padding: '10px 0',
    borderBottom: '1px solid #f0f0f0'
  },
  eventTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px'
  },
  eventSSID: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1d1d1f'
  },
  eventDuration: {
    fontSize: '13px',
    color: '#007aff',
    fontWeight: 500
  },
  eventTime: {
    fontSize: '11px',
    color: '#86868b'
  },
  empty: {
    textAlign: 'center' as const,
    padding: '20px',
    color: '#86868b',
    fontSize: '13px'
  },
  about: {
    fontSize: '13px',
    color: '#1d1d1f',
    lineHeight: 1.6
  },
  aboutSub: {
    fontSize: '12px',
    color: '#86868b',
    margin: '2px 0'
  }
}

export default Settings
