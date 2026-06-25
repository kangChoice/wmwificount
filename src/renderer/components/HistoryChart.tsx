import React, { useState, useEffect } from 'react'
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatDuration, formatDate, DailyRecordData } from '../lib/api'

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type Range = 7 | 30

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function HistoryChart() {
  const [range, setRange] = useState<Range>(7)
  const [data, setData] = useState<DailyRecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [dayInfo, setDayInfo] = useState<Map<string, { isWorkday: boolean; seconds: number }>>(new Map())
  const [thresholdSeconds, setThresholdSeconds] = useState(28800)

  useEffect(() => {
    window.electronAPI.stats.getThreshold().then(setThresholdSeconds).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    window.electronAPI.stats.getDaily(range)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [range])

  // Build calendar day info
  useEffect(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
    const info = new Map<string, { isWorkday: boolean; seconds: number }>()
    const promises: Promise<void>[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const record = data.find(r => r.date === dateStr)
      const seconds = record ? record.seconds : 0
      promises.push(
        window.electronAPI.calendar.isWorkday(dateStr).then(isWorkday => {
          info.set(dateStr, { isWorkday, seconds })
        }).catch(() => {
          // fallback: weekend check
          const d = new Date(dateStr)
          info.set(dateStr, { isWorkday: d.getDay() !== 0 && d.getDay() !== 6, seconds })
        })
      )
    }

    Promise.all(promises).then(() => setDayInfo(info)).catch(() => setDayInfo(info))
  }, [data, calendarMonth, calendarYear])

  // Navigate month
  const prevMonth = () => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1) } else { setCalendarMonth(calendarMonth - 1) } }
  const nextMonth = () => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1) } else { setCalendarMonth(calendarMonth + 1) } }

  const chartData = {
    labels: data.map(d => formatDate(d.date)),
    datasets: [{
      label: '联网时长',
      data: data.map(d => Math.round(d.seconds / 3600 * 10) / 10),
      backgroundColor: '#007aff', borderRadius: 4, borderSkipped: false as const
    }]
  }

  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => formatDuration(ctx.raw * 3600) } } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (val: any) => `${val}h`, color: '#86868b', font: { size: 11 } }, grid: { color: '#f0f0f0' } },
      x: { ticks: { color: '#86868b', font: { size: 11 } }, grid: { display: false } }
    }
  }

  // Calendar rendering
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay()
  const today = new Date()

  const calendarCells = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} style={styles.calDay} />)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const info = dayInfo.get(dateStr)
    const isToday = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth && today.getDate() === d
    const isWeekend = new Date(calendarYear, calendarMonth, d).getDay() === 0 || new Date(calendarYear, calendarMonth, d).getDay() === 6

    let bgColor = '#f5f5f7'
    let textColor = '#1d1d1f'
    if (info) {
      if (!info.isWorkday && info.seconds === 0) {
        // Holiday with no data — keep neutral
      } else if (info.isWorkday && info.seconds >= thresholdSeconds) {
        bgColor = '#e8f5e9'; textColor = '#2e7d32'  // green: workday >= threshold
      } else if (info.isWorkday && info.seconds > 0 && info.seconds < thresholdSeconds) {
        bgColor = '#ffebee'; textColor = '#c62828'  // red: workday < threshold (not met)
      } else if (info.isWorkday && info.seconds === 0) {
        bgColor = '#fff3cd'; textColor = '#856404'  // yellow: no data
      }
    }

    calendarCells.push(
      <div key={d} style={{
        ...styles.calDay,
        backgroundColor: bgColor,
        border: isToday ? '2px solid #007aff' : '1px solid #e8e8ed',
      }}>
        <div style={{ ...styles.calDayNum, color: textColor }}>{d}</div>
        {info && info.isWorkday && (
          <div style={{ ...styles.calDayBar, backgroundColor: info.seconds >= thresholdSeconds ? '#4caf50' : info.seconds > 0 ? '#ef5350' : '#ffc107' }} />
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.sectionTitle}>联网趋势</h2>
          <div style={styles.toggle}>
            <button style={{ ...styles.toggleBtn, ...(range === 7 ? styles.toggleActive : {}) }} onClick={() => setRange(7)}>7天</button>
            <button style={{ ...styles.toggleBtn, ...(range === 30 ? styles.toggleActive : {}) }} onClick={() => setRange(30)}>30天</button>
          </div>
        </div>
        {loading ? <div style={styles.empty}>加载中...</div> :
         data.length === 0 ? <div style={styles.empty}>暂无数据</div> :
         <div style={styles.chartContainer}><Bar data={chartData} options={options} /></div>}
      </div>

      {/* Calendar card */}
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.sectionTitle}>工作日历</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button style={styles.monthBtn} onClick={prevMonth}>◀</button>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', minWidth: '80px', textAlign: 'center' as const }}>
              {calendarYear}年{calendarMonth + 1}月
            </span>
            <button style={styles.monthBtn} onClick={nextMonth}>▶</button>
          </div>
        </div>

        <div style={styles.calGrid}>
          {WEEKDAYS.map(w => <div key={w} style={styles.calHeader}>{w}</div>)}
          {calendarCells}
        </div>

        <div style={styles.legend}>
          <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#e8f5e9', border: '1px solid #4caf50' }} /> 已达阈值</span>
          <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#ffebee', border: '1px solid #ef5350' }} /> 未达阈值</span>
          <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#fff3cd', border: '1px solid #ffc107' }} /> 无数据</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '12px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#1d1d1f', margin: 0 },
  toggle: { display: 'flex', backgroundColor: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' },
  toggleBtn: { padding: '6px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: '#86868b' },
  toggleActive: { backgroundColor: '#007aff', color: '#fff', borderRadius: '6px' },
  chartContainer: { height: '250px', position: 'relative' as const },
  empty: { textAlign: 'center' as const, padding: '40px', color: '#86868b', fontSize: '13px' },
  monthBtn: { width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d0d0d0', backgroundColor: '#f5f5f7', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' as const },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' },
  calHeader: { textAlign: 'center' as const, fontSize: '11px', fontWeight: 600, color: '#86868b', padding: '6px 0' },
  calDay: { height: '48px', borderRadius: '8px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'default' },
  calDayNum: { fontSize: '13px', fontWeight: 600 },
  calDayBar: { width: '16px', height: '3px', borderRadius: '2px' },
  legend: { display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' as const, justifyContent: 'center' as const },
  legendItem: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#86868b' },
  legendDot: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px' }
}

export default HistoryChart
