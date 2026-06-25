import React from 'react'

interface Props {
  connected: boolean
}

function StatusCard({ connected }: Props) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>当前状态</h2>
      <div style={styles.row}>
        <span style={styles.label}>网络状态</span>
        <span style={{
          ...styles.value,
          color: connected ? '#34c759' : '#ff3b30',
          fontWeight: 600
        }}>
          {connected ? '🟢 已联网' : '🔴 未联网'}
        </span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '12px' },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 12px 0' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
  label: { fontSize: '13px', color: '#86868b' },
  value: { fontSize: '13px', color: '#1d1d1f' }
}

export default StatusCard
