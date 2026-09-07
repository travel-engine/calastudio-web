'use client'

import styles from './reports.module.css'
import {
  type OrgCtx, type Range, useReport, num, Panel, StatTile, Table, ReportState, type Col,
} from './lib'
import { formatDate } from '@/lib/dates'

interface TemplatePerf {
  template_id: string
  name: string
  sold_all_time: number
  active: number
  avg_credits_used_before_expiry: number | null
}
interface ExpiringPass {
  member_name: string
  pass_name: string
  credits_remaining: number | null
  expiry: string
}
interface PassReport {
  summary: {
    active_passes: number; sold_in_range: number
    credits_outstanding: number; expiring_next_7_days: number
  }
  templates: TemplatePerf[]
  expiring: ExpiringPass[]
}

export default function PassesTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<PassReport>(ctx, '/reports/passes', range)
  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const s = data.summary

  const templateCols: Col<TemplatePerf>[] = [
    { label: 'Pass template', width: '2fr', render: r => r.name },
    { label: 'Sold (all time)', width: '120px', align: 'right', render: r => num(r.sold_all_time) },
    { label: 'Active now', width: '100px', align: 'right', render: r => num(r.active) },
    {
      label: 'Avg credits used', width: '130px', align: 'right',
      render: r => r.avg_credits_used_before_expiry == null ? '—' : r.avg_credits_used_before_expiry.toFixed(1),
    },
  ]

  const expiringCols: Col<ExpiringPass>[] = [
    { label: 'Member', width: '1.5fr', render: r => r.member_name },
    { label: 'Pass', width: '1.5fr', render: r => r.pass_name },
    { label: 'Credits left', width: '110px', align: 'right', render: r => r.credits_remaining == null ? 'Unlimited' : num(r.credits_remaining) },
    { label: 'Expires', width: '120px', align: 'right', render: r => formatDate(r.expiry) },
  ]

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        <StatTile label="Active passes" value={num(s.active_passes)} />
        <StatTile label="Sold in range" value={num(s.sold_in_range)} />
        <StatTile label="Credits outstanding" value={num(s.credits_outstanding)} />
        <StatTile label="Expiring in 7 days" value={num(s.expiring_next_7_days)} />
      </div>

      <Panel title="Pass template performance" subtitle="Active count and average credits used before expiry are as of now.">
        <Table cols={templateCols} rows={data.templates} keyOf={r => r.template_id} empty="No pass templates yet." />
      </Panel>

      <Panel title="Expiring passes" subtitle="Next 30 days, soonest first.">
        <Table cols={expiringCols} rows={data.expiring} keyOf={(r, i) => `${r.member_name}-${r.pass_name}-${i}`} empty="Nothing expiring in the next 30 days." />
      </Panel>
    </div>
  )
}
