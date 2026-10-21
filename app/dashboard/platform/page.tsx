'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgContext, PLATFORM_ADMIN } from '@/lib/orgContext'
import Forbidden from '@/app/components/Forbidden'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import { formatMoney } from '@/lib/money'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Field, PageHeader, alertStyle, controlStyle } from '@/app/components/admin'
import styles from '@/app/dashboard/dashboard.module.css'

// Platform admin (CalaStudio staff at Travel Engine only): look up any studio and override its CalaStudio plan or rate.
// Internal tooling — deliberately plain. The API enforces it (403 for anyone else); the frontend
// reads `is_platform_admin` (via lib/orgContext's PLATFORM_ADMIN) to link the page and to show
// non-admins a no-access screen. A platform admin with no studio membership has no flag to read
// yet (no studio-less identity endpoint), so for them the API's answer is the gate.

interface Studio { id: string; slug: string; name: string; currency: string }
interface BillingPlan {
  plan: 'percentage' | 'monthly' | 'annual'
  percentage_rate: number | null
  monthly_amount: number | null
  annual_amount: number | null
  subscription_status: string
  current_period_end: string | null
  has_payment_method: boolean
  currency?: string | null
}

const API = process.env.NEXT_PUBLIC_API_URL

export default function PlatformAdminPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const [query, setQuery] = useState('')
  const [studio, setStudio] = useState<Studio | null>(null)
  const [findError, setFindError] = useState('')
  const [current, setCurrent] = useState<BillingPlan | null>(null)

  const [form, setForm] = useState({ plan: '', percent: '', monthly: '', annual: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    (async () => {
      // A platform admin needn't belong to any studio, so take the token from the session itself.
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
      const ctx = await getOrgContext()
      if (ctx.status === 'ok') {
        setRoles(ctx.roles)
        if (!ctx.roles.includes(PLATFORM_ADMIN)) setForbidden(true)
      }
      setReady(true)
    })()
  }, [router])

  // Accepts a web address (yoga-with-ravi.calastudio.app), a slug, or a studio id.
  const find = async () => {
    setFindError(''); setStudio(null); setCurrent(null); setResult(null)
    const q = query.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[./]/)[0]
    if (!q) return
    try {
      const res = await fetch(`${API}/api/public/${encodeURIComponent(q)}`)
      if (!res.ok) { setFindError('No studio found with that address.'); return }
      const d = await res.json()
      const s: Studio = { id: d.id, slug: d.slug, name: d.name, currency: d.currency ?? 'AUD' }
      setStudio(s)
      const planRes = await fetch(`${API}/api/platform-admin/organisations/${s.id}/billing`, { headers: { Authorization: `Bearer ${token}` } })
      if (planRes.ok) setCurrent(await planRes.json())
      else if (planRes.status === 403) setFindError('Platform admin access required.')
    } catch {
      setFindError('Could not reach the server.')
    }
  }

  const save = async () => {
    if (!studio) return
    if (!form.reason.trim()) { setResult({ ok: false, text: 'A reason is required. It appears in the studio’s activity log.' }); return }
    const body: Record<string, unknown> = { reason: form.reason.trim() }
    if (form.plan) body.plan = form.plan
    if (form.percent !== '') body.percentage_rate = parseFloat(form.percent) / 100 // the API takes a fraction
    if (form.monthly !== '') body.monthly_amount = parseFloat(form.monthly)
    if (form.annual !== '') body.annual_amount = parseFloat(form.annual)
    if (Object.keys(body).length === 1) { setResult({ ok: false, text: 'Change at least one of plan, percentage, monthly or annual.' }); return }
    setBusy(true); setResult(null)
    try {
      const res = await fetch(`${API}/api/platform-admin/organisations/${studio.id}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setResult({ ok: false, text: data?.error ?? `Refused (${res.status}).` }); return }
      setCurrent(data)
      setForm({ plan: '', percent: '', monthly: '', annual: '', reason: '' })
      setResult({ ok: true, text: 'Saved. The change is recorded in the studio’s activity log and applies from its next billing cycle.' })
    } catch {
      setResult({ ok: false, text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', fontSize: 15 }}>
      <span style={{ color: color.ink2 }}>{label}</span><span style={{ fontWeight: 600, ...tabularNums }}>{value}</span>
    </div>
  )

  return (
    <div className={styles.shell}>
      <Sidebar active="settings" roles={roles} />
      <div className={styles.main}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <PageHeader eyebrow="CalaStudio · platform admin" title="Studio billing" />
          {!ready ? <p style={{ color: color.muted }}>Loading…</p> : forbidden ? <Forbidden /> : (
            <>
              <Card padded>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 280px' }}>
                    <Field label="Studio web address or slug" htmlFor="pa-q">
                      <input id="pa-q" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') find() }}
                        placeholder="yoga-with-ravi" style={controlStyle} />
                    </Field>
                  </div>
                  <Button variant="primary" onClick={find}>Find studio</Button>
                </div>
                {findError && <div role="alert" style={{ ...alertStyle(), marginTop: 12 }}>{findError}</div>}
              </Card>

              {studio && (
                <Card padded>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>{studio.name}</h2>
                  <p style={{ margin: '0 0 12px', fontSize: 14, color: color.muted }}>{studio.slug} · {studio.id}</p>
                  {current ? (
                    <div style={{ borderTop: `1px solid ${color.divider}`, paddingTop: 8 }}>
                      {row('Plan', current.plan)}
                      {row('Percentage', current.percentage_rate != null ? `${+(current.percentage_rate * 100).toFixed(3)}%` : '—')}
                      {row('Monthly', current.monthly_amount != null ? formatMoney(current.monthly_amount, (current.currency || studio.currency).toUpperCase()) : '—')}
                      {row('Annual', current.annual_amount != null ? formatMoney(current.annual_amount, (current.currency || studio.currency).toUpperCase()) : '—')}
                      {row('Subscription', current.subscription_status)}
                      {row('Card saved', current.has_payment_method ? 'Yes' : 'No')}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 14, color: color.muted }}>Couldn&apos;t load this studio&apos;s plan.</p>
                  )}
                </Card>
              )}

              {studio && (
                <Card padded>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Override</h2>
                  <p style={{ margin: '0 0 16px', fontSize: 14, color: color.muted }}>Leave a field blank to keep it as it is. Changes apply from the next billing cycle.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
                    <Field label="Plan" htmlFor="pa-plan">
                      <select id="pa-plan" value={form.plan} onChange={set('plan')} style={controlStyle}>
                        <option value="">Keep current plan</option>
                        <option value="percentage">Percentage</option>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                      <Field label="Percentage (%)" htmlFor="pa-pct" hint="e.g. 5 for 5%">
                        <input id="pa-pct" type="number" min="0" step="0.01" value={form.percent} onChange={set('percent')} style={{ ...controlStyle, ...tabularNums }} />
                      </Field>
                      <Field label={`Monthly (${studio.currency})`} htmlFor="pa-mo">
                        <input id="pa-mo" type="number" min="0" step="0.01" value={form.monthly} onChange={set('monthly')} style={{ ...controlStyle, ...tabularNums }} />
                      </Field>
                      <Field label={`Annual (${studio.currency})`} htmlFor="pa-yr">
                        <input id="pa-yr" type="number" min="0" step="0.01" value={form.annual} onChange={set('annual')} style={{ ...controlStyle, ...tabularNums }} />
                      </Field>
                    </div>
                    <Field label="Reason (required)" htmlFor="pa-reason" hint="Shown in the studio's activity log.">
                      <textarea id="pa-reason" value={form.reason} onChange={set('reason')} style={{ ...controlStyle, minHeight: 72, padding: '10px 12px', resize: 'vertical' }} />
                    </Field>
                    {result && <div role={result.ok ? 'status' : 'alert'} style={alertStyle(result.ok ? 'ok' : 'danger')}>{result.text}</div>}
                    <div><Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save override'}</Button></div>
                  </div>
                </Card>
              )}
              <p style={{ fontSize: 13, color: color.muted, borderRadius: radius.control }}>Only CalaStudio platform admins can save here; everyone else is refused by the API.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
