'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { adminFetch } from '@/lib/platformAdmin'
import { studioUrl } from '@/lib/seo'
import { formatMoney } from '@/lib/money'
import { formatShortDate } from '@/lib/dates'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Button, Card, Chip, Field, PageHeader, alertStyle, controlStyle } from '@/app/components/admin'
import AdminShell from '../../AdminShell'

// One studio, as CalaStudio admin sees it: who it is (GET /api/platform-admin/organisations/{id}),
// its CalaStudio plan (GET …/billing) and the override form (PATCH …/billing, reason required).

interface StudioDetail {
  id: string
  name: string
  slug: string
  email?: string | null
  phone?: string | null
  is_active?: boolean | null
  country?: string | null
  currency?: string | null
  timezone?: string | null
  created_at?: string | null
  stripe_connected?: boolean | null
  member_count?: number | null
  admin_emails?: string[] | null
}
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

const PLAN: Record<string, string> = { percentage: 'Pay as you go', monthly: 'Monthly', annual: 'Annual' }

export default function AdminStudioPage() {
  return <AdminShell>{token => <StudioView token={token} />}</AdminShell>
}

function StudioView({ token }: { token: string }) {
  const id = useParams().id as string
  const hint = useSearchParams()
  const [studio, setStudio] = useState<StudioDetail | null>(null)
  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ plan: '', percent: '', monthly: '', annual: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([adminFetch(`/organisations/${id}`, token), adminFetch(`/organisations/${id}/billing`, token)])
      if (s.res.ok) setStudio(s.body)
      else setStudio({ id, name: hint.get('name') || 'Studio', slug: hint.get('slug') ?? '' }) // detail endpoint not live yet — still show billing
      if (b.res.ok) setPlan(b.body)
      else setLoadError(b.body?.error ?? 'Could not load this studio’s plan.')
    } catch {
      setLoadError('Could not reach the server.')
    }
  }, [id, token, hint])

  useEffect(() => { load() }, [load])

  const cur = (plan?.currency || studio?.currency || 'AUD').toUpperCase()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.reason.trim()) { setResult({ ok: false, text: 'A reason is required. It appears in the studio’s activity log.' }); return }
    const body: Record<string, unknown> = { reason: form.reason.trim() }
    if (form.plan) body.plan = form.plan
    if (form.percent !== '') body.percentage_rate = parseFloat(form.percent) / 100 // the API takes a fraction
    if (form.monthly !== '') body.monthly_amount = parseFloat(form.monthly)
    if (form.annual !== '') body.annual_amount = parseFloat(form.annual)
    if (Object.keys(body).length === 1) { setResult({ ok: false, text: 'Change at least one of plan, percentage, monthly or annual.' }); return }
    setBusy(true); setResult(null)
    try {
      const { res, body: data } = await adminFetch(`/organisations/${id}/billing`, token, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { setResult({ ok: false, text: data?.error ?? `Refused (${res.status}).` }); return }
      setPlan(data)
      setForm({ plan: '', percent: '', monthly: '', annual: '', reason: '' })
      setResult({ ok: true, text: 'Saved. Recorded in the studio’s activity log; applies from its next billing cycle.' })
    } catch {
      setResult({ ok: false, text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', fontSize: 15, borderTop: `1px solid ${color.divider}` }}>
      <span style={{ color: color.ink2 }}>{label}</span><span style={{ fontWeight: 600, textAlign: 'right', ...tabularNums }}>{value}</span>
    </div>
  )

  if (!studio) return <p style={{ color: color.muted }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.cardGap, maxWidth: 820 }}>
      <Breadcrumb items={[{ label: 'Studios', href: '/admin' }, { label: studio.name }]} />
      <PageHeader eyebrow="CalaStudio admin" title={studio.name}
        actions={studio.slug ? <Button href={studioUrl(studio.slug)} target="_blank" icon={<ExternalLink size={16} strokeWidth={2} aria-hidden />}>View booking page</Button> : undefined}>
        <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>{studio.slug ? `${studio.slug} · ` : ''}{studio.id}</span>
      </PageHeader>

      {loadError && <div role="alert" style={alertStyle()}>{loadError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: space.cardGap, alignItems: 'start' }}>
        <Card padded aria-labelledby="st-details">
          <h2 id="st-details" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>Studio</h2>
          {studio.is_active === false && row('Status', <Chip tone="danger">Inactive</Chip>)}
          {row('Contact email', studio.email || '—')}
          {row('Phone', studio.phone || '—')}
          {row('Admins', studio.admin_emails?.length ? studio.admin_emails.join(', ') : '—')}
          {row('Country · currency', [studio.country, studio.currency].filter(Boolean).join(' · ') || '—')}
          {row('Time zone', studio.timezone || '—')}
          {row('Members', studio.member_count ?? '—')}
          {row('Stripe', studio.stripe_connected == null ? '—' : studio.stripe_connected ? <Chip tone="primary">Connected</Chip> : <Chip tone="warn">Not connected</Chip>)}
          {row('Joined', studio.created_at ? formatShortDate(studio.created_at) : '—')}
        </Card>

        <Card padded aria-labelledby="st-plan">
          <h2 id="st-plan" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>CalaStudio plan</h2>
          {plan ? (
            <>
              {row('Plan', PLAN[plan.plan] ?? plan.plan)}
              {row('Percentage', plan.percentage_rate != null ? `${+(plan.percentage_rate * 100).toFixed(3)}%` : '—')}
              {row('Monthly', plan.monthly_amount != null ? formatMoney(plan.monthly_amount, cur) : '—')}
              {row('Annual', plan.annual_amount != null ? formatMoney(plan.annual_amount, cur) : '—')}
              {row('Subscription', plan.subscription_status)}
              {row('Next billing date', plan.current_period_end ? formatShortDate(plan.current_period_end) : '—')}
              {row('Card saved', plan.has_payment_method ? 'Yes' : 'No')}
            </>
          ) : <p style={{ margin: 0, fontSize: 14, color: color.muted }}>Plan not available.</p>}
        </Card>
      </div>

      <Card padded aria-labelledby="st-override">
        <h2 id="st-override" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Override plan or rate</h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: color.muted }}>Leave a field blank to keep it. Applies from the studio&apos;s next billing cycle.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
          <Field label="Plan" htmlFor="ov-plan">
            <select id="ov-plan" value={form.plan} onChange={set('plan')} style={controlStyle}>
              <option value="">Keep current plan</option>
              <option value="percentage">Pay as you go</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Field label="Percentage (%)" htmlFor="ov-pct" hint="e.g. 5 for 5%">
              <input id="ov-pct" type="number" min="0" step="0.01" value={form.percent} onChange={set('percent')} style={{ ...controlStyle, ...tabularNums }} />
            </Field>
            <Field label={`Monthly (${cur})`} htmlFor="ov-mo">
              <input id="ov-mo" type="number" min="0" step="0.01" value={form.monthly} onChange={set('monthly')} style={{ ...controlStyle, ...tabularNums }} />
            </Field>
            <Field label={`Annual (${cur})`} htmlFor="ov-yr">
              <input id="ov-yr" type="number" min="0" step="0.01" value={form.annual} onChange={set('annual')} style={{ ...controlStyle, ...tabularNums }} />
            </Field>
          </div>
          <Field label="Reason (required)" htmlFor="ov-reason" hint="Shown in the studio's activity log.">
            <textarea id="ov-reason" value={form.reason} onChange={set('reason')} style={{ ...controlStyle, minHeight: 72, padding: '10px 12px', resize: 'vertical' }} />
          </Field>
          {result && <div role={result.ok ? 'status' : 'alert'} style={alertStyle(result.ok ? 'ok' : 'danger')}>{result.text}</div>}
          <div><Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save override'}</Button></div>
        </div>
      </Card>
    </div>
  )
}
