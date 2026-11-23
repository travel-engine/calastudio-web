'use client'

import styles from './reports.module.css'
import { Chip, type ChipTone } from '@/app/components/admin'
import {
  type OrgCtx, type Range, useReport, money, Panel, StatTile, Table, ReportState, type Col, tilesGrid,
} from './lib'
import { formatShortDate } from '@/lib/dates'

interface Txn {
  payment_id: string
  date: string
  member_name: string
  product: string
  amount: number
  method: string
  status: string
  reference: string | null
}
interface RevenueReport {
  summary: {
    total_revenue: number; drop_in: number; pass_sales: number; membership_sales?: number
    refunds: number; net: number; currency: string
    // Class and workshop bookings by price charged (API #108); older bookings count as full.
    booking_price_tiers?: { tier: 'early_bird' | 'full' | 'override'; count: number; revenue: number }[]
  }
  transactions: Txn[]
}

const STATUS: Record<string, { label: string; tone: ChipTone }> = {
  Succeeded: { label: 'Paid', tone: 'primary' },
  Refunded: { label: 'Refunded', tone: 'neutral' },
  PartiallyRefunded: { label: 'Part refunded', tone: 'warn' },
  Failed: { label: 'Failed', tone: 'danger' },
}
const METHOD: Record<string, string> = { CreditCard: 'Card', Card: 'Card', Cash: 'Cash', BankTransfer: 'Bank transfer', Comp: 'Comp' }

export default function RevenueTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<RevenueReport>(ctx, '/reports/revenue', range)

  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const s = data.summary
  const cur = s.currency || ctx.currency

  const cols: Col<Txn>[] = [
    { label: 'Date', width: '120px', render: r => <span style={{ whiteSpace: 'nowrap' }}>{formatShortDate(r.date)}</span> },
    { label: 'Member', render: r => r.member_name || '—' },
    { label: 'Product', render: r => r.product || '—' },
    { label: 'Method', width: '120px', render: r => METHOD[r.method] ?? r.method ?? '—' },
    { label: 'Status', width: '140px', render: r => {
      const st = STATUS[r.status]
      return <Chip tone={st?.tone ?? 'neutral'}>{st?.label ?? r.status}</Chip>
    } },
    { label: 'Amount', width: '110px', align: 'right', render: r => money(r.amount, cur) },
  ]

  return (
    <div className={styles.stack}>
      <div style={tilesGrid}>
        <StatTile label="Total revenue" value={money(s.total_revenue, cur)} />
        <StatTile label="Drop-in" value={money(s.drop_in, cur)} />
        <StatTile label="Pass sales" value={money(s.pass_sales, cur)} />
        {s.membership_sales !== undefined && <StatTile label="Memberships" value={money(s.membership_sales, cur)} />}
        <StatTile label="Refunds" value={money(s.refunds, cur)} />
        <StatTile label="Net" value={money(s.net, cur)} />
      </div>

      {s.booking_price_tiers?.some(t => t.tier === 'early_bird' || t.tier === 'override') && (
        <Panel title="Booking prices" subtitle="Classes and workshops paid for in this range">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {s.booking_price_tiers.map(t => (
              <StatTile key={t.tier} label={t.tier === 'early_bird' ? 'Early bird' : t.tier === 'override' ? 'Special price' : 'Full price'}
                value={money(t.revenue, cur)} sub={`${t.count} booking${t.count === 1 ? '' : 's'}`} />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Transactions" subtitle={`${data.transactions.length} in this range`} flush>
        <Table cols={cols} rows={data.transactions} keyOf={r => r.payment_id} empty="No transactions in this range." minWidth={760} />
      </Panel>
    </div>
  )
}
