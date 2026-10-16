'use client'

import Link from 'next/link'
import styles from './reports.module.css'
import { color } from '@/lib/ui/tokens'
import ui from '@/app/components/admin/admin.module.css'
import {
  type OrgCtx, type Range, useReport, num, pct, Panel, StatTile, Table, ReportState, type Col, tilesGrid,
} from './lib'
import { Heatmap } from './OverviewTab'

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

export default function AttendanceTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<AttendanceReport>(ctx, '/reports/attendance', range)
  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const s = data.summary
  const cols: Col<SessionPerf>[] = [
    { label: 'Session', render: r => (
      <Link href={`/dashboard/sessions/${r.session_id}`} className={ui.focusable} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{r.name}</Link>
    ) },
    { label: 'Classes', align: 'right', render: r => num(r.occurrences) },
    { label: 'Avg booked', align: 'right', render: r => r.avg_bookings.toFixed(1) },
    { label: 'Avg capacity', align: 'right', render: r => r.avg_capacity == null ? '—' : r.avg_capacity.toFixed(1) },
    { label: 'Fill', align: 'right', render: r => r.fill_rate == null ? '—' : pct(r.fill_rate) },
    { label: 'Attended', align: 'right', render: r => num(r.attended) },
    { label: 'No-shows', align: 'right', render: r => num(r.no_shows) },
  ]

  return (
    <div className={styles.stack}>
      <div style={tilesGrid}>
        <StatTile label="Classes" value={num(s.total_sessions)} />
        <StatTile label="Bookings" value={num(s.bookings)} />
        <StatTile label="Attended" value={num(s.attended)} />
        <StatTile label="No-shows" value={num(s.no_shows)} />
        <StatTile label="Avg fill" value={pct(s.avg_fill_rate)} />
        <StatTile label="Showed up" value={pct(s.avg_attendance_rate)} />
      </div>

      <Panel title="How full classes are" subtitle="Average fill by day and start time, studio time">
        {data.heatmap.length === 0
          ? <p style={{ margin: 0, color: color.muted, fontSize: 14 }}>No classes with a capacity ran in this range.</p>
          : <Heatmap cells={data.heatmap} />}
      </Panel>

      <Panel title="Class performance" flush>
        <Table cols={cols} rows={data.sessions} keyOf={r => r.session_id} empty="No classes ran in this range." minWidth={720} />
      </Panel>
    </div>
  )
}
