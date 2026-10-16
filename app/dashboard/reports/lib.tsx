'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths, subDays, parseISO } from 'date-fns'
import { ResponsiveContainer } from 'recharts'
import { getOrgContext } from '@/lib/orgContext'
import { formatMoney } from '@/lib/money'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, EmptyState, Segmented, cardStyle, controlStyle, smallCapsStyle } from '@/app/components/admin'

const API = process.env.NEXT_PUBLIC_API_URL

// ── formatting ────────────────────────────────────────────
export const money = (n: number, currency: string) => formatMoney(n, currency)
export const num = (n: number) => new Intl.NumberFormat('en-AU').format(n)
export const pct = (frac: number) => `${Math.round(frac * 100)}%`
// Report days arrive as plain "YYYY-MM-DD". Loosely typed so it satisfies both recharts'
// tickFormatter and labelFormatter signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tickDate = (d: any) => { const s = String(d ?? ''); return s.length >= 10 ? format(parseISO(s.slice(0, 10)), 'd MMM') : s }
export const dayLabel = (d: string) => format(parseISO(d.slice(0, 10)), 'EEE d MMM')
// "2026-03" → "Mar 26"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const monthLabel = (m: any) => { const s = String(m ?? ''); return /^\d{4}-\d{2}$/.test(s) ? format(parseISO(`${s}-01`), 'MMM yy') : s }

// Chart palette: brand green first; the others only where a chart needs a second series.
export const SERIES = [color.primary, color.infoInk, color.warnInk, '#6d3f8b', color.muted]
export const AXIS = { fontSize: 12, fill: color.muted }
export const GRID = color.divider

// ── date range ────────────────────────────────────────────
export type Range = { from: string; to: string }
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export const RANGE_PRESETS: { key: string; label: string; make: () => Range }[] = [
  { key: '7d', label: 'Last 7 days', make: () => ({ from: iso(subDays(new Date(), 6)), to: iso(new Date()) }) },
  { key: '30d', label: 'Last 30 days', make: () => ({ from: iso(subDays(new Date(), 29)), to: iso(new Date()) }) },
  { key: 'mtd', label: 'This month', make: () => ({ from: iso(startOfMonth(new Date())), to: iso(new Date()) }) },
  { key: 'lm', label: 'Last month', make: () => {
    const m = subMonths(new Date(), 1)
    return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)) }
  } },
]

// "1 – 16 October 2026", "17 Sep – 16 Oct 2026", "20 Dec 2025 – 5 Jan 2026"
export function rangeLabel(r: Range): string {
  const a = parseISO(r.from), b = parseISO(r.to)
  if (r.from === r.to) return format(a, 'd MMMM yyyy')
  if (format(a, 'yyyy-MM') === format(b, 'yyyy-MM')) return `${format(a, 'd')} – ${format(b, 'd MMMM yyyy')}`
  if (format(a, 'yyyy') === format(b, 'yyyy')) return `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`
  return `${format(a, 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`
}

export function RangeControl({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const activeKey = RANGE_PRESETS.find(p => {
    const r = p.make()
    return r.from === range.from && r.to === range.to
  })?.key
  const [custom, setCustom] = useState(false)
  const showDates = custom || !activeKey

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <Segmented
        label="Date range"
        value={showDates ? 'custom' : activeKey!}
        onChange={k => { setCustom(false); const p = RANGE_PRESETS.find(x => x.key === k); if (p) onChange(p.make()) }}
        options={RANGE_PRESETS.map(p => ({ value: p.key, label: p.label }))}
      />
      <Button size="sm" onClick={() => setCustom(c => !c)} aria-expanded={showDates}
        style={showDates ? { borderColor: color.primary, color: color.primaryInk, background: color.primarySoft } : undefined}>
        Custom range
      </Button>
      {showDates && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <input id="range-from" type="date" aria-label="From" value={range.from} max={range.to}
            onChange={e => e.target.value && onChange({ ...range, from: e.target.value })} style={{ ...controlStyle, width: 'auto', minHeight: 36 }} />
          <span style={{ color: color.muted, fontSize: 14 }}>to</span>
          <input id="range-to" type="date" aria-label="To" value={range.to} min={range.from}
            onChange={e => e.target.value && onChange({ ...range, to: e.target.value })} style={{ ...controlStyle, width: 'auto', minHeight: 36 }} />
        </div>
      )}
    </div>
  )
}

// ── org / roles bootstrap (same shape as the other dashboard pages) ──
export interface OrgCtx { orgId: string; token: string; roles: string[]; currency: string; slug: string | null }

export function useOrgCtx() {
  const router = useRouter()
  const [ctx, setCtx] = useState<OrgCtx | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }
      const org = ctx.org
      setCtx({ orgId: org.id, token: ctx.token, roles: ctx.roles, currency: org.currency ?? 'AUD', slug: org.slug ?? null })
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ctx, loading }
}

// ── report fetch ──────────────────────────────────────────
export function useReport<T>(ctx: OrgCtx | null, path: string, range: Range, extraQs = '') {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ctx) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`${API}/api/organisations/${ctx.orgId}${path}?from=${range.from}&to=${range.to}${extraQs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Could not load this report.')
        return r.json() as Promise<T>
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [ctx, path, range.from, range.to, extraQs])

  return { data, error, loading }
}

// ── shared presentational bits ────────────────────────────
/** A report card: 18px heading, optional muted subtitle and right-hand slot. `flush` drops the
 *  body padding so a table can run edge to edge. */
export function Panel({ title, subtitle, right, flush = false, children }: {
  title?: string; subtitle?: string; right?: React.ReactNode; flush?: boolean; children: React.ReactNode
}) {
  return (
    <section style={{ ...cardStyle, minWidth: 0, overflow: 'hidden' }}>
      {(title || right) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '18px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            {title && <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>}
            {subtitle && <span style={{ fontSize: 14, color: color.muted }}>{subtitle}</span>}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: flush ? '12px 0 0' : '16px 20px 20px' }}>{children}</div>
    </section>
  )
}

/** KPI tile: small-caps label, big number, one muted line under it. */
export function StatTile({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6, padding: '18px 20px', minWidth: 0 }}>
      <span style={smallCapsStyle}>{label}</span>
      <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.15, ...tabularNums }}>{value}</span>
      {sub && <span style={{ fontSize: 13, lineHeight: 1.4, color: color.muted, ...tabularNums }}>{sub}</span>}
    </div>
  )
}

// Recharts' ResponsiveContainer measures its parent, which is 0×0 on the SSR pass — mount-gate it
// so the first real paint has a sized box.
export function ChartFrame({ height = 220, children }: { height?: number; children: React.ReactElement }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div style={{ height }} />
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  )
}

export const tooltipStyle = {
  contentStyle: { borderRadius: radius.control, border: `1px solid ${color.border}`, fontSize: 14, fontFamily: 'inherit' },
  labelStyle: { fontWeight: 600, color: color.ink },
}

// Ranked horizontal bars for the "most X" lists.
export function RankedList({ items, format: fmt }: {
  items: { label: string; value: number }[]
  format?: (v: number) => string
}) {
  if (items.length === 0) return <p style={{ margin: 0, padding: '8px 0', color: color.muted, fontSize: 14 }}>Nothing in this range.</p>
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 15, marginBottom: 5 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <span style={{ fontWeight: 600, ...tabularNums }}>{fmt ? fmt(it.value) : num(it.value)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: color.track, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(it.value / max) * 100}%`, background: color.primary, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Report table: real <table> inside a horizontal scroller, so wide tables scroll inside their card.
export interface Col<T> { label: string; width?: string; align?: 'right'; render: (row: T) => React.ReactNode }

export function Table<T>({ cols, rows, empty, keyOf, minWidth = 560 }: {
  cols: Col<T>[]; rows: T[]; empty: string; keyOf: (row: T, i: number) => string | number; minWidth?: number
}) {
  if (rows.length === 0) {
    return <p style={{ margin: 0, padding: '20px', textAlign: 'center', color: color.muted, fontSize: 14 }}>{empty}</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth, borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} scope="col" style={{
                ...smallCapsStyle, textAlign: c.align ?? 'left', width: c.width && !c.width.endsWith('fr') ? c.width : undefined,
                padding: '10px 20px', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={keyOf(row, ri)}>
              {cols.map((c, ci) => (
                <td key={ci} style={{
                  padding: '12px 20px', borderBottom: ri < rows.length - 1 ? `1px solid ${color.divider}` : 'none',
                  textAlign: c.align, ...(c.align === 'right' ? tabularNums : {}), verticalAlign: 'middle',
                }}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportState({ loading, error, empty }: { loading: boolean; error: string; empty?: boolean }) {
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: color.muted, fontSize: 15 }}>Loading…</div>
  if (error) return (
    <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{error}</div>
  )
  if (empty) return <div style={cardStyle}><EmptyState message="No data for this range." /></div>
  return null
}

export const tilesGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: space.cardGap,
}
