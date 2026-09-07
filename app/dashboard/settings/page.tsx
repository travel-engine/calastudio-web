'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canManageSettings } from '@/lib/roles'
import styles from '@/app/dashboard/dashboard.module.css'

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
  const [uploadingBanner, setUploadingBanner] = useState(false)
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
    cancellationHours: '',
    bookingWindowDays: '',
    minAdvanceBookingHours: '',
    lateCancelCreditsForfeited: true,
  })

  const [taxRates, setTaxRates] = useState<{ id: string; rate: number; effective_from: string; effective_until: string | null; notes: string | null }[]>([])
  const [showAddRate, setShowAddRate] = useState(false)
  const [addRateForm, setAddRateForm] = useState({ rate: '', effectiveFrom: '', notes: '' })
  const [addingRate, setAddingRate] = useState(false)
  const [rateError, setRateError] = useState('')

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
        cancellationHours: org.cancellation_hours != null ? String(org.cancellation_hours) : '',
        bookingWindowDays: org.booking_window_days != null ? String(org.booking_window_days) : '',
        minAdvanceBookingHours: org.min_advance_booking_hours != null ? String(org.min_advance_booking_hours) : '',
        lateCancelCreditsForfeited: org.late_cancel_credits_forfeited ?? true,
      })
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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingBanner(true)
    const url = await uploadImage(file, 'org-banners')
    if (url) update('bannerUrl', url)
    setUploadingBanner(false)
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
          cancellation_hours: form.cancellationHours !== '' ? parseInt(form.cancellationHours, 10) : null,
          booking_window_days: form.bookingWindowDays !== '' ? parseInt(form.bookingWindowDays, 10) : null,
          min_advance_booking_hours: form.minAdvanceBookingHours !== '' ? parseInt(form.minAdvanceBookingHours, 10) : null,
          late_cancel_credits_forfeited: form.lateCancelCreditsForfeited,
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

          <Field label="Banner" hint="Wide image shown at the top of your booking page. 1200×400px or similar works best.">
            <div>
              <div style={{
                width: '100%', height: '140px', borderRadius: '12px', backgroundColor: '#f4f4f4',
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
                  fontSize: '13px', fontWeight: 500, color: '#444', cursor: uploadingBanner ? 'not-allowed' : 'pointer'
                }}>
                  {uploadingBanner ? 'Uploading...' : form.bannerUrl ? 'Replace banner' : 'Upload banner'}
                  <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner} style={{ display: 'none' }} />
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
