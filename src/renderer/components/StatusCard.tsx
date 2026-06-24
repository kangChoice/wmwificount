import React from 'react'
import { WiFiStateData, formatDuration } from '../lib/api'

interface Props {
  state: WiFiStateData | null
  sessionDuration: number
}

function StatusCard({ state, sessionDuration }: Props) {
  const isConnected = state?.connected ?? false
  const signalStr = state?.signalStrength
    ? `${state.signalStrength}%`
    : '--'

  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>当前状态</h2>

      <div style={styles.row}>
        <span style={styles.label}>连接状态</span>
        <span style={{
          ...styles.value,
          color: isConnected ? '#34c759' : '#ff3b30',
          fontWeight: 600
        }}>
          {isConnected ? '🟢 已连接' : '🔴 未连接'}
        </span>
      </div>

      {isConnected && (
        <>
          <div style={styles.row}>
            <span style={styles.label}>WiFi 名称</span>
            <span style={styles.value}>{state?.ssid || '--'}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>信号强度</span>
            <span style={styles.value}>{signalStr}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>当前已连接</span>
            <span style={{ ...styles.value, fontWeight: 600 }}>
              {formatDuration(sessionDuration)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
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
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f0f0f0'
  },
  label: {
    fontSize: '13px',
    color: '#86868b'
  },
  value: {
    fontSize: '13px',
    color: '#1d1d1f'
  }
}

export default StatusCard
