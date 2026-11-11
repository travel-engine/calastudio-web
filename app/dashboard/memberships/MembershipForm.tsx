'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, cardStyle, alertStyle, OptionButton, FormField as Field, TextInput as Input, SelectInput as Select, TextArea as Textarea, FormSection as SectionHeader, ChoiceGroup as ToggleGroup } from '@/app/components/admin'
import { color, space } from '@/lib/ui/tokens'
import { formatMoney } from '@/lib/money'
import { periodUnit, type MembershipTemplate, type PeriodType } from '@/lib/memberships'
import styles from '@/app/dashboard/dashboard.module.css'

// Create / edit a membership template (POST / PATCH …/membership-templates). On edit, a new price
// asks whether existing members move too (price_change: new_only | existing, from a date or each
// member's next renewal); the API never changes a period someone has already paid for.

const SESSION_TYPES = ['class', 'workshop']

type FormState = {
  name: string
  description: string
  price: string
  taxRateOverride: string
  periodType: PeriodType
  periodValue: string
  fixedStart: string
  fixedEnd: string
  isRecurring: boolean
  maxCycles: string
  sessionCap: string
  sessionTypes: string[]
  graceDays: string
  guests: boolean
  guestMax: string
  isActive: boolean
  validFrom: string
  validUntil: string
}

function fromTemplate(t: MembershipTemplate | null): FormState {
  return {
    name: t?.name ?? '',
    description: t?.description ?? '',
    price: t ? String(t.price) : '',
    taxRateOverride: t?.tax_rate_override != null ? String(+(t.tax_rate_override * 100).toFixed(4)) : '',
    periodType: t?.period_type ?? 'rolling_weeks',
    periodValue: t?.period_rolling_value != null ? String(t.period_rolling_value) : '1',
    fixedStart: t?.period_fixed_start ?? '',
    fixedEnd: t?.period_fixed_end ?? '',
    isRecurring: t?.is_recurring ?? true,
    maxCycles: t?.max_cycles != null ? String(t.max_cycles) : '',
    sessionCap: t?.session_cap != null ? String(t.session_cap) : '',
    sessionTypes: t?.session_type_restriction ?? [],
    graceDays: t ? String(t.grace_days) : '3',
    guests: t?.guest_bookings_enabled ?? false,
    guestMax: t?.guest_max_per_booking != null ? String(t.guest_max_per_booking) : '1',
    isActive: t?.is_active ?? true,
    validFrom: t?.valid_from ?? '',
    validUntil: t?.valid_until ?? '',
  }
}

export default function MembershipForm({ orgId, token, currency, template }: {
  orgId: string
  token: string
  currency: string
  template: MembershipTemplate | null // null = new
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => fromTemplate(template))
  const [applyTo, setApplyTo] = useState<'new_only' | 'existing'>('new_only')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const toggleType = (t: string) =>
    update('sessionTypes', form.sessionTypes.includes(t) ? form.sessionTypes.filter(v => v !== t) : [...form.sessionTypes, t])

  const fixed = form.periodType === 'fixed_dates'
  const unit = periodUnit(form.periodType, parseInt(form.periodValue) || 1)
  const priceChanged = template != null && form.price !== '' && parseFloat(form.price) !== template.price
  const existingMembers = template?.active_member_count ?? 0

  const submit = async () => {
    if (!form.name.trim()) { setError('Give the membership a name.'); return }
    if (form.price.trim() === '' || isNaN(parseFloat(form.price))) { setError('Enter a price.'); return }
    if (fixed && (!form.fixedStart || !form.fixedEnd)) { setError('Choose the start and end dates.'); return }
    if (!fixed && !(parseInt(form.periodValue) >= 1)) { setError('The length must be at least 1.'); return }

    const full: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      currency,
      // The form takes a percentage; the API stores a 0–1 rate.
      tax_rate_override: form.taxRateOverride ? parseFloat(form.taxRateOverride) / 100 : null,
      period_type: form.periodType,
      period_rolling_value: fixed ? null : parseInt(form.periodValue),
      period_fixed_start: fixed ? form.fixedStart : null,
      period_fixed_end: fixed ? form.fixedEnd : null,
      is_recurring: fixed ? false : form.isRecurring,
      max_cycles: !fixed && form.isRecurring && form.maxCycles ? parseInt(form.maxCycles) : null,
      session_cap: form.sessionCap ? parseInt(form.sessionCap) : null,
      session_type_restriction: form.sessionTypes, // [] = every session type
      grace_days: form.graceDays ? parseInt(form.graceDays) : 0,
      guest_bookings_enabled: form.guests,
      guest_max_per_booking: form.guests && form.guestMax ? parseInt(form.guestMax) : null,
      is_active: form.isActive,
      valid_from: form.validFrom || null,
      valid_until: form.validUntil || null,
    }

    // PATCH sends only what changed; null there means "unchanged", so a blanked field goes in "clear".
    let body: Record<string, unknown> = full
    if (template) {
      const orig = template as unknown as Record<string, unknown>
      body = {}
      const clear: string[] = []
      for (const [k, v] of Object.entries(full)) {
        const before = k === 'session_type_restriction' ? (template.session_type_restriction ?? []) : orig[k]
        if (JSON.stringify(v) === JSON.stringify(before ?? null)) continue
        if (v == null) { if (k !== 'period_rolling_value') clear.push(k) } else body[k] = v
      }
      if (clear.length) body.clear = clear
      if (Object.keys(body).length === 0) { router.push('/dashboard/memberships'); return }
    }
    if (priceChanged) body.price_change = { apply_to: applyTo, effective_from: applyTo === 'existing' ? (effectiveFrom || null) : null }

    setBusy(true)
    setError('')
    try {
      const base = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/membership-templates`
      const res = await fetch(template ? `${base}/${template.id}` : base, {
        method: template ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { router.push('/dashboard/memberships'); return }
      const data = await res.json().catch(() => null)
      setError(res.status === 404 && !data ? 'Memberships aren’t available on this server yet.' : (data?.error ?? data?.title ?? 'Something went wrong. Please try again.'))
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...cardStyle, padding: '24px 28px' }}>
      <SectionHeader title="Basics" />

      <Field label="Membership name">
        <Input placeholder="e.g. Weekly Unlimited" value={form.name} onChange={e => update('name', e.target.value)} />
      </Field>

      <Field label="Description" hint="Shown to members when they buy. Optional.">
        <Textarea placeholder="What's included…" value={form.description} onChange={e => update('description', e.target.value)} />
      </Field>

      <SectionHeader title="Billing" description="Members pay the first period when they buy, from the start date they choose." />

      <Field label="Length of each period">
        <Select value={form.periodType} onChange={e => update('periodType', e.target.value as PeriodType)}>
          <option value="rolling_weeks">Weeks</option>
          <option value="rolling_months">Months</option>
          <option value="rolling_days">Days</option>
          <option value="fixed_dates">Set dates (same for everyone)</option>
        </Select>
      </Field>

      {fixed ? (
        <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Starts"><Input type="date" value={form.fixedStart} onChange={e => update('fixedStart', e.target.value)} /></Field>
          <Field label="Ends"><Input type="date" value={form.fixedEnd} onChange={e => update('fixedEnd', e.target.value)} /></Field>
        </div>
      ) : (
        <>
          <Field label={`How many ${form.periodType === 'rolling_weeks' ? 'weeks' : form.periodType === 'rolling_months' ? 'months' : 'days'}`}>
            <Input type="number" min="1" value={form.periodValue} onChange={e => update('periodValue', e.target.value)} />
          </Field>
          <Field label="Renews automatically">
            <ToggleGroup
              value={String(form.isRecurring) as 'true' | 'false'}
              onChange={v => update('isRecurring', v === 'true')}
              options={[{ value: 'true', label: `Yes, every ${unit}` }, { value: 'false', label: 'No, one period only' }]}
            />
          </Field>
          {form.isRecurring && (
            <Field label="Stop after this many renewals" hint="Leave blank to keep renewing until the member cancels.">
              <Input type="number" min="1" placeholder="No limit" value={form.maxCycles} onChange={e => update('maxCycles', e.target.value)} />
            </Field>
          )}
        </>
      )}

      <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label={`Price per period (${currency})`}>
          <Input type="number" min="0" step="0.01" placeholder="45.00" value={form.price} onChange={e => update('price', e.target.value)} />
        </Field>
        <Field label="Tax rate override (%)" hint="Leave blank to use the studio default">
          <Input type="number" min="0" step="0.01" placeholder="10" value={form.taxRateOverride} onChange={e => update('taxRateOverride', e.target.value)} />
        </Field>
      </div>

      {priceChanged && (
        <div style={{ ...alertStyle('warn'), marginBottom: space.formGap, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            Price changes from <strong>{formatMoney(template.price, currency)}</strong> to <strong>{formatMoney(parseFloat(form.price), currency)}</strong>.
            {' '}A period someone has already paid for never changes.
          </div>
          <ToggleGroup
            value={applyTo}
            onChange={v => setApplyTo(v)}
            options={[
              { value: 'new_only', label: 'New members only' },
              { value: 'existing', label: `Existing members too${existingMembers ? ` (${existingMembers})` : ''}` },
            ]}
          />
          {applyTo === 'existing' && (
            <Field label="From" hint="Leave blank for each member’s next renewal. Members are emailed the new price and when it starts.">
              <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
            </Field>
          )}
        </div>
      )}

      <Field label="Payment grace (days)" hint="If a renewal payment fails, members can keep booking this many days while we retry.">
        <Input type="number" min="0" value={form.graceDays} onChange={e => update('graceDays', e.target.value)} />
      </Field>

      <SectionHeader title="What it covers" description="Leave all unselected to cover every session type." />

      <Field label="Session types">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SESSION_TYPES.map(t => (
            <OptionButton key={t} on={form.sessionTypes.includes(t)} onClick={() => toggleType(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </OptionButton>
          ))}
        </div>
      </Field>

      <Field label={`Sessions per ${fixed ? 'membership' : unit}`} hint="Leave blank for unlimited.">
        <Input type="number" min="1" placeholder="Unlimited" value={form.sessionCap} onChange={e => update('sessionCap', e.target.value)} />
      </Field>

      <SectionHeader title="Guests" />

      <Field label="Members can bring guests on this membership" hint={form.sessionCap ? 'Each guest uses one session from the limit.' : 'Guests are covered too while there’s no session limit.'}>
        <ToggleGroup
          value={String(form.guests) as 'true' | 'false'}
          onChange={v => update('guests', v === 'true')}
          options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]}
        />
      </Field>
      {form.guests && (
        <Field label="Max guests per booking">
          <Input type="number" min="1" value={form.guestMax} onChange={e => update('guestMax', e.target.value)} />
        </Field>
      )}

      <SectionHeader title="Availability" description="When members can buy it. Leave dates blank for always." />

      <Field label="On sale">
        <ToggleGroup
          value={String(form.isActive) as 'true' | 'false'}
          onChange={v => update('isActive', v === 'true')}
          options={[{ value: 'true', label: 'On sale' }, { value: 'false', label: 'Hidden' }]}
        />
      </Field>
      <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Sell from"><Input type="date" value={form.validFrom} onChange={e => update('validFrom', e.target.value)} /></Field>
        <Field label="Sell until"><Input type="date" value={form.validUntil} onChange={e => update('validUntil', e.target.value)} /></Field>
      </div>

      {error && <div role="alert" style={{ ...alertStyle(), marginBottom: space.formGap }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', paddingTop: 20, borderTop: `1px solid ${color.divider}` }}>
        <Button href="/dashboard/memberships">Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : template ? 'Save changes' : 'Create membership'}
        </Button>
      </div>
    </div>
  )
}
