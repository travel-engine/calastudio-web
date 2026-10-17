'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import { useSearchParams } from 'next/navigation'
import { canManageSessions } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { ImageIcon } from 'lucide-react'
import { color, radius, space } from '@/lib/ui/tokens'
import { Breadcrumb, Button, CheckRow, PageHeader, alertStyle, buttonStyle, cardStyle, FormField as Field, TextInput as Input,
  SelectInput as Select, TextArea as Textarea, FormSection as SectionHeader, ChoiceGroup as ToggleGroup } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

export default function NewSessionPage() {
  return (
    <Suspense fallback={
      <div className={styles.shell}>
        <Sidebar active="sessions" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
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
  const [roles, setRoles] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    sessionType: 'class',
    deliveryMode: 'in_person',
    locationName: '',
    locationAddress: '',
    onlineInstructions: '',
    capacity: '12',
    price: '',
    currency: 'AUD',
    durationMinutes: '60',
    firstOccurrenceDate: '',
    firstOccurrenceTime: '09:00',
    isRecurring: false,
    recurrenceRule: '',
    recurrenceEndMode: 'never' as 'never' | 'date' | 'count',
    recurrenceEndDate: '',
    recurrenceCount: '10',
    visibility: 'public',
    bookingAccessMode: 'open',
    cancellationHours: '', // blank = studio default (Settings → Booking policy)
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
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([])
  const [passTemplates, setPassTemplates] = useState<{ id: string; name: string }[]>([])
  const searchParams = useSearchParams()
  const copyId = searchParams.get('copy')

  useEffect(() => {
    const checkAccess = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const token = ctx.token
      const org = ctx.org
      const roles: string[] = ctx.roles
      setRoles(roles)
      // A new session is priced in the studio's currency (a copy keeps the source session's).
      if (!copyId) setForm(prev => ({ ...prev, currency: org.currency ?? prev.currency }))

      if (!canManageSessions(roles)) { router.push('/dashboard/sessions'); return }

      const teachersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/teachers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (teachersRes.ok) {
        const data = await teachersRes.json()
        setTeachers(data.map((t: any) => ({ id: t.id, name: displayName(t) })))
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
        onlineInstructions: s.online_instructions ?? '',
        capacity: s.capacity?.toString() ?? '12',
        price: s.price?.toString() ?? '',
        currency: s.currency ?? 'AUD',
        durationMinutes: s.duration_minutes?.toString() ?? '60',
        isRecurring: s.is_recurring ?? false,
        recurrenceRule: s.recurrence_rule ?? '',
        visibility: 'draft',
        bookingAccessMode: s.booking_access_mode ?? 'open',
        cancellationHours: s.cancellation_hours?.toString() ?? '',
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

  // Weekly recurrence repeats on the first occurrence's own weekday — no separate day picker.
  // A bare FREQ=WEEKLY (no BYDAY) makes the backend expand from the anchor's weekday.
  const buildRRule = () => (form.isRecurring ? 'RRULE:FREQ=WEEKLY' : '')

  const weekdayOf = (dateStr: string) =>
    dateStr ? new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' }) : ''

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
          online_instructions: form.deliveryMode === 'online' && form.onlineInstructions ? form.onlineInstructions : null,
          photo_url: form.photoUrl || null,
          capacity: form.capacity ? parseInt(form.capacity) : null,
          price: form.price ? parseFloat(form.price) : null,
          currency: form.currency,
          duration_minutes: parseInt(form.durationMinutes),
          first_occurrence_starts_at: firstOccurrenceStartsAt.toISOString(),
          is_recurring: form.isRecurring,
          recurrence_rule: buildRRule() || null,
          recurrence_end_date: form.isRecurring && form.recurrenceEndMode === 'date' && form.recurrenceEndDate ? form.recurrenceEndDate : null,
          recurrence_count: form.isRecurring && form.recurrenceEndMode === 'count' && form.recurrenceCount ? parseInt(form.recurrenceCount) : null,
          visibility: form.visibility,
          booking_access_mode: form.bookingAccessMode,
          cancellation_hours: form.cancellationHours !== '' ? parseInt(form.cancellationHours, 10) : null,
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
          // If this fails the session still exists — the detail screen shows the pricing-access
          // section for the admin to retry, so the redirect below is the same either way.
          await fetch(
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
        }

        // The backend generates this session's first batch of occurrences during create, so land
        // the admin on the session itself — ?created=1 triggers the "N occurrences scheduled" banner.
        router.push(`/dashboard/sessions/${created.id}?created=1`)
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

  if (checkingAccess) {
    return (
      <div className={styles.shell}>
        <Sidebar active="sessions" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  const hintText: React.CSSProperties = { margin: 0, fontSize: 14, color: color.muted, lineHeight: 1.45 }

  return (
    <div className={styles.shell}>
      <Sidebar active="sessions" roles={roles} />

      <div className={styles.main}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <Breadcrumb items={[{ label: 'Sessions', href: '/dashboard/sessions' }, { label: copyId ? 'Copy session' : 'New session' }]} />
          <PageHeader title={copyId ? 'Copy session' : 'New session'} />

          <div style={{ ...cardStyle, padding: '24px 28px' }}>

            <SectionHeader title="Basics" />

            <Field label="Photo" hint="Shown on your booking page and in the schedule. Optional.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: radius.control, background: color.primarySoft, color: color.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `1px solid ${color.border}`, flex: 'none',
                }}>
                  {form.photoUrl
                    ? <img src={form.photoUrl} alt="Session" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ImageIcon size={24} strokeWidth={1.6} aria-hidden />}
                </div>
                <label className={`${ui.button} ${ui.focusable}`} style={{ ...buttonStyle('secondary', 'sm'), position: 'relative', cursor: uploadingPhoto ? 'not-allowed' : 'pointer' }}>
                  {uploadingPhoto ? 'Uploading…' : form.photoUrl ? 'Replace photo' : 'Upload photo'}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                </label>
                {form.photoUrl && (
                  <button type="button" onClick={() => update('photoUrl', '')} className={ui.focusable}
                    style={{ background: 'none', border: 0, padding: '8px 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: color.dangerInk, cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
            </Field>

            <Field label="Session name">
              <Input placeholder="e.g. Morning Vinyasa" value={form.name} onChange={e => update('name', e.target.value)} />
            </Field>

            <Field label="Description" hint="Shown on your booking page. Optional.">
              <Textarea placeholder="Tell your students what to expect…" value={form.description} onChange={e => update('description', e.target.value)} />
            </Field>

            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
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

            <Field label="Instructor" hint="The class appears in this teacher's own schedule and bookings.">
              <Select value={form.instructorId} onChange={e => update('instructorId', e.target.value)}>
                <option value="">Unassigned</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>

            <SectionHeader title="Delivery" description="How will students attend this session?" />

            <Field label="Delivery mode">
              <ToggleGroup label="Delivery mode" value={form.deliveryMode} onChange={v => update('deliveryMode', v)}
                options={[{ value: 'in_person', label: 'In person' }, { value: 'online', label: 'Online' }]} />
            </Field>

            {form.deliveryMode === 'in_person' && (
              <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
                <Field label="Location name">
                  <Input placeholder="e.g. Studio 1" value={form.locationName} onChange={e => update('locationName', e.target.value)} />
                </Field>
                <Field label="Address">
                  <Input placeholder="e.g. 123 Beach Road, Bondi NSW 2026" value={form.locationAddress} onChange={e => update('locationAddress', e.target.value)} />
                </Field>
              </div>
            )}

            {form.deliveryMode === 'online' && (
              <Field label="Online instructions" hint="Shown to members when they book. Optional — e.g. what to have ready.">
                <Textarea placeholder="Please have a mat and 2kg weights ready. The meeting link is emailed 15 minutes before class."
                  value={form.onlineInstructions} onChange={e => update('onlineInstructions', e.target.value)} />
              </Field>
            )}

            <Field label="Capacity" hint="Leave blank for unlimited.">
              <Input type="number" min="1" placeholder={form.deliveryMode === 'online' ? 'Unlimited' : '12'} value={form.capacity}
                onChange={e => update('capacity', e.target.value)} style={{ maxWidth: 200 }} />
            </Field>

            <SectionHeader title="Schedule" description="When does this session run?" />

            <Field label="First occurrence" hint="The date and time of the first bookable class. For a weekly session, later dates are generated from this same time.">
              <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 160px', gap: 12 }}>
                <Input type="date" aria-label="First class date" value={form.firstOccurrenceDate} onChange={e => update('firstOccurrenceDate', e.target.value)} />
                <Input type="time" aria-label="First class start time" value={form.firstOccurrenceTime} onChange={e => update('firstOccurrenceTime', e.target.value)} />
              </div>
            </Field>

            <Field label="Recurrence">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ToggleGroup label="Recurrence" value={form.isRecurring ? 'weekly' : 'once'} onChange={v => update('isRecurring', v === 'weekly')}
                  options={[{ value: 'once', label: 'One-off' }, { value: 'weekly', label: 'Weekly' }]} />

                {form.isRecurring && (
                  <>
                    <p style={hintText}>
                      {form.firstOccurrenceDate
                        ? <>Repeats every week on <strong style={{ color: color.ink }}>{weekdayOf(form.firstOccurrenceDate)}</strong>, from the first occurrence date above.</>
                        : 'Repeats every week on the first occurrence’s weekday — set the first occurrence date above.'}
                    </p>
                    <span style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Ends</span>
                    <ToggleGroup label="Ends" value={form.recurrenceEndMode} onChange={v => update('recurrenceEndMode', v)}
                      options={[{ value: 'never', label: 'Never' }, { value: 'date', label: 'On date' }, { value: 'count', label: 'After N classes' }]} />
                    {form.recurrenceEndMode === 'date' && (
                      <Input type="date" aria-label="End date" value={form.recurrenceEndDate} onChange={e => update('recurrenceEndDate', e.target.value)} style={{ maxWidth: 240 }} />
                    )}
                    {form.recurrenceEndMode === 'count' && (
                      <Input type="number" min="1" aria-label="Number of classes" value={form.recurrenceCount} onChange={e => update('recurrenceCount', e.target.value)} style={{ maxWidth: 200 }} />
                    )}
                    {form.recurrenceEndMode === 'never' && (
                      <p style={hintText}>
                        The first dates are created as soon as you save this session, then kept extended to 60 days ahead
                        automatically — there&apos;s no need to set an end date for an ongoing class.
                      </p>
                    )}
                  </>
                )}
              </div>
            </Field>

            <SectionHeader title="Pricing" description="Set your drop-in price. You can add passes later." />

            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
              <Field label={`Drop-in price (${form.currency})`}>
                <Input type="number" min="0" step="0.50" placeholder="25.00" value={form.price} onChange={e => update('price', e.target.value)} />
              </Field>
              <Field label="Tax rate override (%)" hint="Leave blank to use the studio's current tax rate. Enter 0 to make this session tax-exempt.">
                <Input type="number" min="0" step="0.1" placeholder="No override" value={form.taxRateOverride} onChange={e => update('taxRateOverride', e.target.value)} />
              </Field>
            </div>

            <SectionHeader title="Who can book" />

            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
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
              <Field label="Approved pricing options" hint="Only these passes (and optionally drop-in payment) can be used to book this session. Bookings you add yourself skip this list.">
                <div>
                  <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, padding: '4px 14px' }}>
                    {passTemplates.length === 0 ? (
                      <p style={{ ...hintText, padding: '10px 0' }}>No pass types yet — create one on the Passes page first.</p>
                    ) : passTemplates.map((pt, i) => (
                      <div key={pt.id} style={{ borderBottom: i < passTemplates.length - 1 ? `1px solid ${color.divider}` : 'none' }}>
                        <CheckRow checked={form.approvedPassTemplateIds.includes(pt.id)} onChange={() => togglePassTemplate(pt.id)}>{pt.name}</CheckRow>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${color.divider}` }}>
                      <CheckRow checked={form.allowDropIn} onChange={v => update('allowDropIn', v)}>Allow drop-in payment</CheckRow>
                    </div>
                  </div>
                  {form.approvedPassTemplateIds.length === 0 && !form.allowDropIn && (
                    <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: color.dangerInk }}>
                      Select at least one option — otherwise nobody can self-book this session.
                    </p>
                  )}
                </div>
              </Field>
            )}

            <SectionHeader title="Booking rules" description="Leave a field blank to use your studio defaults from Settings." />

            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
              <Field label="Cancellation window (hours)" hint="Members can cancel free of charge up to this many hours before the class.">
                <Input type="number" min="0" placeholder="Studio default" value={form.cancellationHours} onChange={e => update('cancellationHours', e.target.value)} />
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

            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: space.formGap }}>
              <Field label="Booking window (days)" hint="How far ahead members can book.">
                <Input type="number" min="0" placeholder="Studio default" value={form.bookingWindowDays} onChange={e => update('bookingWindowDays', e.target.value)} />
              </Field>
              <Field label="Minimum advance booking (hours)" hint="How close to the start time a booking can still be made.">
                <Input type="number" min="0" placeholder="Studio default" value={form.minAdvanceBookingHours} onChange={e => update('minAdvanceBookingHours', e.target.value)} />
              </Field>
            </div>

            {error && <div role="alert" style={{ ...alertStyle(), marginBottom: space.formGap }}>{error}</div>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', paddingTop: 20, borderTop: `1px solid ${color.divider}` }}>
              <Button href="/dashboard/sessions">Cancel</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Creating…' : 'Create session'}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}