'use client'

import styles from './reports.module.css'
import { Chip } from '@/app/components/admin'
import {
  type OrgCtx, type Range, useReport, num, Panel, StatTile, Table, ReportState, type Col, tilesGrid,
} from './lib'
import { formatShortDate } from '@/lib/dates'
import { isTestTemplate } from './OverviewTab'

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
    { label: 'Pass', render: r => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {r.name}{isTestTemplate(r.name) && <Chip tone="warn">Test</Chip>}
      </span>
    ) },
    { label: 'Sold (all time)', align: 'right', render: r => num(r.sold_all_time) },
    { label: 'Active now', align: 'right', render: r => num(r.active) },
    {
      label: 'Avg credits used', align: 'right',
      render: r => r.avg_credits_used_before_expiry == null ? '—' : r.avg_credits_used_before_expiry.toFixed(1),
    },
  ]

  const expiringCols: Col<ExpiringPass>[] = [
    { label: 'Member', render: r => r.member_name },
    { label: 'Pass', render: r => r.pass_name },
    { label: 'Credits left', align: 'right', render: r => r.credits_remaining == null ? 'Unlimited' : num(r.credits_remaining) },
    { label: 'Expires', align: 'right', render: r => <span style={{ whiteSpace: 'nowrap' }}>{formatShortDate(r.expiry)}</span> },
  ]

  return (
    <div className={styles.stack}>
      <div style={tilesGrid}>
        <StatTile label="Active passes" value={num(s.active_passes)} />
        <StatTile label="Sold in range" value={num(s.sold_in_range)} />
        <StatTile label="Credits not yet used" value={num(s.credits_outstanding)} />
        <StatTile label="Expiring in 7 days" value={num(s.expiring_next_7_days)} />
      </div>

      <Panel title="Pass types" subtitle="Active and average credits used are as of today" flush>
        <Table cols={templateCols} rows={data.templates} keyOf={r => r.template_id} empty="No pass types yet." />
      </Panel>

      <Panel title="Expiring soon" subtitle="Next 30 days, soonest first" flush>
        <Table cols={expiringCols} rows={data.expiring} keyOf={(r, i) => `${r.member_name}-${r.pass_name}-${i}`} empty="Nothing expiring in the next 30 days." />
      </Panel>
    </div>
  )
}
