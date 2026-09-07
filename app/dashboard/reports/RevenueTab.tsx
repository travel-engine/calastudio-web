'use client'

import { useState } from 'react'
import styles from './reports.module.css'
import {
  type OrgCtx, type Range, useReport, money, Panel, StatTile, Table, ReportState, type Col,
} from './lib'
import { formatDate } from '@/lib/dates'

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
    total_revenue: number; drop_in: number; pass_sales: number
    refunds: number; net: number; currency: string
  }
  transactions: Txn[]
}

const statusColor: Record<string, string> = {
  Succeeded: '#085041', Refunded: '#666', PartiallyRefunded: '#7a4f00', Failed: '#8b1a1a',
}

export default function RevenueTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<RevenueReport>(ctx, '/reports/revenue', range)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const exportCsv = async () => {
    setExporting(true)
    setExportError('')
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${ctx.orgId}/reports/revenue/export?from=${range.from}&to=${range.to}`,
        { headers: { Authorization: `Bearer ${ctx.token}` } },
      )
      if (!res.ok) throw new Error('Export failed.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `revenue-${range.from}-to-${range.to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Could not export the CSV. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const s = data.summary
  const cur = s.currency || ctx.currency

  const cols: Col<Txn>[] = [
    { label: 'Date', width: '110px', render: r => formatDate(r.date) },
    { label: 'Member', width: '1.4fr', render: r => r.member_name || '—' },
    { label: 'Product', width: '1.4fr', render: r => r.product || '—' },
    { label: 'Method', width: '90px', render: r => r.method || '—' },
    { label: 'Status', width: '110px', render: r => (
      <span style={{ color: statusColor[r.status] ?? '#666', fontWeight: 500 }}>{r.status}</span>
    ) },
    { label: 'Amount', width: '110px', align: 'right', render: r => money(r.amount, cur) },
  ]

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        <StatTile label="Total revenue" value={money(s.total_revenue, cur)} />
        <StatTile label="Drop-in" value={money(s.drop_in, cur)} />
        <StatTile label="Pass sales" value={money(s.pass_sales, cur)} />
        <StatTile label="Refunds" value={money(s.refunds, cur)} />
        <StatTile label="Net" value={money(s.net, cur)} />
      </div>

      <Panel
        title="Transactions"
        subtitle={`${data.transactions.length} in range`}
        right={
          <div style={{ textAlign: 'right' }}>
            <button
              onClick={exportCsv}
              disabled={exporting || data.transactions.length === 0}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: '1px solid #d2d2d2', backgroundColor: 'white',
                cursor: exporting || data.transactions.length === 0 ? 'default' : 'pointer',
                color: data.transactions.length === 0 ? '#aaa' : '#1a1a1a',
              }}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            {exportError && <div style={{ fontSize: 12, color: '#8b1a1a', marginTop: 6 }}>{exportError}</div>}
          </div>
        }
      >
        <Table
          cols={cols}
          rows={data.transactions}
          keyOf={r => r.payment_id}
          empty="No transactions in this range."
        />
      </Panel>
    </div>
  )
}
