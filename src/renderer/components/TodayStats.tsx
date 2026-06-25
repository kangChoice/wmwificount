import React from 'react'
import { formatDuration } from '../lib/api'

interface Props {
  totalSeconds: number
  warningStatus: 'warning' | 'normal' | 'no-data'
}

function TodayStats({ totalSeconds, warningStatus }: Props) {
  const dayPercent = Math.min(100, Math.round((totalSeconds / 86400) * 100))

  return (
    <div>
      {warningStatus === 'warning' && (
        <div style={styles.warning}>
          ⚠️ 前两天联网时长均不足8小时，今天建议超过8小时
        </div>
      )}
      {warningStatus === 'normal' && (
        <div style={styles.normal}>
          ✅ 前两天联网情况正常
        </div>
      )}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>今日统计</h2>
        <div style={styles.statBox}>
          <div style={styles.statNumber}>{formatDuration(totalSeconds)}</div>
          <div style={styles.statLabel}>总计联网</div>
        </div>
        {totalSeconds > 0 && (
          <div style={styles.progressContainer}>
            <span style={styles.progressLabel}>联网率</span>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${dayPercent}%` }} />
            </div>
            <span style={styles.progressPercent}>{dayPercent}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  warning: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '12px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#856404',
    lineHeight: 1.5
  },
  normal: {
    backgroundColor: '#e8f5e9',
    border: '1px solid #4caf50',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '12px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#2e7d32',
    lineHeight: 1.5
  },
  card: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '12px'
  },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 12px 0' },
  statBox: { backgroundColor: '#f5f5f7', borderRadius: '10px', padding: '20px', textAlign: 'center' as const },
  statNumber: { fontSize: '28px', fontWeight: 700, color: '#1d1d1f', marginBottom: '4px' },
  statLabel: { fontSize: '12px', color: '#86868b' },
  progressContainer: { marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' },
  progressLabel: { fontSize: '12px', color: '#86868b', whiteSpace: 'nowrap' as const },
  progressBar: { flex: 1, height: '8px', backgroundColor: '#e8e8ed', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#34c759', borderRadius: '4px', transition: 'width 0.5s ease' },
  progressPercent: { fontSize: '12px', color: '#1d1d1f', fontWeight: 600, minWidth: '32px', textAlign: 'right' as const }
}

export default TodayStats
