import React, { useState, useEffect, useCallback } from 'react'
import { formatDuration, formatDate, DailyRecordData } from '../lib/api'

function Settings() {
  const [records, setRecords] = useState<DailyRecordData[]>([])
  const [showRecords, setShowRecords] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [autoStartLoaded, setAutoStartLoaded] = useState(false)
  const [lookbackDays, setLookbackDays] = useState(2)
  const [minPassDays, setMinPassDays] = useState(1)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notifyTimes, setNotifyTimes] = useState<string[]>(['11:30', '18:00'])
  const [passThresholdHours, setPassThresholdHours] = useState(8)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [initialConfig, setInitialConfig] = useState<any>(null)

  useEffect(() => {
    window.electronAPI.settings.getAutoStart().then(v => { setAutoStart(v); setAutoStartLoaded(true) }).catch(console.error)
    window.electronAPI.settings.getAppConfig().then(cfg => {
      setLookbackDays(cfg.lookbackDays)
      setMinPassDays(cfg.minPassDays)
      setNotificationsEnabled(cfg.notificationsEnabled)
      setNotifyTimes(cfg.notifyTimes)
      setPassThresholdHours(cfg.passThresholdHours || 8)
      setInitialConfig(cfg)
      setConfigLoaded(true)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (showRecords) {
      window.electronAPI.stats.getDaily(7).then(setRecords).catch(console.error)
    }
  }, [showRecords])

  const handleToggleAutoStart = useCallback(async () => {
    const newVal = !autoStart
    setAutoStart(newVal)
    try { await window.electronAPI.settings.setAutoStart(newVal) }
    catch { setAutoStart(!newVal) }
  }, [autoStart])

  const handleSaveConfig = useCallback(async () => {
    const ld = Math.max(1, Math.min(10, lookbackDays))
    const mp = Math.max(1, Math.min(ld, minPassDays))
    setLookbackDays(ld); setMinPassDays(mp)
    const cfg = { lookbackDays: ld, minPassDays: mp, notificationsEnabled, notifyTimes, passThresholdHours }
    try {
      await window.electronAPI.settings.setAppConfig(cfg)
      setInitialConfig(cfg)
    } catch { /* ignore */ }
  }, [lookbackDays, minPassDays, notificationsEnabled, notifyTimes])

  const handleAddTime = useCallback(() => {
    if (notifyTimes.length >= 5) return
    setNotifyTimes([...notifyTimes, '12:00'])
  }, [notifyTimes])

  const handleRemoveTime = useCallback((idx: number) => {
    setNotifyTimes(notifyTimes.filter((_, i) => i !== idx))
  }, [notifyTimes])

  const handleTimeChange = useCallback((idx: number, val: string) => {
    const next = [...notifyTimes]
    next[idx] = val
    setNotifyTimes(next)
  }, [notifyTimes])

  const handleTestNotification = useCallback((type: 'warning' | 'normal') => {
    window.electronAPI.settings.testNotification(type).catch(console.error)
  }, [])

  const handleExport = useCallback(() => {
    window.electronAPI.stats.getAllRecords().then(all => {
      const csv = ['Date,Seconds,Hours', ...all.map(r => `${r.date},${r.seconds},${(r.seconds / 3600).toFixed(1)}`)].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `network-time-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    })
  }, [])

  const changed = configLoaded && (
    lookbackDays !== initialConfig?.lookbackDays ||
    minPassDays !== initialConfig?.minPassDays ||
    notificationsEnabled !== initialConfig?.notificationsEnabled ||
    JSON.stringify(notifyTimes) !== JSON.stringify(initialConfig?.notifyTimes) ||
    passThresholdHours !== initialConfig?.passThresholdHours
  )

  return (
    <div>
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>通用设置</h2>
        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleLabel}>开机自启动</div>
            <div style={styles.toggleHint}>电脑开机后自动在后台运行</div>
          </div>
          <button style={{ ...styles.toggleSwitch, backgroundColor: autoStart ? '#34c759' : '#e8e8ed' }}
            onClick={handleToggleAutoStart} disabled={!autoStartLoaded}>
            <div style={{ ...styles.toggleKnob, transform: autoStart ? 'translateX(20px)' : 'translateX(0)' }} />
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>工作时长提醒</h2>

        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleLabel}>桌面弹窗提醒</div>
            <div style={styles.toggleHint}>开启后在法定工作日触发通知</div>
          </div>
          <button style={{ ...styles.toggleSwitch, backgroundColor: notificationsEnabled ? '#34c759' : '#e8e8ed' }}
            onClick={() => setNotificationsEnabled(!notificationsEnabled)} disabled={!configLoaded}>
            <div style={{ ...styles.toggleKnob, transform: notificationsEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
          </button>
        </div>

        {notificationsEnabled && (
          <>
            <div style={styles.configRow}>
              <div style={styles.configLabel}>检查最近</div>
              <div style={styles.configControl}>
                <button style={styles.configBtn} onClick={() => setLookbackDays(Math.max(1, lookbackDays - 1))} disabled={!configLoaded}>−</button>
                <span style={styles.configValue}>{lookbackDays} 个工作日</span>
                <button style={styles.configBtn} onClick={() => setLookbackDays(Math.min(10, lookbackDays + 1))} disabled={!configLoaded}>+</button>
              </div>
            </div>

            <div style={styles.configRow}>
              <div style={styles.configLabel}>至少达标</div>
              <div style={styles.configControl}>
                <button style={styles.configBtn} onClick={() => setMinPassDays(Math.max(1, minPassDays - 1))} disabled={!configLoaded}>−</button>
                <span style={styles.configValue}>{minPassDays} 天</span>
                <button style={styles.configBtn} onClick={() => setMinPassDays(Math.min(lookbackDays, minPassDays + 1))} disabled={!configLoaded}>+</button>
              </div>
            </div>

            <div style={styles.configRow}>
              <div style={styles.configLabel}>达标阈值</div>
              <div style={styles.configControl}>
                <button style={styles.configBtn} onClick={() => setPassThresholdHours(Math.max(1, passThresholdHours - 1))} disabled={!configLoaded}>−</button>
                <span style={styles.configValue}>{passThresholdHours} 小时</span>
                <button style={styles.configBtn} onClick={() => setPassThresholdHours(Math.min(24, passThresholdHours + 1))} disabled={!configLoaded}>+</button>
              </div>
            </div>

            <div style={{ ...styles.sectionTitle, fontSize: '13px', marginBottom: '8px' }}>提醒时间</div>
            {notifyTimes.map((t, i) => (
              <div key={i} style={styles.configRow}>
                <input type="time" value={t} onChange={e => handleTimeChange(i, e.target.value)}
                  style={styles.timeInput} disabled={!configLoaded} />
                <span style={{ fontSize: '11px', color: '#86868b', marginLeft: '8px' }}>#{i + 1}</span>
                <button style={{ ...styles.configBtn, marginLeft: 'auto', borderColor: '#ff3b30', color: '#ff3b30' }}
                  onClick={() => handleRemoveTime(i)} disabled={!configLoaded || notifyTimes.length <= 1}>✕</button>
              </div>
            ))}

            {notifyTimes.length < 5 && (
              <button style={{ ...styles.addTimeBtn }} onClick={handleAddTime} disabled={!configLoaded}>
                + 添加提醒时间
              </button>
            )}

            <div style={styles.configHint}>
              近{lookbackDays}个工作日中少于{minPassDays}天超过{passThresholdHours}小时则触发提醒
            </div>
          </>
        )}

        {changed && (
          <button style={{ ...styles.button, marginTop: '10px', textAlign: 'center' as const }} onClick={handleSaveConfig}>
            💾 保存设置
          </button>
        )}
        {notificationsEnabled && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button style={{ ...styles.button, textAlign: 'center' as const, backgroundColor: '#ffebee', color: '#c62828', flex: 1 }} onClick={() => handleTestNotification('warning')}>
              🔴 测试异常通知
            </button>
            <button style={{ ...styles.button, textAlign: 'center' as const, backgroundColor: '#e8f5e9', color: '#2e7d32', flex: 1 }} onClick={() => handleTestNotification('normal')}>
              🟢 测试正常通知
            </button>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>数据管理</h2>
        <button style={styles.button} onClick={handleExport}>📤 导出数据 (CSV)</button>
        <div style={styles.hint}>导出所有联网记录</div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>最近记录</h2>
        <button style={{ ...styles.button, ...(showRecords ? styles.buttonActive : {}) }}
          onClick={() => setShowRecords(!showRecords)}>
          {showRecords ? '收起' : '展开'} 近7天
        </button>
        {showRecords && (
          <div style={styles.eventList}>
            {records.length === 0 ? <div style={styles.empty}>暂无数据</div> :
              records.map(r => (
                <div key={r.date} style={styles.eventItem}>
                  <span style={styles.eventDuration}>{formatDuration(r.seconds)}</span>
                  <div style={styles.eventTime}>{formatDate(r.date)}</div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>关于</h2>
        <div style={styles.about}>
          <p>Network Time Tracker</p>
          <p style={styles.aboutSub}>自动统计电脑联网时长</p>
          <p style={styles.aboutSub}>数据存储在本地，不会上传</p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '12px' },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 12px 0' },
  toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' },
  toggleLabel: { fontSize: '13px', fontWeight: 500, color: '#1d1d1f' },
  toggleHint: { fontSize: '11px', color: '#86868b', marginTop: '2px' },
  toggleSwitch: { width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative' as const, transition: 'background-color 0.2s', padding: 0, flexShrink: 0 },
  toggleKnob: { width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', position: 'absolute' as const, top: '2px', left: '2px', transition: 'transform 0.2s' },
  configRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
  configLabel: { fontSize: '13px', color: '#1d1d1f', fontWeight: 500 },
  configControl: { display: 'flex', alignItems: 'center', gap: '8px' },
  configBtn: { width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d0d0d0', backgroundColor: '#f5f5f7', cursor: 'pointer', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' as const },
  configValue: { fontSize: '13px', fontWeight: 600, color: '#1d1d1f', minWidth: '70px', textAlign: 'center' as const },
  configHint: { fontSize: '11px', color: '#86868b', marginTop: '8px' },
  timeInput: { fontSize: '13px', padding: '4px 8px', border: '1px solid #d0d0d0', borderRadius: '6px', backgroundColor: '#f5f5f7', color: '#1d1d1f', fontFamily: 'inherit' as const },
  addTimeBtn: { width: '100%', padding: '8px', marginTop: '4px', backgroundColor: '#f0f0f0', border: '1px dashed #007aff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#007aff', fontWeight: 500, textAlign: 'center' as const },
  button: { width: '100%', padding: '10px 16px', backgroundColor: '#f5f5f7', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#1d1d1f', textAlign: 'left' as const },
  buttonActive: { backgroundColor: '#e8e8ed' },
  hint: { fontSize: '11px', color: '#86868b', marginTop: '6px' },
  eventList: { marginTop: '12px' },
  eventItem: { padding: '10px 0', borderBottom: '1px solid #f0f0f0' },
  eventDuration: { fontSize: '13px', color: '#007aff', fontWeight: 500 },
  eventTime: { fontSize: '11px', color: '#86868b', marginTop: '4px' },
  empty: { textAlign: 'center' as const, padding: '20px', color: '#86868b', fontSize: '13px' },
  about: { fontSize: '13px', color: '#1d1d1f', lineHeight: 1.6 },
  aboutSub: { fontSize: '12px', color: '#86868b', margin: '2px 0' }
}

export default Settings
