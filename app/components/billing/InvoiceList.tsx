'use client'

import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { formatShortDate } from '@/lib/dates'
import { color, radius, tabularNums } from '@/lib/ui/tokens'
import { Chip, alertStyle, type ChipTone } from '@/app/components/admin'

// CalaStudio's invoices to a studio, newest first (GET …/billing/invoices): Stripe's invoices for a
// Monthly/Annual subscription, and a monthly fees invoice for Pay as you go. Australian studios get
// tax invoices showing GST. pdf_url for fees invoices is a signed link that expires after 7 days,
// so the list is fetched fresh each time it's shown rather than cached.

export interface PlatformInvoice {
  id: string
  kind: 'subscription' | 'fees'
  period: string
  period_start?: string | null
  period_end?: string | null
  number: string | null
  total: number
  gst: number | null
  currency: string
  status: 'open' | 'paid' | 'failed' | 'uncollectible' | 'issued'
  pdf_url: string | null
}

const STATUS: Record<PlatformInvoice['status'], { label: string; tone: ChipTone }> = {
  paid: { label: 'Paid', tone: 'primary' },
  issued: { label: 'Issued', tone: 'neutral' },
  open: { label: 'Due', tone: 'warn' },
  failed: { label: 'Payment failed', tone: 'danger' },
  uncollectible: { label: 'Unpaid', tone: 'danger' },
}

function periodLabel(inv: PlatformInvoice): string {
  if (inv.period_start && inv.period_end) return `${formatShortDate(inv.period_start)} – ${formatShortDate(inv.period_end)}`
  if (/^\d{4}-\d{2}$/.test(inv.period)) {
    const [y, m] = inv.period.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  }
  return inv.period
}

export default function InvoiceList({ load }: { load: () => Promise<PlatformInvoice[] | null> }) {
  const [rows, setRows] = useState<PlatformInvoice[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    load().then(r => { if (active) { if (r) setRows(r); else setFailed(true) } }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [load])

  if (failed) return <div role="alert" style={alertStyle()}>Could not load invoices.</div>
  if (!rows) return <p style={{ margin: 0, fontSize: 14, color: color.muted }}>Loading…</p>
  if (rows.length === 0) return <p style={{ margin: 0, fontSize: 14, color: color.muted }}>No invoices yet.</p>

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${color.border}`, borderRadius: radius.control, overflow: 'hidden' }}>
      {rows.map((inv, i) => {
        const st = STATUS[inv.status] ?? { label: inv.status, tone: 'neutral' as ChipTone }
        const cur = inv.currency.toUpperCase()
        return (
          <li key={inv.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '12px 16px', borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
            <FileText size={18} strokeWidth={1.8} color={color.muted} aria-hidden style={{ flex: 'none' }} />
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {inv.kind === 'fees' ? 'Booking fees' : 'Plan'} · {periodLabel(inv)}
              </div>
              <div style={{ fontSize: 13, color: color.muted, ...tabularNums }}>
                {inv.number ? `${inv.number} · ` : ''}{formatMoney(inv.total, cur)}{inv.gst != null ? ` incl. GST ${formatMoney(inv.gst, cur)}` : ''}
              </div>
            </div>
            <Chip tone={st.tone}>{st.label}</Chip>
            {inv.pdf_url ? (
              <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 12px', fontSize: 14, fontWeight: 600, color: color.primary, textDecoration: 'none' }}>
                <Download size={16} aria-hidden />PDF<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}> for {periodLabel(inv)}</span>
              </a>
            ) : <span style={{ fontSize: 13, color: color.muted, padding: '0 12px' }}>No PDF</span>}
          </li>
        )
      })}
    </ul>
  )
}
