'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import BannerCropModal from './BannerCropModal'
import { canManageSettings } from '@/lib/roles'
import styles from '@/app/dashboard/dashboard.module.css'

// IANA zone names straight from the runtime — an empty list (older browser) falls back to a text input.
const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
})()

// ISO 3166-1 alpha-2 → display name, for showing the onboarding-set country read-only.
const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia', US: 'United States', GB: 'United Kingdom', NZ: 'New Zealand',
  CA: 'Canada', SG: 'Singapore', IN: 'India', IE: 'Ireland', ZA: 'South Africa',
}
const countryLabel = (code: string) => {
  if (!code) return '—'
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? COUNTRY_NAMES[code] ?? code
  } catch {
    return COUNTRY_NAMES[code] ?? code
  }
}

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
        width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
        fontSize: '14px', outline: 'none', backgroundColor: 'white'
      }}
    />
  )
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
        fontSize: '14px', outline: 'none', backgroundColor: 'white', minHeight: '80px', resize: 'vertical'
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

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className={styles.shell}>
        <Sidebar active="settings" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    email: '',
    phone: '',
    logoUrl: '',
    bannerUrl: '',
    brandColor: '#085041',
    taxEnabled: false,
    taxLabel: '',
    taxRegistrationNumber: '',
    addressLine1: '',
    addressLine2: '',
    addressCity: '',
    addressState: '',
    addressPostcode: '',
    timezone: '',
    locale: '',
    country: '', // onboarding-only; shown read-only, never sent
    cancellationHours: '',
    bookingWindowDays: '',
    minAdvanceBookingHours: '',
    lateCancelCreditsForfeited: true,
    liabilityWaiverRequired: true,
  })

  // The waiver text is edited and saved on its own — PATCH /liability-waiver, separate from the
  // main settings save, because every edit bumps the version and re-prompts every member to accept.
  const [waiverText, setWaiverText] = useState('')
  const [initialWaiverText, setInitialWaiverText] = useState('')
  const [waiverVersion, setWaiverVersion] = useState<number | null>(null)
  const [savingWaiver, setSavingWaiver] = useState(false)
  const [waiverMsg, setWaiverMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [taxRates, setTaxRates] = useState<{ id: string; rate: number; effective_from: string; effective_until: string | null; notes: string | null }[]>([])
  const [showAddRate, setShowAddRate] = useState(false)
  const [addRateForm, setAddRateForm] = useState({ rate: '', effectiveFrom: '', notes: '' })
  const [addingRate, setAddingRate] = useState(false)
  const [rateError, setRateError] = useState('')

  // Set at onboarding, not editable here — shown read-only for context alongside timezone/locale.
  const [currency, setCurrency] = useState('')

  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const [stripeBanner, setStripeBanner] = useState<'success' | 'failure' | null>(null)

  const update = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    const connected = searchParams.get('stripe_connected')
    if (connected === 'true') setStripeBanner('success')
    else if (connected === 'false') setStripeBanner('failure')
    if (connected !== null) router.replace('/dashboard/settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      const myRoles: string[] = roleRes.ok ? (await roleRes.json()).roles : []
      setRoles(myRoles)

      if (!canManageSettings(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      setForm({
        name: org.name ?? '',
        description: org.description ?? '',
        email: org.email ?? '',
        phone: org.phone ?? '',
        logoUrl: org.logo_url ?? '',
        bannerUrl: org.banner_url ?? '',
        brandColor: org.brand_color ?? '#085041',
        taxEnabled: org.tax_enabled ?? false,
        taxLabel: org.tax_label ?? '',
        taxRegistrationNumber: org.tax_registration_number ?? '',
        addressLine1: org.address_line1 ?? '',
        addressLine2: org.address_line2 ?? '',
        addressCity: org.address_city ?? '',
        addressState: org.address_state ?? '',
        addressPostcode: org.address_postcode ?? '',
        timezone: org.timezone ?? '',
        locale: org.locale ?? '',
        country: org.country ?? '',
        cancellationHours: org.cancellation_hours != null ? String(org.cancellation_hours) : '',
        bookingWindowDays: org.booking_window_days != null ? String(org.booking_window_days) : '',
        minAdvanceBookingHours: org.min_advance_booking_hours != null ? String(org.min_advance_booking_hours) : '',
        lateCancelCreditsForfeited: org.late_cancel_credits_forfeited ?? true,
        liabilityWaiverRequired: org.liability_waiver_required ?? true,
      })
      setWaiverText(org.liability_waiver_text ?? '')
      setInitialWaiverText(org.liability_waiver_text ?? '')
      setWaiverVersion(org.liability_waiver_version ?? null)
      setCurrency(org.currency ?? '')
      setStripeOnboardingComplete(org.stripe_onboarding_complete ?? false)
      setStripeAccountId(org.stripe_account_id ?? null)

      const ratesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/tax-rates`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (ratesRes.ok) setTaxRates(await ratesRes.json())

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const reloadTaxRates = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/tax-rates`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) setTaxRates(await res.json())
  }

  const handleConnectStripe = async () => {
    setConnectingStripe(true)
    setStripeError('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/stripe/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const { url } = await res.json()
        window.location.href = url
      } else {
        const data = await res.json().catch(() => null)
        setStripeError(data?.error ?? 'Could not start Stripe Connect. Please try again.')
        setConnectingStripe(false)
      }
    } catch {
      setStripeError('Could not start Stripe Connect. Please try again.')
      setConnectingStripe(false)
    }
  }

  const openAddRate = () => {
    setRateError('')
    setAddRateForm({ rate: '', effectiveFrom: '', notes: '' })
    setShowAddRate(true)
  }

  const handleAddRate = async () => {
    if (!addRateForm.rate || !addRateForm.effectiveFrom) {
      setRateError('Rate and effective date are both required')
      return
    }

    setAddingRate(true)
    setRateError('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/tax-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rate: parseFloat(addRateForm.rate),
          effective_from: addRateForm.effectiveFrom,
          notes: addRateForm.notes || null,
        })
      })

      if (res.ok) {
        setShowAddRate(false)
        await reloadTaxRates()
      } else {
        const data = await res.json().catch(() => null)
        setRateError(data?.error ?? 'Could not add this rate.')
      }
    } catch {
      setRateError('Could not add this rate.')
    } finally {
      setAddingRate(false)
    }
  }

  const uploadImage = async (file: File, folder: 'org-logos' | 'org-banners'): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return null
    }

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${folder}/${orgId}-${Date.now()}.${ext}`

    const { data, error: uploadError } = await supabase.storage
      .from('teacher-photos')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('teacher-photos').getPublicUrl(data.path)
    return publicUrl
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingLogo(true)
    const url = await uploadImage(file, 'org-logos')
    if (url) update('logoUrl', url)
    setUploadingLogo(false)
  }

  // The banner isn't uploaded straight away — the file goes into the crop modal, which uploads the
  // framed 3:1 version and hands back its URL.
  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB'); return }
    setBannerFile(file)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Studio name is required'); return }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          email: form.email || null,
          phone: form.phone || null,
          logo_url: form.logoUrl || null,
          banner_url: form.bannerUrl || null,
          brand_color: form.brandColor || null,
          tax_enabled: form.taxEnabled,
          tax_label: form.taxLabel || null,
          tax_registration_number: form.taxRegistrationNumber || null,
          address_line1: form.addressLine1 || null,
          address_line2: form.addressLine2 || null,
          address_city: form.addressCity || null,
          address_state: form.addressState || null,
          address_postcode: form.addressPostcode || null,
          timezone: form.timezone || null,
          locale: form.locale || null,
          cancellation_hours: form.cancellationHours !== '' ? parseInt(form.cancellationHours, 10) : null,
          booking_window_days: form.bookingWindowDays !== '' ? parseInt(form.bookingWindowDays, 10) : null,
          min_advance_booking_hours: form.minAdvanceBookingHours !== '' ? parseInt(form.minAdvanceBookingHours, 10) : null,
          late_cancel_credits_forfeited: form.lateCancelCreditsForfeited,
          liability_waiver_required: form.liabilityWaiverRequired,
        })
      })

      if (res.ok) {
        setSuccess('Settings saved.')
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Failed to save. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveWaiver = async () => {
    if (!waiverText.trim()) { setWaiverMsg({ ok: false, text: 'Waiver text cannot be empty.' }); return }
    setSavingWaiver(true)
    setWaiverMsg(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/liability-waiver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: waiverText }),
      })
      if (res.ok) {
        const org = await res.json().catch(() => null)
        setInitialWaiverText(waiverText)
        setWaiverVersion(org?.liability_waiver_version ?? (waiverVersion != null ? waiverVersion + 1 : null))
        setWaiverMsg({ ok: true, text: 'Waiver saved. Members will be asked to accept the new version before their next booking.' })
      } else {
        const data = await res.json().catch(() => null)
        setWaiverMsg({ ok: false, text: data?.error ?? 'Could not save the waiver. Please try again.' })
      }
    } catch {
      setWaiverMsg({ ok: false, text: 'Could not save the waiver. Please try again.' })
    } finally {
      setSavingWaiver(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="settings" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="settings" roles={roles} />

      <div className={styles.main} style={{ maxWidth: '760px' }}>
        {forbidden ? <Forbidden /> : <>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Settings</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
            Your studio's profile — what members see on your booking page
          </p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

          <SectionHeader title="Branding" description="Your logo and banner appear on your public booking page and teacher pages" />

          <Field label="Logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '12px', backgroundColor: '#f4f4f4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '1px solid #e2e2e2', flexShrink: 0
              }}>
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '24px' }}>🏢</span>
                )}
              </div>
              <label style={{
                padding: '8px 16px', backgroundColor: '#f4f4f4', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, color: '#444', cursor: uploadingLogo ? 'not-allowed' : 'pointer'
              }}>
                {uploadingLogo ? 'Uploading...' : form.logoUrl ? 'Replace logo' : 'Upload logo'}
                <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
              </label>
              {form.logoUrl && (
                <button
                  onClick={() => update('logoUrl', '')}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          </Field>

          <Field label="Banner" hint="Wide image at the top of your booking page, shown at 3:1. After you pick a file you'll frame it — drag to position, slider to zoom.">
            <div>
              <div style={{
                width: '100%', aspectRatio: '3 / 1', maxHeight: '200px', borderRadius: '12px', backgroundColor: '#f4f4f4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '1px solid #e2e2e2', marginBottom: '12px'
              }}>
                {form.bannerUrl ? (
                  <img src={form.bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '13px', color: '#999' }}>No banner uploaded</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{
                  padding: '8px 16px', backgroundColor: '#f4f4f4', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 500, color: '#444', cursor: 'pointer'
                }}>
                  {form.bannerUrl ? 'Replace banner' : 'Upload banner'}
                  <input type="file" accept="image/*" onChange={handleBannerFile} style={{ display: 'none' }} />
                </label>
                {form.bannerUrl && (
                  <button
                    onClick={() => update('bannerUrl', '')}
                    style={{ background: 'none', border: 'none', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Field>

          <Field label="Brand colour" hint="Used as the accent colour on your public pages">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="color"
                value={form.brandColor}
                onChange={e => update('brandColor', e.target.value)}
                style={{ width: '44px', height: '36px', border: '1px solid #e2e2e2', borderRadius: '8px', padding: '2px', cursor: 'pointer' }}
              />
              <Input value={form.brandColor} onChange={e => update('brandColor', e.target.value)} style={{ maxWidth: '140px' }} />
            </div>
          </Field>

          <SectionHeader title="Studio profile" />

          <Field label="Studio name">
            <Input value={form.name} onChange={e => update('name', e.target.value)} />
          </Field>

          <Field label="Description" hint="Shown on your public booking page">
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} />
          </Field>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Contact email">
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
            </Field>
          </div>

          <SectionHeader title="Business address" description="Appears on the receipts and invoices members download" />

          <Field label="Address line 1">
            <Input value={form.addressLine1} onChange={e => update('addressLine1', e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <Input value={form.addressLine2} onChange={e => update('addressLine2', e.target.value)} />
          </Field>
          <div className={styles.formGrid} style={{ gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
            <Field label="City / suburb">
              <Input value={form.addressCity} onChange={e => update('addressCity', e.target.value)} />
            </Field>
            <Field label="State">
              <Input value={form.addressState} onChange={e => update('addressState', e.target.value)} />
            </Field>
            <Field label="Postcode">
              <Input value={form.addressPostcode} onChange={e => update('addressPostcode', e.target.value)} />
            </Field>
          </div>

          <SectionHeader title="Region & locale" description="Timezone drives class times, pass expiry, and the local time shown in every email. Country and currency are fixed at onboarding." />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Timezone">
              {TIMEZONES.length > 0 ? (
                <select
                  value={form.timezone}
                  onChange={e => update('timezone', e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
                    fontSize: '14px', outline: 'none', backgroundColor: 'white'
                  }}
                >
                  <option value="">Not set</option>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              ) : (
                <Input placeholder="Australia/Brisbane" value={form.timezone} onChange={e => update('timezone', e.target.value)} />
              )}
            </Field>
            <Field label="Locale" hint="IETF language tag — controls date and number formatting on receipts and emails.">
              <Input placeholder="en-AU" value={form.locale} onChange={e => update('locale', e.target.value)} />
            </Field>
          </div>
          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Country" hint="Set at onboarding — it drives tax rules and your Stripe payout account.">
              <Input value={countryLabel(form.country)} disabled style={{ maxWidth: '220px', backgroundColor: '#f4f4f4', color: '#666' }} />
            </Field>
            <Field label="Currency" hint="Set at onboarding — it's baked into every stored price and Stripe charge.">
              <Input value={currency || '—'} disabled style={{ maxWidth: '120px', backgroundColor: '#f4f4f4', color: '#666' }} />
            </Field>
          </div>

          <SectionHeader title="Booking policy" description="Studio-wide defaults. Individual sessions can override the cancellation window." />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Cancellation window (hours)" hint="Members can cancel for free up to this many hours before a class starts.">
              <Input type="number" min="0" value={form.cancellationHours} onChange={e => update('cancellationHours', e.target.value)} />
            </Field>
            <Field label="Minimum notice (hours)" hint="Members can't book a class starting sooner than this. Blank keeps the current setting.">
              <Input type="number" min="0" value={form.minAdvanceBookingHours} onChange={e => update('minAdvanceBookingHours', e.target.value)} />
            </Field>
          </div>
          <Field label="Booking window (days)" hint="How far ahead members can book. Blank keeps the current setting.">
            <Input type="number" min="0" value={form.bookingWindowDays} onChange={e => update('bookingWindowDays', e.target.value)} style={{ maxWidth: '200px' }} />
          </Field>
          <Field label="Late cancellations">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.lateCancelCreditsForfeited}
                onChange={e => update('lateCancelCreditsForfeited', e.target.checked)}
              />
              Forfeit the pass credit when a member cancels after the window closes
            </label>
          </Field>

          <SectionHeader title="Legal" description="Your studio's own liability waiver. The platform Terms & Conditions are CalaStudio's, identical for every studio, and aren't editable here." />

          <Field label="Require a liability waiver" hint="Turn this off if your studio doesn't run physical activity. Members then only accept the platform Terms & Conditions.">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.liabilityWaiverRequired}
                onChange={e => update('liabilityWaiverRequired', e.target.checked)}
              />
              Members must accept this waiver before their first booking
            </label>
          </Field>

          <Field
            label="Liability waiver text"
            hint="House rules, risk acknowledgement, medical declaration, photo/video consent — whatever a member agrees to when they join. This is a starting template; review it for your studio and jurisdiction."
          >
            {waiverVersion != null && (
              <p style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>Current version: {waiverVersion}</p>
            )}
            <textarea
              value={waiverText}
              onChange={e => setWaiverText(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
                fontSize: '13px', lineHeight: 1.6, outline: 'none', backgroundColor: 'white',
                minHeight: '220px', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: '12px', color: '#7a4f00', marginTop: '8px' }}>
              Saving new wording publishes the next version. Every member is asked to accept it again before their next booking.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <button
                onClick={handleSaveWaiver}
                disabled={savingWaiver || waiverText === initialWaiverText || !waiverText.trim()}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  border: '1px solid #d2d2d2', color: '#1a1a1a',
                  backgroundColor: (savingWaiver || waiverText === initialWaiverText || !waiverText.trim()) ? '#f4f4f4' : 'white',
                  cursor: (savingWaiver || waiverText === initialWaiverText || !waiverText.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {savingWaiver ? 'Saving...' : 'Save waiver text'}
              </button>
              {waiverText !== initialWaiverText && !savingWaiver && (
                <button
                  onClick={() => { setWaiverText(initialWaiverText); setWaiverMsg(null) }}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: '#666', cursor: 'pointer' }}
                >
                  Discard changes
                </button>
              )}
              {waiverMsg && (
                <span style={{ fontSize: '13px', color: waiverMsg.ok ? '#085041' : '#8b1a1a' }}>{waiverMsg.text}</span>
              )}
            </div>
          </Field>

          <SectionHeader title="Payments" description="Connect Stripe so members can pay for drop-in classes and passes — money goes straight to your bank account, CalaStudio takes no commission" />

          {stripeBanner === 'success' && (
            <div style={{ padding: '12px 16px', backgroundColor: '#e8f5ee', borderRadius: '8px', color: '#085041', fontSize: '14px', marginBottom: '20px' }}>
              Stripe connected successfully.
            </div>
          )}
          {stripeBanner === 'failure' && (
            <div style={{ padding: '12px 16px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '14px', marginBottom: '20px' }}>
              Stripe connection failed or was cancelled. Please try again.
            </div>
          )}

          <Field label="Stripe">
            <div style={{
              border: '1px solid #e2e2e2', borderRadius: '12px', padding: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', backgroundColor: '#635bff', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  fontWeight: 700, fontSize: '17px', flexShrink: 0
                }}>S</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>Stripe</div>
                  {stripeOnboardingComplete ? (
                    <div style={{ fontSize: '13px', color: '#085041', marginTop: '2px' }}>
                      ✓ Connected{stripeAccountId ? ` — ${stripeAccountId}` : ''}
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>Not connected</div>
                  )}
                </div>
              </div>

              {!stripeOnboardingComplete && (
                <button
                  onClick={handleConnectStripe}
                  disabled={connectingStripe}
                  style={{
                    padding: '10px 20px', backgroundColor: connectingStripe ? '#9fd6b8' : '#085041', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                    cursor: connectingStripe ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  {connectingStripe ? 'Connecting...' : 'Connect with Stripe'}
                </button>
              )}
            </div>
            {stripeError && (
              <p style={{ fontSize: '13px', color: '#8b1a1a', marginTop: '10px' }}>{stripeError}</p>
            )}
          </Field>

          <SectionHeader title="Tax (GST/VAT)" description="Configure how tax is calculated and shown on bookings" />

          <Field label="Tax collection">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.taxEnabled}
                onChange={e => update('taxEnabled', e.target.checked)}
              />
              Charge tax on bookings
            </label>
            {taxRates.length === 0 && (
              <p style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '8px' }}>
                Add at least one tax rate below before enabling — tax can't be turned on with no rate configured.
              </p>
            )}
          </Field>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Tax label" hint='Shown on pricing and receipts, e.g. "GST" or "VAT"'>
              <Input placeholder="GST" value={form.taxLabel} onChange={e => update('taxLabel', e.target.value)} />
            </Field>
            <Field label="Tax registration number" hint="Shown on receipts, e.g. your ABN or VAT number">
              <Input value={form.taxRegistrationNumber} onChange={e => update('taxRegistrationNumber', e.target.value)} />
            </Field>
          </div>

          <Field label="Tax rate schedule" hint="The rate in effect today applies automatically. Adding a new rate closes out the previous one the day before it starts.">
            {taxRates.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>No tax rates configured yet.</p>
            ) : (
              <div style={{ border: '1px solid #e2e2e2', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
                {taxRates.map((r, i) => (
                  <div key={r.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderBottom: i < taxRates.length - 1 ? '1px solid #f4f4f4' : 'none',
                    fontSize: '13px'
                  }}>
                    <div>
                      <strong>{r.rate}%</strong>
                      <span style={{ color: '#666', marginLeft: '8px' }}>
                        from {r.effective_from}{r.effective_until ? ` to ${r.effective_until}` : ' (current)'}
                      </span>
                      {r.notes && <span style={{ color: '#999', marginLeft: '8px' }}>— {r.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={openAddRate}
              style={{
                padding: '8px 16px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, color: '#444', cursor: 'pointer'
              }}
            >
              + Add rate
            </button>
          </Field>

          {error && (
            <div style={{ padding: '12px 16px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '12px 16px', backgroundColor: '#e8f5ee', borderRadius: '8px', color: '#085041', fontSize: '14px', marginBottom: '24px' }}>
              {success}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid #e2e2e2' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '10px 24px', backgroundColor: saving ? '#9fd6b8' : '#085041', color: 'white',
                border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
        </>}
      </div>

      {bannerFile && orgId && (
        <BannerCropModal
          file={bannerFile}
          orgId={orgId}
          onCancel={() => setBannerFile(null)}
          onDone={url => { update('bannerUrl', url); setBannerFile(null); setSuccess('Banner updated — remember to Save changes.') }}
        />
      )}

      {/* Add tax rate modal */}
      {showAddRate && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
            maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Add tax rate</h2>
              <button
                onClick={() => setShowAddRate(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="Rate (%)">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="10"
                  value={addRateForm.rate}
                  onChange={e => setAddRateForm(p => ({ ...p, rate: e.target.value }))}
                />
              </Field>
              <Field label="Effective from" hint="Must be after the currently active rate's start date">
                <Input
                  type="date"
                  value={addRateForm.effectiveFrom}
                  onChange={e => setAddRateForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                />
              </Field>
              <Field label="Notes" hint="Optional">
                <Input
                  placeholder="e.g. Rate change effective July 1"
                  value={addRateForm.notes}
                  onChange={e => setAddRateForm(p => ({ ...p, notes: e.target.value }))}
                />
              </Field>

              {rateError && (
                <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                  {rateError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setShowAddRate(false)}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                    borderRadius: '8px', fontSize: '14px', cursor: 'pointer', color: '#444'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRate}
                  disabled={addingRate}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: addingRate ? '#9fd6b8' : '#085041', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                    cursor: addingRate ? 'not-allowed' : 'pointer'
                  }}
                >
                  {addingRate ? 'Adding...' : 'Add rate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
