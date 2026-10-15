'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns'
import { ResponsiveContainer } from 'recharts'
import { getOrgContext } from '@/lib/orgContext'

const API = process.env.NEXT_PUBLIC_API_URL

// ── formatting ────────────────────────────────────────────
export const money = (n: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n) }
  catch { return `${currency} ${n.toFixed(2)}` }
}
export const num = (n: number) => new Intl.NumberFormat().format(n)
export const pct = (frac: number) => `${Math.round(frac * 100)}%`
// Loosely typed so it satisfies both recharts' tickFormatter and labelFormatter signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tickDate = (d: any) => String(d ?? '').slice(5) // "2026-09-04" -> "09-04"

// Chart palette — deliberately not the semantic greens/reds the dashboard uses for status badges.
export const SERIES = ['#085041', '#1B4F8A', '#7a4f00', '#6d3f8b', '#4a5d52']
export const AXIS = { fontSize: 11, fill: '#999' }
export const GRID = '#ececec'

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

export function RangeControl({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const activeKey = RANGE_PRESETS.find(p => {
    const r = p.make()
    return r.from === range.from && r.to === range.to
  })?.key

  const dateInput: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #e2e2e2', borderRadius: 8, fontSize: 13, backgroundColor: 'white',
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {RANGE_PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => onChange(p.make())}
          style={{
            padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid ' + (activeKey === p.key ? '#085041' : '#e2e2e2'),
            backgroundColor: activeKey === p.key ? '#e8f5ee' : 'white',
            color: activeKey === p.key ? '#085041' : '#444',
          }}
        >
          {p.label}
        </button>
      ))}
      <span style={{ color: '#ccc' }}>|</span>
      <input type="date" value={range.from} max={range.to} onChange={e => onChange({ ...range, from: e.target.value })} style={dateInput} />
      <span style={{ color: '#999', fontSize: 13 }}>to</span>
      <input type="date" value={range.to} min={range.from} onChange={e => onChange({ ...range, to: e.target.value })} style={dateInput} />
    </div>
  )
}

// ── org / roles bootstrap (same shape as the other dashboard pages) ──
export interface OrgCtx { orgId: string; token: string; roles: string[]; currency: string }

export function useOrgCtx() {
  const router = useRouter()
  const [ctx, setCtx] = useState<OrgCtx | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }
      const token = ctx.token
      const org = ctx.org
      const roles: string[] = ctx.roles
      setCtx({ orgId: org.id, token, roles, currency: org.currency ?? 'AUD' })
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
export function Panel({ title, subtitle, right, children }: {
  title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 20 }}>
      {(title || right) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            {title && <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{sub}</div>}
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

// Ranked horizontal bars for the "most X" lists.
export function RankedList({ items, format: fmt }: {
  items: { label: string; value: number }[]
  format?: (v: number) => string
}) {
  if (items.length === 0) return <div style={{ padding: '16px 0', color: '#999', fontSize: 13 }}>Nothing in this range.</div>
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 3 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(it.value) : num(it.value)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, backgroundColor: '#f0f0f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(it.value / max) * 100}%`, backgroundColor: '#085041', borderRadius: 999 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Minimal responsive-ish table: CSS grid on desktop, honours per-column width + right align.
export interface Col<T> { label: string; width?: string; align?: 'right'; render: (row: T) => React.ReactNode }

export function Table<T>({ cols, rows, empty, keyOf }: {
  cols: Col<T>[]; rows: T[]; empty: string; keyOf: (row: T, i: number) => string | number
}) {
  const grid = cols.map(c => c.width ?? '1fr').join(' ')
  if (rows.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: 13 }}>{empty}</div>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 560 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '0 4px 8px',
          fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em',
          borderBottom: '1px solid #eee',
        }}>
          {cols.map((c, i) => <div key={i} style={{ textAlign: c.align }}>{c.label}</div>)}
        </div>
        {rows.map((row, ri) => (
          <div key={keyOf(row, ri)} style={{
            display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '10px 4px',
            fontSize: 13, borderBottom: ri < rows.length - 1 ? '1px solid #f4f4f4' : 'none', alignItems: 'center',
          }}>
            {cols.map((c, ci) => (
              <div key={ci} style={{ textAlign: c.align, fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined, minWidth: 0 }}>
                {c.render(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReportState({ loading, error, empty }: { loading: boolean; error: string; empty?: boolean }) {
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#666', fontSize: 14 }}>Loading…</div>
  if (error) return (
    <div style={{ padding: '12px 16px', backgroundColor: '#fdecea', borderRadius: 8, color: '#8b1a1a', fontSize: 13 }}>{error}</div>
  )
  if (empty) return <div style={{ padding: 48, textAlign: 'center', color: '#999', fontSize: 14 }}>No data for this range.</div>
  return null
}
