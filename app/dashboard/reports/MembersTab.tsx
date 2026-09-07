'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import styles from './reports.module.css'
import {
  type OrgCtx, type Range, useReport, money, num, Panel, StatTile, Table, RankedList,
  ChartFrame, ReportState, type Col, SERIES, AXIS, GRID,
} from './lib'
import { formatDate } from '@/lib/dates'

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

export default function MembersTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<MemberReport>(ctx, '/reports/members', range)
  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const s = data.summary
  const axisProps = { tick: AXIS, tickLine: false, axisLine: { stroke: GRID } }

  const atRiskCols: Col<AtRiskMember>[] = [
    { label: 'Member', width: '2fr', render: r => r.name },
    { label: 'Last booking', width: '140px', align: 'right', render: r => r.last_booking_date ? formatDate(r.last_booking_date) : 'Never' },
  ]
  const waiverCols: Col<WaiverMember>[] = [
    { label: 'Member', width: '2fr', render: r => r.name },
    { label: 'Status', width: '110px', render: r => (
      <span style={{ color: r.status === 'Pending' ? '#8b1a1a' : '#7a4f00', fontWeight: 500 }}>{r.status}</span>
    ) },
    { label: 'Accepted', width: '90px', align: 'right', render: r => r.version_accepted == null ? '—' : `v${r.version_accepted}` },
    { label: 'Current', width: '80px', align: 'right', render: r => `v${r.current_version}` },
  ]

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        <StatTile label="Active members" value={num(s.active_members)} />
        <StatTile label="New in range" value={num(s.new_in_range)} />
        <StatTile label="With an active pass" value={num(s.members_with_active_passes)} />
      </div>

      <Panel title="Growth" subtitle="New members per month (bars) and cumulative total (line).">
        <ChartFrame height={260}>
          <ComposedChart data={data.growth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" {...axisProps} minTickGap={16} />
            <YAxis yAxisId="l" width={36} allowDecimals={false} {...axisProps} />
            <YAxis yAxisId="r" orientation="right" width={36} allowDecimals={false} {...axisProps} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="new_members" name="New" fill={SERIES[1]} radius={[3, 3, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="total_members" name="Total" stroke={SERIES[0]} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartFrame>
      </Panel>

      <div className={styles.cols2}>
        <Panel title="By person type">
          <RankedList items={data.person_types.map(p => ({ label: p.person_type || 'Unspecified', value: p.count }))} />
        </Panel>
        <Panel title="At-risk members" subtitle="No booking in the at-risk window.">
          <Table cols={atRiskCols} rows={data.at_risk} keyOf={r => r.member_id} empty="No at-risk members." />
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
          title="Waiver compliance"
          subtitle={`${data.waiver_compliance.non_compliant_count} member${data.waiver_compliance.non_compliant_count === 1 ? '' : 's'} on an old or unsigned waiver`}
        >
          <Table cols={waiverCols} rows={data.waiver_compliance.members} keyOf={r => r.member_id} empty="Everyone is up to date." />
        </Panel>
      )}
    </div>
  )
}
