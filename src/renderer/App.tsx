import React, { useState, useEffect, useCallback } from 'react'
import StatusCard from './components/StatusCard'
import TodayStats from './components/TodayStats'
import HistoryChart from './components/HistoryChart'
import Settings from './components/Settings'
import { WiFiStateData, formatDuration } from './lib/api'

type Tab = 'status' | 'history' | 'settings'

function App() {
  const [currentState, setCurrentState] = useState<WiFiStateData | null>(null)
  const [todayTotal, setTodayTotal] = useState(0)
  const [currentSessionDuration, setCurrentSessionDuration] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('status')

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const [state, total] = await Promise.all([
          window.electronAPI.wifi.getState(),
          window.electronAPI.stats.getTodayTotal()
        ])
        setCurrentState(state)
        setTodayTotal(total)
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }
    load()
  }, [])

  // Listen for WiFi state changes
  useEffect(() => {
    const unsubscribe = window.electronAPI.wifi.onStateChange((state) => {
      setCurrentState(state)
      // Refresh stats when state changes
      window.electronAPI.stats.getTodayTotal().then(setTodayTotal)
    })
    return unsubscribe
  }, [])

  // Update current session duration every second
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const activeEvent = await window.electronAPI.wifi.getActiveEvent()
        if (activeEvent) {
          const start = new Date(activeEvent.start_time)
          const now = new Date()
          setCurrentSessionDuration(Math.floor((now.getTime() - start.getTime()) / 1000))
        } else {
          setCurrentSessionDuration(0)
        }
      } catch {
        // ignore
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = useCallback(() => {
    window.electronAPI.stats.getTodayTotal().then(setTodayTotal)
    window.electronAPI.wifi.getState().then(setCurrentState)
  }, [])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📶 WiFi Time Tracker</h1>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'status' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('status')}
        >
          📊 状态
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'history' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('history')}
        >
          📈 历史
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'settings' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ 设置
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'status' && (
          <>
            <StatusCard
              state={currentState}
              sessionDuration={currentSessionDuration}
            />
            <TodayStats
              totalSeconds={todayTotal + (currentState?.connected ? currentSessionDuration : 0)}
            />
          </>
        )}

        {activeTab === 'history' && (
          <HistoryChart />
        )}

        {activeTab === 'settings' && (
          <Settings onRefresh={handleRefresh} />
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden'
  },
  header: {
    padding: '16px 20px 8px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#fff'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#1d1d1f'
  },
  tabBar: {
    display: 'flex',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '0 12px'
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#86868b',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#007aff',
    borderBottomColor: '#007aff'
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px'
  }
}

export default App
