import React, { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { DailyStatsData, formatDuration, formatDate } from '../lib/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type Range = 7 | 30

function HistoryChart() {
  const [range, setRange] = useState<Range>(7)
  const [data, setData] = useState<DailyStatsData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.electronAPI.stats.getDaily(range)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [range])

  const chartData = {
    labels: data.map(d => formatDate(d.day)),
    datasets: [
      {
        label: '连接时长',
        data: data.map(d => Math.round(d.total_seconds / 3600 * 10) / 10), // hours
        backgroundColor: '#007aff',
        borderRadius: 4,
        borderSkipped: false as const
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${formatDuration(ctx.raw * 3600)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (val: any) => `${val}h`,
          color: '#86868b',
          font: { size: 11 }
        },
        grid: { color: '#f0f0f0' }
      },
      x: {
        ticks: {
          color: '#86868b',
          font: { size: 11 }
        },
        grid: { display: false }
      }
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.sectionTitle}>连接趋势</h2>
        <div style={styles.toggle}>
          <button
            style={{ ...styles.toggleBtn, ...(range === 7 ? styles.toggleActive : {}) }}
            onClick={() => setRange(7)}
          >
            7天
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(range === 30 ? styles.toggleActive : {}) }}
            onClick={() => setRange(30)}
          >
            30天
          </button>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>加载中...</div>
      ) : data.length === 0 ? (
        <div style={styles.empty}>暂无数据，连接 WiFi 后会自动记录</div>
      ) : (
        <div style={styles.chartContainer}>
          <Bar data={chartData} options={options} />
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
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1d1d1f',
    margin: 0
  },
  toggle: {
    display: 'flex',
    backgroundColor: '#f0f0f0',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  toggleBtn: {
    padding: '6px 14px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: '#86868b',
    transition: 'all 0.2s'
  },
  toggleActive: {
    backgroundColor: '#007aff',
    color: '#fff',
    borderRadius: '6px'
  },
  chartContainer: {
    height: '250px',
    position: 'relative' as const
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#86868b',
    fontSize: '13px'
  },
  empty: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#86868b',
    fontSize: '13px'
  }
}

export default HistoryChart
