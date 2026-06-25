import React, { useState, useEffect } from 'react'
import StatusCard from './components/StatusCard'
import TodayStats from './components/TodayStats'
import HistoryChart from './components/HistoryChart'
import Settings from './components/Settings'

type Tab = 'status' | 'history' | 'settings'

function App() {
  const [connected, setConnected] = useState(false)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [warningStatus, setWarningStatus] = useState<'warning' | 'normal' | 'no-data'>('no-data')
  const [warningPassCount, setWarningPassCount] = useState(0)
  const [warningMinPassDays, setWarningMinPassDays] = useState(1)
  const [warningLookback, setWarningLookback] = useState(2)
  const [warningThresholdHours, setWarningThresholdHours] = useState(8)
  const [activeTab, setActiveTab] = useState<Tab>('status')

  useEffect(() => {
    Promise.all([
      window.electronAPI.stats.getConnected(),
      window.electronAPI.stats.getTotal(),
      window.electronAPI.stats.getWarning()
    ]).then(([c, t, w]) => {
      setConnected(c)
      setTotalSeconds(t)
      setWarningStatus(w.status)
      setWarningPassCount(w.passCount)
      setWarningMinPassDays(w.minPassDays)
      setWarningLookback(w.lookback)
      setWarningThresholdHours(w.thresholdHours)
    })

    const unsubscribe = window.electronAPI.stats.onTick((data) => {
      setConnected(data.connected)
      setTotalSeconds(data.totalSeconds)
      setWarningStatus(data.warningStatus)
      setWarningPassCount(data.warningPassCount)
      setWarningMinPassDays(data.warningMinPassDays)
      setWarningLookback(data.warningLookback)
      setWarningThresholdHours(data.warningThresholdHours)
    })
    return unsubscribe
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📶 Network Time Tracker</h1>
      </div>

      <div style={styles.tabBar}>
        <button style={{ ...styles.tab, ...(activeTab === 'status' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('status')}>📊 状态</button>
        <button style={{ ...styles.tab, ...(activeTab === 'history' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('history')}>📈 历史</button>
        <button style={{ ...styles.tab, ...(activeTab === 'settings' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('settings')}>⚙️ 设置</button>
      </div>

      <div style={styles.content}>
        {activeTab === 'status' && (
          <>
            <StatusCard connected={connected} />
            <TodayStats
              totalSeconds={totalSeconds}
              warningStatus={warningStatus}
              warningPassCount={warningPassCount}
              warningMinPassDays={warningMinPassDays}
              warningLookback={warningLookback}
              warningThresholdHours={warningThresholdHours}
            />
          </>
        )}
        {activeTab === 'history' && <HistoryChart />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', overflow: 'hidden' },
  header: { padding: '16px 20px 8px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff' },
  title: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#1d1d1f' },
  tabBar: { display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', padding: '0 12px' },
  tab: { flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#86868b', borderBottom: '2px solid transparent', transition: 'all 0.2s' },
  tabActive: { color: '#007aff', borderBottomColor: '#007aff' },
  content: { flex: 1, overflow: 'auto', padding: '16px' }
}

export default App
