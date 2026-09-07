'use client'

import styles from './reports.module.css'
import {
  type OrgCtx, type Range, useReport, num, pct, Panel, StatTile, Table, ReportState, type Col,
} from './lib'

interface SessionPerf {
  session_id: string
  name: string
  occurrences: number
  avg_bookings: number
  avg_capacity: number | null
  fill_rate: number | null
  attended: number
  no_shows: number
}
interface HeatCell { day_of_week: number; hour: number; fill_rate: number }
interface AttendanceReport {
  summary: {
    total_sessions: number; bookings: number; attended: number; no_shows: number
    avg_fill_rate: number; avg_attendance_rate: number
  }
  sessions: SessionPerf[]
  heatmap: HeatCell[]
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon-first

function heatColor(v: number) {
  if (v <= 0) return '#f4f4f4'
  const a = Math.min(v, 1) * 0.85 + 0.15
  return `rgba(8, 80, 65, ${a.toFixed(3)})`
}

function Heatmap({ cells }: { cells: HeatCell[] }) {
  if (cells.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: 13 }}>No capacity data in this range.</div>
  }
  const hours = Array.from(new Set(cells.map(c => c.hour))).sort((a, b) => a - b)
  const byKey = new Map(cells.map(c => [`${c.day_of_week}:${c.hour}`, c.fill_rate]))
  const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: `40px repeat(${hours.length}, 34px)`, gap: 3 }}>
        <div />
        {hours.map(h => (
          <div key={h} style={{ fontSize: 10, color: '#999', textAlign: 'center' }}>{label(h)}</div>
        ))}
        {ROW_ORDER.map(d => (
          <div key={d} style={{ display: 'contents' }}>
            <div style={{ fontSize: 11, color: '#666', display: 'flex', alignItems: 'center' }}>{DOW[d]}</div>
            {hours.map(h => {
              const v = byKey.get(`${d}:${h}`)
              return (
                <div
                  key={h}
                  title={v == null ? '' : `${DOW[d]} ${label(h)} — ${pct(v)} full`}
                  style={{
                    height: 28, borderRadius: 4,
                    backgroundColor: v == null ? '#fafafa' : heatColor(v),
                    border: v == null ? '1px dashed #eee' : 'none',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AttendanceTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<AttendanceReport>(ctx, '/reports/attendance', range)
  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const s = data.summary
  const cols: Col<SessionPerf>[] = [
    { label: 'Session', width: '1.8fr', render: r => r.name },
    { label: 'Occ.', width: '60px', align: 'right', render: r => num(r.occurrences) },
    { label: 'Avg booked', width: '100px', align: 'right', render: r => r.avg_bookings.toFixed(1) },
    { label: 'Avg cap.', width: '90px', align: 'right', render: r => r.avg_capacity == null ? '—' : r.avg_capacity.toFixed(1) },
    { label: 'Fill', width: '70px', align: 'right', render: r => r.fill_rate == null ? '—' : pct(r.fill_rate) },
    { label: 'Attended', width: '90px', align: 'right', render: r => num(r.attended) },
    { label: 'No-shows', width: '90px', align: 'right', render: r => num(r.no_shows) },
  ]

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        <StatTile label="Sessions" value={num(s.total_sessions)} />
        <StatTile label="Bookings" value={num(s.bookings)} />
        <StatTile label="Attended" value={num(s.attended)} />
        <StatTile label="No-shows" value={num(s.no_shows)} />
        <StatTile label="Avg fill rate" value={pct(s.avg_fill_rate)} />
        <StatTile label="Avg attendance" value={pct(s.avg_attendance_rate)} />
      </div>

      <Panel title="Fill rate by day and hour" subtitle="Studio-local. Darker = fuller. Dashed cells had no capped class.">
        <Heatmap cells={data.heatmap} />
      </Panel>

      <Panel title="Session performance">
        <Table cols={cols} rows={data.sessions} keyOf={r => r.session_id} empty="No sessions ran in this range." />
      </Panel>
    </div>
  )
}
