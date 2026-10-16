'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import { canManagePassTemplates } from '@/lib/roles'
import { Breadcrumb, Button, Modal, PageHeader, cardStyle, alertStyle, OptionButton, FormField as Field, TextInput as Input, SelectInput as Select, TextArea as Textarea, FormSection as SectionHeader, ChoiceGroup as ToggleGroup } from '@/app/components/admin'
import { color, space } from '@/lib/ui/tokens'
import styles from '@/app/dashboard/dashboard.module.css'

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
  const [roles, setRoles] = useState<string[]>([])
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
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const t = ctx.token
      setToken(t)
      const org = ctx.org
      setOrgId(org.id)
      setRoles(ctx.roles)

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

  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const handleDeactivate = async () => {
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
      <div className={styles.shell}>
        <Sidebar active="passes" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="passes" roles={roles} />

      <div className={styles.main}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
        <Breadcrumb items={[{ label: 'Passes', href: '/dashboard/passes' }, { label: form.name || 'Pass type' }]} />
        <PageHeader title={canManagePassTemplates(roles) ? 'Edit pass type' : 'Pass type'} />

        {!canManagePassTemplates(roles) && (
          <div role="status" style={{ padding: '12px 16px', background: color.infoBg, borderRadius: 10, color: color.infoInk, fontSize: 15 }}>
            You can view this pass type, but only an admin can change it.
          </div>
        )}

        <div style={{
          ...cardStyle, padding: '24px 28px',
          opacity: canManagePassTemplates(roles) ? 1 : 0.7,
          pointerEvents: canManagePassTemplates(roles) ? 'auto' : 'none'
        }}>

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

          <SectionHeader title="Restrictions" description="Leave all unselected to allow every session type and delivery mode" />

          <Field label="Session types">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['class', 'workshop'].map(t => (
                <OptionButton key={t} on={form.sessionTypeRestriction.includes(t)} onClick={() => toggleRestriction('sessionTypeRestriction', t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </OptionButton>
              ))}
            </div>
          </Field>

          <Field label="Delivery modes">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['in_person', 'online'].map(m => (
                <OptionButton key={m} on={form.deliveryModeRestriction.includes(m)} onClick={() => toggleRestriction('deliveryModeRestriction', m)}>
                  {m === 'in_person' ? 'In person' : 'Online'}
                </OptionButton>
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
            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            <Field label="Renew into" hint="Which pass type members move to on renewal. Leave as Same pass type to renew into this one.">
              <Select value={form.autoRenewPassTemplateId} onChange={e => update('autoRenewPassTemplateId', e.target.value)}>
                <option value="">Same pass type</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
          )}

          <SectionHeader title="Pricing" description="Members see this price, in your studio's currency" />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label={`Price (${form.currency})`}>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} />
            </Field>
            <Field label="Tax rate override (%)" hint="Leave blank to use the studio default">
              <Input type="number" min="0" step="0.01" value={form.taxRateOverride} onChange={e => update('taxRateOverride', e.target.value)} />
            </Field>
          </div>

          <SectionHeader title="Sale window" description="When this pass can be purchased. Leave blank for always available." />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Valid from">
              <Input type="date" value={form.validFrom} onChange={e => update('validFrom', e.target.value)} />
            </Field>
            <Field label="Valid until">
              <Input type="date" value={form.validUntil} onChange={e => update('validUntil', e.target.value)} />
            </Field>
          </div>

          {error && (
            <div role="alert" style={{ ...alertStyle(), marginBottom: space.formGap }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', paddingTop: 20, borderTop: `1px solid ${color.divider}` }}>
            <Button variant="destructive" onClick={() => setConfirmDeactivate(true)} disabled={deactivating}>{deactivating ? 'Deactivating…' : 'Deactivate'}</Button>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Button href="/dashboard/passes">Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {confirmDeactivate && (
        <Modal title="Deactivate this pass type?" onClose={() => setConfirmDeactivate(false)} width={460}>
          <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
            It will no longer be available to issue or buy. Passes already issued from it keep working until they expire.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Button onClick={() => setConfirmDeactivate(false)} style={{ flex: '1 1 140px' }}>Keep it</Button>
            <Button variant="destructive" onClick={() => { setConfirmDeactivate(false); handleDeactivate() }} style={{ flex: '1 1 140px' }}>Deactivate</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
