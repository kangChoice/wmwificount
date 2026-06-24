import React from 'react'
import { formatDuration } from '../lib/api'

interface Props {
  totalSeconds: number
  sessionCount: number
  isConnected: boolean
  currentSessionSeconds: number
}

function TodayStats({ totalSeconds, sessionCount, isConnected, currentSessionSeconds }: Props) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>今日统计</h2>

      <div style={styles.statsGrid}>
        <div style={styles.statBox}>
          <div style={styles.statNumber}>{formatDuration(totalSeconds)}</div>
          <div style={styles.statLabel}>总计连接</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statNumber}>{sessionCount}次</div>
          <div style={styles.statLabel}>连接次数</div>
        </div>
      </div>

      {/* Visual progress bar representing how much of the day has been connected */}
      {totalSeconds > 0 && (
        <div style={styles.progressContainer}>
          <div style={styles.progressLabel}>
            今日联网率
          </div>
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: `${Math.min(100, Math.round((totalSeconds / 86400) * 100))}%`
            }} />
          </div>
          <div style={styles.progressPercent}>
            {Math.round((totalSeconds / 86400) * 100)}%
          </div>
        </div>
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
  statsGrid: {
    display: 'flex',
    gap: '12px'
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    borderRadius: '10px',
    padding: '14px',
    textAlign: 'center' as const
  },
  statNumber: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1d1d1f',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: '#86868b'
  },
  progressContainer: {
    marginTop: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  progressLabel: {
    fontSize: '12px',
    color: '#86868b',
    whiteSpace: 'nowrap'
  },
  progressBar: {
    flex: 1,
    height: '8px',
    backgroundColor: '#e8e8ed',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34c759',
    borderRadius: '4px',
    transition: 'width 0.5s ease'
  },
  progressPercent: {
    fontSize: '12px',
    color: '#1d1d1f',
    fontWeight: 600,
    minWidth: '32px',
    textAlign: 'right'
  }
}

export default TodayStats
