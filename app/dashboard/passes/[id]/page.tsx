'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
        {label}
      </label>
      {hint && <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{hint}</p>}
      {children}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px',
        border: '1px solid #e2e2e2',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: 'white'
      }}
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px',
        border: '1px solid #e2e2e2',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: 'white',
        cursor: 'pointer'
      }}
    >
      {children}
    </select>
  )
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px',
        border: '1px solid #e2e2e2',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: 'white',
        minHeight: '80px',
        resize: 'vertical'
      }}
    />
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e2e2e2' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a1a' }}>{title}</h2>
      {description && <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{description}</p>}
    </div>
  )
}

function ToggleGroup<T extends string>({
  value, options, onChange
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            padding: '10px',
            border: `2px solid ${value === opt.value ? '#085041' : '#e2e2e2'}`,
            borderRadius: '8px',
            backgroundColor: value === opt.value ? '#e8f5ee' : 'white',
            color: value === opt.value ? '#085041' : '#444',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: value === opt.value ? 600 : 400
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface PassTemplateOption {
  id: string
  name: string
}

export default function EditPassTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [error, setError] = useState('')
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [templates, setTemplates] = useState<PassTemplateOption[]>([])

  const [form, setForm] = useState({
    name: '',
    description: '',
    passType: 'credit' as 'credit' | 'unlimited',
    creditCount: '10',
    expiryType: 'rolling_days' as 'fixed_date' | 'rolling_days' | 'rolling_months',
    expiryFixedDate: '',
    expiryRollingValue: '90',
    sessionTypeRestriction: [] as string[],
    deliveryModeRestriction: [] as string[],
    allowFreeze: true,
    maxFreezeDays: '30',
    creditReturnOnCancel: true,
    multiPassPriority: 'soonest_expiry' as 'soonest_expiry' | 'oldest_purchased' | 'member_choice',
    guestBookingsEnabled: '' as '' | 'true' | 'false',
    guestMaxPerBooking: '1',
    guestCreditsCost: '1',
    autoRenewEnabled: false,
    autoRenewPassTemplateId: '',
    price: '',
    currency: 'AUD',
    taxRateOverride: '',
    validFrom: '',
    validUntil: '',
  })

  const update = (key: string, value: string | boolean | string[]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleRestriction = (key: 'sessionTypeRestriction' | 'deliveryModeRestriction', val: string) => {
    const current = form[key]
    update(key, current.includes(val) ? current.filter(v => v !== val) : [...current, val])
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const t = session.access_token
      setToken(t)

      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()
      setOrgId(org.id)

      const [tplRes, allRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/pass-templates/${templateId}`,
          { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/pass-templates`,
          { headers: { Authorization: `Bearer ${t}` } })
      ])

      if (!tplRes.ok) { router.push('/dashboard/passes'); return }
      const pt = await tplRes.json()

      if (allRes.ok) {
        const all = await allRes.json()
        setTemplates(all.filter((x: any) => x.id !== templateId).map((x: any) => ({ id: x.id, name: x.name })))
      }

      setForm({
        name: pt.name ?? '',
        description: pt.description ?? '',
        passType: pt.pass_type ?? 'credit',
        creditCount: pt.credit_count?.toString() ?? '10',
        expiryType: pt.expiry_type ?? 'rolling_days',
        expiryFixedDate: pt.expiry_fixed_date ?? '',
        expiryRollingValue: pt.expiry_rolling_value?.toString() ?? '90',
        sessionTypeRestriction: pt.session_type_restriction ?? [],
        deliveryModeRestriction: pt.delivery_mode_restriction ?? [],
        allowFreeze: pt.allow_freeze ?? true,
        maxFreezeDays: pt.max_freeze_days?.toString() ?? '',
        creditReturnOnCancel: pt.credit_return_on_cancel ?? true,
        multiPassPriority: pt.multi_pass_priority ?? 'soonest_expiry',
        guestBookingsEnabled: pt.guest_bookings_enabled === null || pt.guest_bookings_enabled === undefined
          ? '' : (pt.guest_bookings_enabled ? 'true' : 'false'),
        guestMaxPerBooking: pt.guest_max_per_booking?.toString() ?? '1',
        guestCreditsCost: pt.guest_credits_cost?.toString() ?? '1',
        autoRenewEnabled: pt.auto_renew_enabled ?? false,
        autoRenewPassTemplateId: pt.auto_renew_pass_template_id ?? '',
        price: pt.price?.toString() ?? '',
        currency: pt.currency ?? 'AUD',
        taxRateOverride: pt.tax_rate_override?.toString() ?? '',
        validFrom: pt.valid_from ?? '',
        validUntil: pt.valid_until ?? '',
      })

      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, router])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Pass name is required'); return }
    if (!form.price.trim()) { setError('Price is required'); return }

    setSaving(true)
    setError('')

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/pass-templates/${templateId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            pass_type: form.passType,
            credit_count: form.passType === 'credit' ? parseInt(form.creditCount) : null,
            expiry_type: form.expiryType,
            expiry_fixed_date: form.expiryType === 'fixed_date' ? form.expiryFixedDate : null,
            expiry_rolling_value: form.expiryType !== 'fixed_date' ? parseInt(form.expiryRollingValue) : null,
            session_type_restriction: form.sessionTypeRestriction.length ? form.sessionTypeRestriction : [],
            delivery_mode_restriction: form.deliveryModeRestriction.length ? form.deliveryModeRestriction : [],
            allow_freeze: form.allowFreeze,
            max_freeze_days: form.allowFreeze && form.maxFreezeDays ? parseInt(form.maxFreezeDays) : null,
            credit_return_on_cancel: form.creditReturnOnCancel,
            multi_pass_priority: form.multiPassPriority,
            guest_bookings_enabled: form.guestBookingsEnabled === '' ? null : form.guestBookingsEnabled === 'true',
            guest_max_per_booking: form.guestBookingsEnabled === 'true' && form.guestMaxPerBooking ? parseInt(form.guestMaxPerBooking) : null,
            guest_credits_cost: form.guestBookingsEnabled === 'true' && form.guestCreditsCost ? parseInt(form.guestCreditsCost) : null,
            auto_renew_enabled: form.autoRenewEnabled,
            auto_renew_pass_template_id: form.autoRenewEnabled && form.autoRenewPassTemplateId ? form.autoRenewPassTemplateId : null,
            price: parseFloat(form.price),
            currency: form.currency,
            tax_rate_override: form.taxRateOverride ? parseFloat(form.taxRateOverride) : null,
            valid_from: form.validFrom || null,
            valid_until: form.validUntil || null,
          })
        }
      )

      if (res.ok) {
        router.push('/dashboard/passes')
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.title ?? data?.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirm('Deactivate this pass template? It will no longer be available to issue or purchase. Passes already issued from it are unaffected.')) return

    setDeactivating(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/pass-templates/${templateId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        router.push('/dashboard/passes')
      } else {
        setError('Could not deactivate this pass template.')
        setDeactivating(false)
      }
    } catch {
      setError('Could not deactivate this pass template.')
      setDeactivating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="passes" />
        <div style={{ marginLeft: '240px', flex: 1, padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <Sidebar active="passes" />

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px', maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <a href="/dashboard/passes" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
            ← Passes
          </a>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Edit pass template</h1>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

          <SectionHeader title="Basics" />

          <Field label="Pass name">
            <Input value={form.name} onChange={e => update('name', e.target.value)} />
          </Field>

          <Field label="Description" hint="Shown to members when purchasing. Optional.">
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} />
          </Field>

          <SectionHeader title="Type & credits" />

          <Field label="Pass type">
            <ToggleGroup
              value={form.passType}
              onChange={v => update('passType', v)}
              options={[
                { value: 'credit', label: 'Credit-based' },
                { value: 'unlimited', label: 'Unlimited' },
              ]}
            />
          </Field>

          {form.passType === 'credit' && (
            <Field label="Number of credits">
              <Input type="number" min="1" value={form.creditCount} onChange={e => update('creditCount', e.target.value)} />
            </Field>
          )}

          <SectionHeader title="Expiry" />

          <Field label="Expiry rule">
            <Select value={form.expiryType} onChange={e => update('expiryType', e.target.value)}>
              <option value="rolling_days">Rolling — days from purchase</option>
              <option value="rolling_months">Rolling — months from purchase</option>
              <option value="fixed_date">Fixed date</option>
            </Select>
          </Field>

          {form.expiryType === 'fixed_date' ? (
            <Field label="Expiry date">
              <Input type="date" value={form.expiryFixedDate} onChange={e => update('expiryFixedDate', e.target.value)} />
            </Field>
          ) : (
            <Field label={form.expiryType === 'rolling_days' ? 'Days until expiry' : 'Months until expiry'}>
              <Input type="number" min="1" value={form.expiryRollingValue} onChange={e => update('expiryRollingValue', e.target.value)} />
            </Field>
          )}

          <SectionHeader title="Restrictions" description="Leave unchecked to allow all session types / delivery modes" />

          <Field label="Session types">
            <div style={{ display: 'flex', gap: '8px' }}>
              {['class', 'workshop'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleRestriction('sessionTypeRestriction', t)}
                  style={{
                    padding: '8px 16px',
                    border: `2px solid ${form.sessionTypeRestriction.includes(t) ? '#085041' : '#e2e2e2'}`,
                    borderRadius: '8px',
                    backgroundColor: form.sessionTypeRestriction.includes(t) ? '#e8f5ee' : 'white',
                    color: form.sessionTypeRestriction.includes(t) ? '#085041' : '#444',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textTransform: 'capitalize'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Delivery modes">
            <div style={{ display: 'flex', gap: '8px' }}>
              {['in_person', 'online', 'hybrid'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleRestriction('deliveryModeRestriction', m)}
                  style={{
                    padding: '8px 16px',
                    border: `2px solid ${form.deliveryModeRestriction.includes(m) ? '#085041' : '#e2e2e2'}`,
                    borderRadius: '8px',
                    backgroundColor: form.deliveryModeRestriction.includes(m) ? '#e8f5ee' : 'white',
                    color: form.deliveryModeRestriction.includes(m) ? '#085041' : '#444',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </Field>

          <SectionHeader title="Freezing & cancellation" />

          <Field label="Allow members to freeze this pass">
            <ToggleGroup
              value={String(form.allowFreeze) as 'true' | 'false'}
              onChange={v => update('allowFreeze', v === 'true')}
              options={[{ value: 'true', label: 'Allowed' }, { value: 'false', label: 'Not allowed' }]}
            />
          </Field>

          {form.allowFreeze && (
            <Field label="Max freeze days" hint="Leave blank for unlimited">
              <Input type="number" min="0" value={form.maxFreezeDays} onChange={e => update('maxFreezeDays', e.target.value)} />
            </Field>
          )}

          <Field label="Return credit when a booking is cancelled in time">
            <ToggleGroup
              value={String(form.creditReturnOnCancel) as 'true' | 'false'}
              onChange={v => update('creditReturnOnCancel', v === 'true')}
              options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
            />
          </Field>

          <Field label="When a member holds multiple passes, use credits from">
            <Select value={form.multiPassPriority} onChange={e => update('multiPassPriority', e.target.value)}>
              <option value="soonest_expiry">Soonest to expire</option>
              <option value="oldest_purchased">Oldest purchased first</option>
              <option value="member_choice">Let the member choose</option>
            </Select>
          </Field>

          <SectionHeader title="Guest bookings" />

          <Field label="Guest bookings" hint="Leave as studio default to inherit the org-wide setting">
            <Select value={form.guestBookingsEnabled} onChange={e => update('guestBookingsEnabled', e.target.value)}>
              <option value="">Use studio default</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
          </Field>

          {form.guestBookingsEnabled === 'true' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="Max guests per booking">
                <Input type="number" min="1" value={form.guestMaxPerBooking} onChange={e => update('guestMaxPerBooking', e.target.value)} />
              </Field>
              <Field label="Credits per guest">
                <Input type="number" min="0" value={form.guestCreditsCost} onChange={e => update('guestCreditsCost', e.target.value)} />
              </Field>
            </div>
          )}

          <SectionHeader title="Auto-renew" />

          <Field label="Offer auto-renew on this pass">
            <ToggleGroup
              value={String(form.autoRenewEnabled) as 'true' | 'false'}
              onChange={v => update('autoRenewEnabled', v === 'true')}
              options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
            />
          </Field>

          {form.autoRenewEnabled && (
            <Field label="Renew into" hint="Which pass template members are moved to on renewal. Leave blank to renew into this same template.">
              <Select value={form.autoRenewPassTemplateId} onChange={e => update('autoRenewPassTemplateId', e.target.value)}>
                <option value="">Same template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
          )}

          <SectionHeader title="Pricing" description="Members see this price, in your studio's currency" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label={`Price (${form.currency})`}>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} />
            </Field>
            <Field label="Tax rate override (%)" hint="Leave blank to use the studio default">
              <Input type="number" min="0" step="0.01" value={form.taxRateOverride} onChange={e => update('taxRateOverride', e.target.value)} />
            </Field>
          </div>

          <SectionHeader title="Sale window" description="When this pass can be purchased. Leave blank for always available." />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Valid from">
              <Input type="date" value={form.validFrom} onChange={e => update('validFrom', e.target.value)} />
            </Field>
            <Field label="Valid until">
              <Input type="date" value={form.validUntil} onChange={e => update('validUntil', e.target.value)} />
            </Field>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', paddingTop: '24px', borderTop: '1px solid #e2e2e2' }}>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                border: '1px solid #f0c2c2',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#8b1a1a',
                cursor: deactivating ? 'not-allowed' : 'pointer',
                fontWeight: 500
              }}
            >
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <a href="/dashboard/passes" style={{
                padding: '10px 24px', border: '1px solid #e2e2e2', borderRadius: '8px',
                fontSize: '14px', color: '#444', textDecoration: 'none', fontWeight: 500
              }}>
                Cancel
              </a>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  backgroundColor: saving ? '#9fd6b8' : '#085041',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
