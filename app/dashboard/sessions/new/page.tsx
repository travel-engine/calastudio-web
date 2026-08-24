'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import { useSearchParams } from 'next/navigation'
import { canManageSessions } from '@/lib/roles'
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
        minHeight: '100px',
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

export default function NewSessionPage() {
  return (
    <Suspense fallback={
      <div className={styles.shell}>
        <Sidebar active="sessions" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    }>
      <NewSessionPageContent />
    </Suspense>
  )
}

function NewSessionPageContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    sessionType: 'class',
    deliveryMode: 'in_person',
    locationName: '',
    locationAddress: '',
    capacityInperson: '12',
    capacityOnline: '',
    priceInperson: '',
    priceOnline: '',
    currency: 'AUD',
    durationMinutes: '60',
    firstOccurrenceDate: '',
    firstOccurrenceTime: '09:00',
    isRecurring: false,
    recurrenceRule: '',
    recurrenceDays: [] as string[],
    recurrenceEndMode: 'never' as 'never' | 'date' | 'count',
    recurrenceEndDate: '',
    recurrenceCount: '10',
    visibility: 'public',
    bookingAccessMode: 'open',
    cancellationHours: '12',
    bookingWindowDays: '',
    minAdvanceBookingHours: '',
    taxRateOverride: '',
    guestBookingsEnabled: true,
    guestMaxPerBooking: '1',
    instructorId: '',
    photoUrl: '',
    approvedPassTemplateIds: [] as string[],
    allowDropIn: false,
  })
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([])
  const [passTemplates, setPassTemplates] = useState<{ id: string; name: string }[]>([])
  const searchParams = useSearchParams()
  const copyId = searchParams.get('copy')

  useEffect(() => {
    const checkAccess = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const token = session.access_token
      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const roles: string[] = roleRes.ok ? (await roleRes.json()).roles : []

      if (!canManageSessions(roles)) { router.push('/dashboard/sessions'); return }

      const teachersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/teachers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (teachersRes.ok) {
        const data = await teachersRes.json()
        setTeachers(data.map((t: any) => ({ id: t.id, full_name: t.full_name })))
      }

      const passTemplatesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/pass-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (passTemplatesRes.ok) {
        const data = await passTemplatesRes.json()
        setPassTemplates(data.map((t: any) => ({ id: t.id, name: t.name })))
      }

      setCheckingAccess(false)
    }
    checkAccess()
  }, [router])

  useEffect(() => {
    if (!copyId) return
  
    const loadCopy = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
  
      const token = session.access_token
  
      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!orgRes.ok) return
      const org = await orgRes.json()
  
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions/${copyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) return
      const s = await res.json()
  
      setForm(prev => ({
        ...prev,
        name: `${s.name} (copy)`,
        description: s.description ?? '',
        sessionType: s.session_type ?? 'class',
        deliveryMode: s.delivery_mode ?? 'in_person',
        locationName: s.location_name ?? '',
        locationAddress: s.location_address ?? '',
        capacityInperson: s.capacity_inperson?.toString() ?? '12',
        capacityOnline: s.capacity_online?.toString() ?? '',
        priceInperson: s.price_inperson?.toString() ?? '',
        priceOnline: s.price_online?.toString() ?? '',
        currency: s.currency ?? 'AUD',
        durationMinutes: s.duration_minutes?.toString() ?? '60',
        isRecurring: s.is_recurring ?? false,
        recurrenceRule: s.recurrence_rule ?? '',
        visibility: 'draft',
        bookingAccessMode: s.booking_access_mode ?? 'open',
        cancellationHours: s.cancellation_hours?.toString() ?? '12',
        bookingWindowDays: s.booking_window_days?.toString() ?? '',
        minAdvanceBookingHours: s.min_advance_booking_hours?.toString() ?? '',
        taxRateOverride: s.tax_rate_override?.toString() ?? '',
        guestBookingsEnabled: s.guest_bookings_enabled ?? true,
        guestMaxPerBooking: s.guest_max_per_booking?.toString() ?? '1',
        instructorId: s.instructor_id ?? '',
        photoUrl: s.photo_url ?? '',
      }))

      if (s.booking_access_mode === 'restricted') {
        const paRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions/${copyId}/pricing-access`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (paRes.ok) {
          const rows = await paRes.json()
          setForm(prev => ({
            ...prev,
            approvedPassTemplateIds: rows
              .filter((r: any) => r.pricing_type === 'pass_template')
              .map((r: any) => r.pass_template_id),
            allowDropIn: rows.some((r: any) => r.pricing_type === 'drop_in'),
          }))
        }
      }
    }

    loadCopy()
  }, [copyId])
  
  const update = (key: string, value: string | boolean | string[]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleDay = (day: string) => {
    const days = form.recurrenceDays.includes(day)
      ? form.recurrenceDays.filter(d => d !== day)
      : [...form.recurrenceDays, day]
    update('recurrenceDays', days)
  }

  const togglePassTemplate = (id: string) => {
    const ids = form.approvedPassTemplateIds.includes(id)
      ? form.approvedPassTemplateIds.filter(x => x !== id)
      : [...form.approvedPassTemplateIds, id]
    update('approvedPassTemplateIds', ids)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }

    setUploadingPhoto(true)
    setError('')

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `sessions/${crypto.randomUUID()}.${ext}`

      const { data, error: uploadError } = await supabase.storage
        .from('teacher-photos')
        .upload(path, file, { upsert: false })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('teacher-photos').getPublicUrl(data.path)
      update('photoUrl', publicUrl)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const buildRRule = () => {
    if (!form.isRecurring) return ''
    if (form.recurrenceDays.length === 0) return 'RRULE:FREQ=WEEKLY'
    return `RRULE:FREQ=WEEKLY;BYDAY=${form.recurrenceDays.join(',')}`
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Session name is required')
      return
    }
    if (!form.firstOccurrenceDate) {
      setError('First occurrence date is required')
      return
    }

    const firstOccurrenceStartsAt = new Date(`${form.firstOccurrenceDate}T${form.firstOccurrenceTime}`)

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const token = session.access_token

      // Get org
      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()

      // Create session
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          session_type: form.sessionType,
          delivery_mode: form.deliveryMode,
          location_name: form.locationName || null,
          location_address: form.locationAddress || null,
          photo_url: form.photoUrl || null,
          capacity_inperson: form.capacityInperson ? parseInt(form.capacityInperson) : null,
          capacity_online: form.capacityOnline ? parseInt(form.capacityOnline) : null,
          price_inperson: form.priceInperson ? parseFloat(form.priceInperson) : null,
          price_online: form.priceOnline ? parseFloat(form.priceOnline) : null,
          currency: form.currency,
          duration_minutes: parseInt(form.durationMinutes),
          first_occurrence_starts_at: firstOccurrenceStartsAt.toISOString(),
          is_recurring: form.isRecurring,
          recurrence_rule: buildRRule() || null,
          recurrence_end_date: form.isRecurring && form.recurrenceEndMode === 'date' && form.recurrenceEndDate ? form.recurrenceEndDate : null,
          recurrence_count: form.isRecurring && form.recurrenceEndMode === 'count' && form.recurrenceCount ? parseInt(form.recurrenceCount) : null,
          visibility: form.visibility,
          booking_access_mode: form.bookingAccessMode,
          cancellation_hours: parseInt(form.cancellationHours),
          booking_window_days: form.bookingWindowDays ? parseInt(form.bookingWindowDays) : null,
          min_advance_booking_hours: form.minAdvanceBookingHours ? parseInt(form.minAdvanceBookingHours) : null,
          tax_rate_override: form.taxRateOverride ? parseFloat(form.taxRateOverride) : null,
          guest_bookings_enabled: form.guestBookingsEnabled,
          guest_max_per_booking: parseInt(form.guestMaxPerBooking),
          instructor_id: form.instructorId || null,
        })
      })

      if (res.ok) {
        const created = await res.json()

        if (form.bookingAccessMode === 'restricted') {
          const paRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions/${created.id}/pricing-access`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                pass_template_ids: form.approvedPassTemplateIds,
                allow_drop_in: form.allowDropIn,
              })
            }
          )
          if (!paRes.ok) {
            router.push(`/dashboard/sessions/${created.id}`)
            return
          }
        }

        router.push('/dashboard/sessions')
      } else {
        const data = await res.json()
        setError(data.title ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const days = [
    { code: 'MO', label: 'Mon' },
    { code: 'TU', label: 'Tue' },
    { code: 'WE', label: 'Wed' },
    { code: 'TH', label: 'Thu' },
    { code: 'FR', label: 'Fri' },
    { code: 'SA', label: 'Sat' },
    { code: 'SU', label: 'Sun' },
  ]

  if (checkingAccess) {
    return (
      <div className={styles.shell}>
        <Sidebar active="sessions" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>

      {/* Sidebar */}
      <Sidebar active="sessions"/>

      {/* Main */}
      <div className={styles.main} style={{ maxWidth: '800px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          
            <a href="/dashboard/sessions"
            style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}
          >
            ← Sessions
          </a>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
            {copyId ? 'Copy session' : 'New session'}
            </h1>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>

          {/* Basics */}
          <SectionHeader title="Basics" />

          <Field label="Photo" hint="Shown on your booking page and in the schedule. Optional.">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '12px', backgroundColor: '#f4f4f4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '1px solid #e2e2e2', flexShrink: 0
              }}>
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Session" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '24px' }}>📷</span>
                )}
              </div>
              <label style={{
                padding: '8px 16px', backgroundColor: '#f4f4f4', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, color: '#444', cursor: uploadingPhoto ? 'not-allowed' : 'pointer'
              }}>
                {uploadingPhoto ? 'Uploading...' : form.photoUrl ? 'Replace photo' : 'Upload photo'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
              </label>
              {form.photoUrl && (
                <button
                  onClick={() => update('photoUrl', '')}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          </Field>

          <Field label="Session name">
            <Input
              placeholder="e.g. Morning Vinyasa"
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </Field>

          <Field label="Description" hint="Shown on your booking page. Optional.">
            <Textarea
              placeholder="Tell your students what to expect..."
              value={form.description}
              onChange={e => update('description', e.target.value)}
            />
          </Field>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Session type">
              <Select value={form.sessionType} onChange={e => update('sessionType', e.target.value)}>
                <option value="class">Class</option>
                <option value="workshop">Workshop</option>
              </Select>
            </Field>

            <Field label="Duration">
              <Select value={form.durationMinutes} onChange={e => update('durationMinutes', e.target.value)}>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="75">75 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">2 hours</option>
              </Select>
            </Field>
          </div>

          <Field label="Instructor" hint="Determines which teacher this session shows up for under their own sessions and bookings">
            <Select value={form.instructorId} onChange={e => update('instructorId', e.target.value)}>
              <option value="">Unassigned</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </Select>
          </Field>

          {/* Delivery */}
          <SectionHeader title="Delivery" description="How will students attend this session?" />

          <Field label="Delivery mode">
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { value: 'in_person', label: '📍 In-person' },
                { value: 'online', label: '💻 Online' },
                { value: 'hybrid', label: '🔀 Hybrid' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update('deliveryMode', opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${form.deliveryMode === opt.value ? '#085041' : '#e2e2e2'}`,
                    borderRadius: '8px',
                    backgroundColor: form.deliveryMode === opt.value ? '#e8f5ee' : 'white',
                    color: form.deliveryMode === opt.value ? '#085041' : '#444',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: form.deliveryMode === opt.value ? 600 : 400
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {(form.deliveryMode === 'in_person' || form.deliveryMode === 'hybrid') && (
            <>
              <Field label="Location name">
                <Input
                  placeholder="e.g. Studio 1"
                  value={form.locationName}
                  onChange={e => update('locationName', e.target.value)}
                />
              </Field>
              <Field label="Address">
                <Input
                  placeholder="e.g. 123 Beach Road, Bondi NSW 2026"
                  value={form.locationAddress}
                  onChange={e => update('locationAddress', e.target.value)}
                />
              </Field>
              <Field label="In-person capacity">
                <Input
                  type="number"
                  min="1"
                  placeholder="12"
                  value={form.capacityInperson}
                  onChange={e => update('capacityInperson', e.target.value)}
                />
              </Field>
            </>
          )}

          {(form.deliveryMode === 'online' || form.deliveryMode === 'hybrid') && (
            <Field label="Online capacity" hint="Leave blank for unlimited">
              <Input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={form.capacityOnline}
                onChange={e => update('capacityOnline', e.target.value)}
              />
            </Field>
          )}

          {/* Schedule */}
          <SectionHeader title="Schedule" description="When does this session run?" />

          <Field label="First occurrence" hint="The date and time of the first bookable class. For a recurring session, later dates are generated from this same time.">
            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 140px', gap: '16px' }}>
              <Input
                type="date"
                value={form.firstOccurrenceDate}
                onChange={e => update('firstOccurrenceDate', e.target.value)}
              />
              <Input
                type="time"
                value={form.firstOccurrenceTime}
                onChange={e => update('firstOccurrenceTime', e.target.value)}
              />
            </div>
          </Field>

          <Field label="Recurrence">
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {[
                { value: false, label: 'One-off' },
                { value: true, label: 'Recurring' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => update('isRecurring', opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${form.isRecurring === opt.value ? '#085041' : '#e2e2e2'}`,
                    borderRadius: '8px',
                    backgroundColor: form.isRecurring === opt.value ? '#e8f5ee' : 'white',
                    color: form.isRecurring === opt.value ? '#085041' : '#444',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: form.isRecurring === opt.value ? 600 : 400
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {form.isRecurring && (
              <div>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>Repeats every week on:</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {days.map(day => (
                    <button
                      key={day.code}
                      onClick={() => toggleDay(day.code)}
                      style={{
                        width: '44px',
                        height: '44px',
                        border: `2px solid ${form.recurrenceDays.includes(day.code) ? '#085041' : '#e2e2e2'}`,
                        borderRadius: '8px',
                        backgroundColor: form.recurrenceDays.includes(day.code) ? '#085041' : 'white',
                        color: form.recurrenceDays.includes(day.code) ? 'white' : '#444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: '13px', color: '#666', margin: '16px 0 10px' }}>Ends</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { value: 'never', label: 'Never' },
                    { value: 'date', label: 'On date' },
                    { value: 'count', label: 'After N classes' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update('recurrenceEndMode', opt.value)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: `2px solid ${form.recurrenceEndMode === opt.value ? '#085041' : '#e2e2e2'}`,
                        borderRadius: '8px',
                        backgroundColor: form.recurrenceEndMode === opt.value ? '#e8f5ee' : 'white',
                        color: form.recurrenceEndMode === opt.value ? '#085041' : '#444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: form.recurrenceEndMode === opt.value ? 600 : 400
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.recurrenceEndMode === 'date' && (
                  <Input
                    type="date"
                    value={form.recurrenceEndDate}
                    onChange={e => update('recurrenceEndDate', e.target.value)}
                  />
                )}
                {form.recurrenceEndMode === 'count' && (
                  <Input
                    type="number"
                    min="1"
                    value={form.recurrenceCount}
                    onChange={e => update('recurrenceCount', e.target.value)}
                  />
                )}
                {form.recurrenceEndMode === 'never' && (
                  <p style={{ fontSize: '12px', color: '#666' }}>
                    Dates are generated up to 60 days ahead on a rolling basis — there's no need to set an end date for an ongoing class.
                  </p>
                )}
              </div>
            )}
          </Field>

          {/* Pricing */}
          <SectionHeader title="Pricing" description="Set your drop-in prices. You can add passes and memberships later." />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {(form.deliveryMode === 'in_person' || form.deliveryMode === 'hybrid') && (
              <Field label="In-person price (AUD)">
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="25.00"
                  value={form.priceInperson}
                  onChange={e => update('priceInperson', e.target.value)}
                />
              </Field>
            )}
            {(form.deliveryMode === 'online' || form.deliveryMode === 'hybrid') && (
              <Field label="Online price (AUD)">
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="20.00"
                  value={form.priceOnline}
                  onChange={e => update('priceOnline', e.target.value)}
                />
              </Field>
            )}
          </div>

          <Field label="Tax rate override (%)" hint="Leave blank to use the studio's current tax rate. Enter 0 to make this session tax-exempt.">
            <Input
              type="number"
              min="0"
              step="0.1"
              placeholder="No override"
              value={form.taxRateOverride}
              onChange={e => update('taxRateOverride', e.target.value)}
            />
          </Field>

          {/* Settings */}
          <SectionHeader title="Settings" />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Visibility">
              <Select value={form.visibility} onChange={e => update('visibility', e.target.value)}>
                <option value="public">Public — listed on booking page</option>
                <option value="private">Private — bookable via direct link only</option>
                <option value="draft">Draft — not visible anywhere</option>
              </Select>
            </Field>

            <Field label="Booking access">
              <Select value={form.bookingAccessMode} onChange={e => update('bookingAccessMode', e.target.value)}>
                <option value="open">Open — any pricing option</option>
                <option value="free">Free — no payment required</option>
                <option value="restricted">Restricted — specific passes only</option>
              </Select>
            </Field>
          </div>

          {form.bookingAccessMode === 'restricted' && (
            <Field label="Approved pricing options" hint="Only these passes (and optionally drop-in payment) can be used to book this session. Admin-initiated bookings bypass this list.">
              <div style={{ border: '1px solid #e2e2e2', borderRadius: '8px', padding: '0 14px' }}>
                {passTemplates.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#666', padding: '12px 0' }}>
                    No pass templates yet — create one on the Passes page first.
                  </p>
                ) : passTemplates.map((pt, i) => (
                  <label key={pt.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0',
                    borderBottom: i < passTemplates.length - 1 ? '1px solid #f4f4f4' : 'none',
                    fontSize: '13px', cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={form.approvedPassTemplateIds.includes(pt.id)}
                      onChange={() => togglePassTemplate(pt.id)}
                    />
                    {pt.name}
                  </label>
                ))}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0',
                  borderTop: '1px solid #f4f4f4', fontSize: '13px', cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={form.allowDropIn}
                    onChange={e => update('allowDropIn', e.target.checked)}
                  />
                  Allow drop-in payment
                </label>
              </div>
              {form.approvedPassTemplateIds.length === 0 && !form.allowDropIn && (
                <p style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '8px' }}>
                  Select at least one option — otherwise nobody can self-book this session.
                </p>
              )}
            </Field>
          )}

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Cancellation window (hours)" hint="How many hours before the session members can cancel">
              <Input
                type="number"
                min="0"
                placeholder="12"
                value={form.cancellationHours}
                onChange={e => update('cancellationHours', e.target.value)}
              />
            </Field>

            <Field label="Max guests per booking">
              <Select value={form.guestMaxPerBooking} onChange={e => update('guestMaxPerBooking', e.target.value)}>
                <option value="0">No guests</option>
                <option value="1">1 guest</option>
                <option value="2">2 guests</option>
                <option value="3">3 guests</option>
              </Select>
            </Field>
          </div>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Booking window (days)" hint="Max days ahead a member can book. Leave blank to use the studio default.">
              <Input
                type="number"
                min="0"
                placeholder="No override"
                value={form.bookingWindowDays}
                onChange={e => update('bookingWindowDays', e.target.value)}
              />
            </Field>

            <Field label="Minimum advance booking (hours)" hint="How close to the start time a booking can still be made. Leave blank to use the studio default.">
              <Input
                type="number"
                min="0"
                placeholder="No override"
                value={form.minAdvanceBookingHours}
                onChange={e => update('minAdvanceBookingHours', e.target.value)}
              />
            </Field>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fdecea',
              borderRadius: '8px',
              color: '#8b1a1a',
              fontSize: '14px',
              marginBottom: '24px'
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid #e2e2e2' }}>
            
              <a href="/dashboard/sessions"
              style={{
                padding: '10px 24px',
                border: '1px solid #e2e2e2',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#444',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              Cancel
            </a>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: '10px 24px',
                backgroundColor: loading ? '#9fd6b8' : '#085041',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}