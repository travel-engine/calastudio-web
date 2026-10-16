'use client'

import Link from 'next/link'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import styles from './reports.module.css'
import { color } from '@/lib/ui/tokens'
import { Chip } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import {
  type OrgCtx, type Range, useReport, money, num, Panel, StatTile, Table, RankedList,
  ChartFrame, ReportState, type Col, AXIS, GRID, tilesGrid, monthLabel, tooltipStyle,
} from './lib'
import { formatShortDate } from '@/lib/dates'

interface MonthlyGrowth { month: string; new_members: number; total_members: number }
interface AtRiskMember { member_id: string; name: string; last_booking_date: string | null }
interface TopMember { member_id: string | null; name: string; value: number }
interface WaiverMember { member_id: string; name: string; status: string; version_accepted: number | null; current_version: number }
interface MemberReport {
  summary: { active_members: number; new_in_range: number; members_with_active_passes: number }
  person_types: { person_type: string; count: number }[]
  growth: MonthlyGrowth[]
  at_risk: AtRiskMember[]
  top_by_attendance: TopMember[]
  top_by_spend: TopMember[]
  waiver_compliance: { non_compliant_count: number; members: WaiverMember[] }
}

const memberLink = (id: string, name: string) => (
  <Link href={`/dashboard/members/${id}`} className={ui.focusable} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{name}</Link>
)
const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s

export default function MembersTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<MemberReport>(ctx, '/reports/members', range)
  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const s = data.summary
  const axisProps = { tick: AXIS, tickLine: false, axisLine: { stroke: color.border } }

  const atRiskCols: Col<AtRiskMember>[] = [
    { label: 'Member', render: r => memberLink(r.member_id, r.name) },
    { label: 'Last booking', align: 'right', render: r => r.last_booking_date ? formatShortDate(r.last_booking_date) : 'Never booked' },
  ]
  const waiverCols: Col<WaiverMember>[] = [
    { label: 'Member', render: r => memberLink(r.member_id, r.name) },
    { label: 'Status', width: '140px', render: r => (
      <Chip tone={r.status === 'Pending' ? 'danger' : 'warn'}>{r.status === 'Pending' ? 'Not signed' : 'Old version'}</Chip>
    ) },
    { label: 'Accepted', align: 'right', render: r => r.version_accepted == null ? '—' : `Version ${r.version_accepted}` },
    { label: 'Current', align: 'right', render: r => `Version ${r.current_version}` },
  ]

  return (
    <div className={styles.stack}>
      <div style={tilesGrid}>
        <StatTile label="Active members" value={num(s.active_members)} />
        <StatTile label="New in range" value={num(s.new_in_range)} />
        <StatTile label="With an active pass" value={num(s.members_with_active_passes)} />
      </div>

      <Panel title="Growth" subtitle="New members each month and the running total">
        <ChartFrame height={260}>
          <ComposedChart data={data.growth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} minTickGap={16} />
            <YAxis yAxisId="l" width={36} allowDecimals={false} {...axisProps} axisLine={false} />
            <YAxis yAxisId="r" orientation="right" width={36} allowDecimals={false} {...axisProps} axisLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={monthLabel} cursor={{ fill: color.bg }} />
            <Legend wrapperStyle={{ fontSize: 14 }} />
            <Bar yAxisId="l" dataKey="new_members" name="New" fill="#A9CBBB" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Line yAxisId="r" type="monotone" dataKey="total_members" name="Total" stroke={color.primary} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartFrame>
      </Panel>

      <div className={styles.cols2}>
        <Panel title="By person type">
          <RankedList items={data.person_types.map(p => ({ label: cap(p.person_type) || 'Unspecified', value: p.count }))} />
        </Panel>
        <Panel title="Members to win back" subtitle="No recent bookings" flush>
          <Table cols={atRiskCols} rows={data.at_risk} keyOf={r => r.member_id} empty="Everyone has booked recently." minWidth={320} />
        </Panel>
      </div>

      <div className={styles.cols2}>
        <Panel title="Top by attendance">
          <RankedList items={data.top_by_attendance.map(m => ({ label: m.name, value: m.value }))} />
        </Panel>
        <Panel title="Top by spend">
          <RankedList
            items={data.top_by_spend.map(m => ({ label: m.name, value: m.value }))}
            format={v => money(v, ctx.currency)}
          />
        </Panel>
      </div>

      {data.waiver_compliance.members.length > 0 && (
        <Panel
          title="Waiver"
          subtitle={`${data.waiver_compliance.non_compliant_count} member${data.waiver_compliance.non_compliant_count === 1 ? '' : 's'} on an old or unsigned waiver`}
          flush
        >
          <Table cols={waiverCols} rows={data.waiver_compliance.members} keyOf={r => r.member_id} empty="Everyone is up to date." />
        </Panel>
      )}
    </div>
  )
}
