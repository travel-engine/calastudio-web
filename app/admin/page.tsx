'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Search } from 'lucide-react'
import { adminFetch } from '@/lib/platformAdmin'
import { formatShortDate } from '@/lib/dates'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, PageHeader, alertStyle, controlStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import AdminShell from './AdminShell'

// Every studio on CalaStudio — GET /api/platform-admin/organisations?q=. Search by name or address.
interface StudioRow {
  id: string
  name: string
  slug: string
  plan?: 'percentage' | 'monthly' | 'annual' | null
  subscription_status?: string | null
  stripe_connected?: boolean | null
  member_count?: number | null
  created_at?: string | null
}

const PLAN: Record<string, string> = { percentage: 'Pay as you go', monthly: 'Monthly', annual: 'Annual' }

export default function AdminStudiosPage() {
  return <AdminShell>{token => <Studios token={token} />}</AdminShell>
}

function Studios({ token }: { token: string }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<StudioRow[] | null>(null)
  const [listMissing, setListMissing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (query: string) => {
    setError('')
    try {
      const { res, body } = await adminFetch(`/organisations${query ? `?q=${encodeURIComponent(query)}` : ''}`, token)
      if (res.status === 404 || res.status === 405) { setListMissing(true); setRows([]); return }
      if (!res.ok) { setError(body?.error ?? 'Could not load studios.'); setRows([]); return }
      setRows(Array.isArray(body) ? body : (body?.items ?? []))
    } catch {
      setError('Could not reach the server.'); setRows([])
    }
  }, [token])

  useEffect(() => { load('') }, [load])
  useEffect(() => {
    if (listMissing) return
    const t = setTimeout(() => load(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q, load, listMissing])

  // Until the list endpoint exists: jump straight to a studio by its web address.
  const goToAddress = async () => {
    const slug = q.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[./]/)[0]
    if (!slug) return
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${encodeURIComponent(slug)}`).catch(() => null)
    if (!res?.ok) { setError('No studio found with that address.'); return }
    const d = await res.json()
    router.push(`/admin/studios/${d.id}`)
  }

  const statusTone = (s?: string | null): ChipTone => s === 'active' ? 'primary' : s === 'past_due' ? 'danger' : s === 'incomplete' ? 'warn' : 'neutral'
  const th: React.CSSProperties = { ...smallCapsStyle, textAlign: 'left', padding: '12px 20px', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
      <PageHeader eyebrow="CalaStudio admin" title="Studios" />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ position: 'relative', flex: '1 1 320px', maxWidth: 480 }}>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Search studios</span>
          <Search size={18} strokeWidth={2} color={color.muted} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && listMissing) goToAddress() }}
            placeholder={listMissing ? 'Studio web address, e.g. yoga-with-ravi' : 'Search by name or web address'} style={{ ...controlStyle, paddingLeft: 38 }} />
        </label>
        {listMissing && <Button variant="primary" onClick={goToAddress}>Open studio</Button>}
      </div>

      {error && <div role="alert" style={alertStyle()}>{error}</div>}

      {listMissing ? (
        <Card><EmptyState icon={<Building2 size={22} strokeWidth={1.8} />}
          message="The full studio list needs an API endpoint that isn't live yet. Meanwhile, open a studio by its web address above." /></Card>
      ) : rows === null ? <p style={{ color: color.muted }}>Loading…</p> : rows.length === 0 ? (
        <Card><EmptyState icon={<Building2 size={22} strokeWidth={1.8} />} message={q ? 'No studios match that search.' : 'No studios yet.'} /></Card>
      ) : (
        <Card style={{ overflow: 'hidden' }} aria-label="Studios">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>Studio</th>
                  <th scope="col" style={th}>Plan</th>
                  <th scope="col" style={th}>Stripe</th>
                  <th scope="col" style={{ ...th, textAlign: 'right' }}>Members</th>
                  <th scope="col" style={{ ...th, textAlign: 'right' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const td: React.CSSProperties = { padding: '12px 20px', borderBottom: i < rows.length - 1 ? `1px solid ${color.divider}` : 'none', verticalAlign: 'middle' }
                  return (
                    <tr key={r.id}>
                      <td style={td}>
                        <Link href={`/admin/studios/${r.id}`} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{r.name}</Link>
                        <span style={{ display: 'block', fontSize: 13, color: color.muted }}>{r.slug}</span>
                      </td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {r.plan ? PLAN[r.plan] ?? r.plan : '—'}
                          {r.subscription_status && r.subscription_status !== 'none' && <Chip tone={statusTone(r.subscription_status)}>{r.subscription_status.replace('_', ' ')}</Chip>}
                        </span>
                      </td>
                      <td style={td}>{r.stripe_connected == null ? '—' : r.stripe_connected ? <Chip tone="primary">Connected</Chip> : <Chip tone="warn">Not connected</Chip>}</td>
                      <td style={{ ...td, textAlign: 'right', ...tabularNums }}>{r.member_count ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: color.ink2, ...tabularNums }}>{r.created_at ? formatShortDate(r.created_at) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
