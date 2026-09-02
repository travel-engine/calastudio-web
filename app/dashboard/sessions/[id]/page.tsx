'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '../../../components/Sidebar'
import { canManageSessions, canCreateOccurrence, canManageOccurrences, canViewAuditLog } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { formatDateTimeWithWeekday } from '@/lib/dates'
import SessionActivity from '@/app/components/SessionActivity'
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

// Local-time <input type="date"/"time"> values from an ISO timestamp — same convention the
// occurrence modal below already uses (no server-side timezone conversion, browser-local throughout).
function toDateInputValue(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toTimeInputValue(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Occurrence {
  id: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'cancelled' | 'completed'
}

function OccurrenceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    scheduled: { bg: '#e8f5ee', color: '#085041', label: 'Scheduled' },
    cancelled: { bg: '#fdecea', color: '#8b1a1a', label: 'Cancelled' },
    completed: { bg: '#f4f4f4', color: '#666', label: 'Completed' },
  }
  const s = styles[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

export default function EditSessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])

  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [justCreated, setJustCreated] = useState(false)
  const [showAddOccurrence, setShowAddOccurrence] = useState(false)
  const [occurrenceForm, setOccurrenceForm] = useState({ date: '', startTime: '', endTime: '' })
  const [addingOccurrence, setAddingOccurrence] = useState(false)
  const [occurrenceError, setOccurrenceError] = useState('')
  const [cancellingId, setCancellingId] = useState('')

  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false)
  const [updateImpact, setUpdateImpact] = useState<{
    cancelOccurrences: number
    cancelBookings: number
    rescheduleOccurrences: number
    rescheduleBookings: number
    customLengthKept: number
    overCapacityOccurrences: number
  } | null>(null)

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
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([])
  const [passTemplates, setPassTemplates] = useState<{ id: string; name: string }[]>([])
  const [pricingAccessRows, setPricingAccessRows] = useState<{ pricing_type: string; pass_template: { id: string; name: string } | null }[]>([])

  const update = (key: string, value: string | boolean | string[]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const weekdayOf = (dateStr: string) =>
    dateStr ? new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' }) : ''

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
      const path = `sessions/${sessionId}-${Date.now()}.${ext}`

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

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions/${sessionId}`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      if (!res.ok) { router.push('/dashboard/sessions'); return }
      const s = await res.json()

      setForm({
        name: s.name ?? '',
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
        firstOccurrenceDate: s.first_occurrence_starts_at ? toDateInputValue(s.first_occurrence_starts_at) : '',
        firstOccurrenceTime: s.first_occurrence_starts_at ? toTimeInputValue(s.first_occurrence_starts_at) : '09:00',
        isRecurring: s.is_recurring ?? false,
        recurrenceEndMode: (s.recurrence_end_date ? 'date' : s.recurrence_count ? 'count' : 'never') as 'never' | 'date' | 'count',
        recurrenceEndDate: s.recurrence_end_date ?? '',
        recurrenceCount: s.recurrence_count?.toString() ?? '10',
        visibility: s.visibility ?? 'public',
        bookingAccessMode: s.booking_access_mode ?? 'open',
        cancellationHours: s.cancellation_hours?.toString() ?? '12',
        bookingWindowDays: s.booking_window_days?.toString() ?? '',
        minAdvanceBookingHours: s.min_advance_booking_hours?.toString() ?? '',
        taxRateOverride: s.tax_rate_override?.toString() ?? '',
        guestBookingsEnabled: s.guest_bookings_enabled ?? true,
        guestMaxPerBooking: s.guest_max_per_booking?.toString() ?? '1',
        instructorId: s.instructor_id ?? '',
        photoUrl: s.photo_url ?? '',
        approvedPassTemplateIds: [],
        allowDropIn: false,
      })

      if (canManageSessions(myRoles)) {
        const teachersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/teachers`, {
          headers: { Authorization: `Bearer ${t}` }
        })
        if (teachersRes.ok) {
          const data = await teachersRes.json()
          setTeachers(data.map((x: any) => ({ id: x.id, name: displayName(x) })))
        }

        const passTemplatesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/pass-templates`, {
          headers: { Authorization: `Bearer ${t}` }
        })
        if (passTemplatesRes.ok) {
          const data = await passTemplatesRes.json()
          setPassTemplates(data.map((x: any) => ({ id: x.id, name: x.name })))
        }
      }

      const pricingAccessRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions/${sessionId}/pricing-access`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      if (pricingAccessRes.ok) {
        const rows = await pricingAccessRes.json()
        setPricingAccessRows(rows)
        setForm(prev => ({
          ...prev,
          approvedPassTemplateIds: rows
            .filter((r: any) => r.pricing_type === 'pass_template')
            .map((r: any) => r.pass_template_id),
          allowDropIn: rows.some((r: any) => r.pricing_type === 'drop_in'),
        }))
      }

      const occRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions/${sessionId}/occurrences`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      if (occRes.ok) setOccurrences(await occRes.json())

      // Arrived straight from "New session" — the backend generated the first occurrences during
      // create. Show a one-time confirmation, then strip the flag so a refresh doesn't repeat it.
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('created') === '1') {
        setJustCreated(true)
        window.history.replaceState(null, '', window.location.pathname)
      }

      setLoading(false)
    }

    load()
  }, [sessionId, router])

  const reloadOccurrences = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/sessions/${sessionId}/occurrences`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res.ok) setOccurrences(await res.json())
  }

  const openAddOccurrence = () => {
    setOccurrenceError('')
    setOccurrenceForm({ date: '', startTime: '', endTime: '' })
    setShowAddOccurrence(true)
  }

  const handleStartTimeChange = (date: string, startTime: string) => {
    let endTime = occurrenceForm.endTime
    if (startTime) {
      const [h, m] = startTime.split(':').map(Number)
      const start = new Date(2000, 0, 1, h, m)
      start.setMinutes(start.getMinutes() + (parseInt(form.durationMinutes) || 60))
      endTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    }
    setOccurrenceForm({ date, startTime, endTime })
  }

  const handleAddOccurrence = async () => {
    if (!occurrenceForm.date || !occurrenceForm.startTime || !occurrenceForm.endTime) {
      setOccurrenceError('Date, start time, and end time are all required')
      return
    }

    const startsAt = new Date(`${occurrenceForm.date}T${occurrenceForm.startTime}`)
    const endsAt = new Date(`${occurrenceForm.date}T${occurrenceForm.endTime}`)
    if (endsAt <= startsAt) {
      setOccurrenceError('End time must be after the start time')
      return
    }

    setAddingOccurrence(true)
    setOccurrenceError('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/occurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          session_id: sessionId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          instructor_id: null,
          capacity: null,
          price: null,
          cancellation_hours: null,
          notes: null,
        })
      })

      if (res.ok) {
        setShowAddOccurrence(false)
        await reloadOccurrences()
      } else {
        const data = await res.json().catch(() => null)
        setOccurrenceError(data?.error ?? 'Could not create this occurrence.')
      }
    } catch {
      setOccurrenceError('Could not create this occurrence.')
    } finally {
      setAddingOccurrence(false)
    }
  }

  const handleCancelOccurrence = async (occurrenceId: string) => {
    if (!confirm('Cancel this occurrence? Every confirmed booking will be cancelled and any pass credits used will be returned.')) return

    setCancellingId(occurrenceId)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/occurrences/${occurrenceId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason: null })
        }
      )
      if (res.ok) {
        await reloadOccurrences()
      } else {
        alert('Could not cancel this occurrence.')
      }
    } finally {
      setCancellingId('')
    }
  }

  // Shared by the initial save attempt and the resubmit-after-confirmation below — the request
  // body is identical except for `confirm`, per UpdateSessionRequest in SessionEndpoints.cs.
  const buildSessionPatchBody = (confirm: boolean) => {
    const firstOccurrenceStartsAt = new Date(`${form.firstOccurrenceDate}T${form.firstOccurrenceTime}`)
    return {
      name: form.name,
      description: form.description || null,
      location_name: form.locationName || null,
      location_address: form.locationAddress || null,
      online_instructions: form.deliveryMode === 'online' ? (form.onlineInstructions || null) : null,
      photo_url: form.photoUrl || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      price: form.price ? parseFloat(form.price) : null,
      visibility: form.visibility,
      booking_access_mode: form.bookingAccessMode,
      delivery_mode: form.deliveryMode,
      duration_minutes: parseInt(form.durationMinutes),
      first_occurrence_starts_at: firstOccurrenceStartsAt.toISOString(),
      is_recurring: form.isRecurring,
      // Weekly recurrence repeats on the first occurrence's own weekday — bare FREQ=WEEKLY, no BYDAY.
      recurrence_rule: form.isRecurring ? 'RRULE:FREQ=WEEKLY' : null,
      recurrence_end_date: form.isRecurring && form.recurrenceEndMode === 'date' && form.recurrenceEndDate ? form.recurrenceEndDate : null,
      recurrence_count: form.isRecurring && form.recurrenceEndMode === 'count' && form.recurrenceCount ? parseInt(form.recurrenceCount) : null,
      cancellation_hours: parseInt(form.cancellationHours),
      booking_window_days: form.bookingWindowDays ? parseInt(form.bookingWindowDays) : null,
      min_advance_booking_hours: form.minAdvanceBookingHours ? parseInt(form.minAdvanceBookingHours) : null,
      tax_rate_override: form.taxRateOverride ? parseFloat(form.taxRateOverride) : null,
      guest_bookings_enabled: form.guestBookingsEnabled,
      guest_max_per_booking: parseInt(form.guestMaxPerBooking),
      instructor_id: form.instructorId || null,
      confirm,
    }
  }

  const submitSessionPatch = async (confirm: boolean) => {
    setSaving(true)
    setError('')

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/sessions/${sessionId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(buildSessionPatchBody(confirm))
        }
      )

      if (res.ok) {
        if (form.bookingAccessMode === 'restricted') {
          const paRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/sessions/${sessionId}/pricing-access`,
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
            setError('Session saved, but the approved pricing options could not be saved. Please try again.')
            setSaving(false)
            return
          }
        }
        router.push('/dashboard/sessions')
        return
      }

      // Some session edits change occurrences that already exist and need an explicit confirm
      // (§2.7–2.8). The 409 impact object lists every effect at once — cancellations, reschedules,
      // custom-length dates left alone, and dates now over capacity — so the dialog can spell them
      // all out. Resubmitting with confirm=true applies the lot.
      const data = await res.json().catch(() => null)

      if (res.status === 409 && data?.error === 'confirmation_required') {
        setUpdateImpact({
          cancelOccurrences: data.cancel_occurrences ?? 0,
          cancelBookings: data.cancel_bookings ?? 0,
          rescheduleOccurrences: data.reschedule_occurrences ?? 0,
          rescheduleBookings: data.reschedule_bookings ?? 0,
          customLengthKept: data.custom_length_kept ?? 0,
          overCapacityOccurrences: data.over_capacity_occurrences ?? 0,
        })
        setShowUpdateConfirm(true)
        return
      }

      // A 400 carries a specific reason (e.g. "the recurrence's day/frequency pattern is locked") —
      // show it rather than a generic failure.
      setError(typeof data?.error === 'string' ? data.error : 'Failed to save. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (!form.name.trim()) { setError('Session name is required'); return }
    if (!form.firstOccurrenceDate) { setError('First occurrence date is required'); return }
    submitSessionPatch(false)
  }

  const handleConfirmUpdate = () => {
    setShowUpdateConfirm(false)
    submitSessionPatch(true)
  }

  const handleCancelUpdate = () => {
    setShowUpdateConfirm(false)
    setUpdateImpact(null)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) return
    setDeleting(true)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (res.ok) {
        router.push('/dashboard/sessions')
      } else {
        setError('Failed to delete. Please try again.')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
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
      <Sidebar active="sessions" roles={roles} />

      <div className={styles.main} style={{ maxWidth: '800px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/dashboard/sessions" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
              ← Sessions
            </a>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{canManageSessions(roles) ? 'Edit session' : 'Session'}</h1>
          </div>
          {canManageSessions(roles) && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px solid #fdecea',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#8b1a1a',
                cursor: 'pointer'
              }}
            >
              {deleting ? 'Deleting...' : 'Delete session'}
            </button>
          )}
        </div>

        {!canManageSessions(roles) && (
          <div style={{
            padding: '12px 16px', backgroundColor: '#e8eef8', borderRadius: '8px',
            color: '#1B4F8A', fontSize: '13px', marginBottom: '16px'
          }}>
            You can view this session, but only an admin can change its settings.
          </div>
        )}

        {justCreated && (
          <div style={{
            padding: '12px 16px', backgroundColor: '#e8f5ee', borderRadius: '8px',
            color: '#085041', fontSize: '13px', marginBottom: '16px'
          }}>
            {occurrences.length > 0
              ? `Session created. ${occurrences.length} occurrence${occurrences.length === 1 ? '' : 's'} scheduled and ready to take bookings — see the list below.`
              : 'Session created. No dates fell within the booking horizon yet — add an occurrence below to make it bookable.'}
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          opacity: canManageSessions(roles) ? 1 : 0.7,
          pointerEvents: canManageSessions(roles) ? 'auto' : 'none'
        }}>

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

          <Field label="Description">
            <Textarea
              placeholder="Tell your students what to expect..."
              value={form.description}
              onChange={e => update('description', e.target.value)}
            />
          </Field>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Session type">
              <Select value={form.sessionType} onChange={e => update('sessionType', e.target.value)} disabled>
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
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>

          <SectionHeader title="Delivery" />

          <Field label="Delivery mode">
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { value: 'in_person', label: '📍 In-person' },
                { value: 'online', label: '💻 Online' },
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

          {form.deliveryMode === 'in_person' && (
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
            </>
          )}

          {form.deliveryMode === 'online' && (
            <Field label="Online instructions" hint="Shown to members when they book. Optional.">
              <Textarea
                placeholder="Please have a mat and 2kg weights ready. The meeting link is emailed 15 minutes before class."
                value={form.onlineInstructions}
                onChange={e => update('onlineInstructions', e.target.value)}
              />
            </Field>
          )}

          <Field label="Capacity" hint="Leave blank for unlimited">
            <Input
              type="number"
              min="1"
              placeholder={form.deliveryMode === 'online' ? 'Unlimited' : '12'}
              value={form.capacity}
              onChange={e => update('capacity', e.target.value)}
            />
          </Field>

          <SectionHeader title="Schedule" />

          <Field
            label="First occurrence"
            hint={form.isRecurring
              ? "Anchor for the weekly series. Changing only the time re-times every upcoming class; the weekday can't move once classes exist."
              : "The date and time of the bookable class."}
          >
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
                { value: true, label: 'Weekly' },
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
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                  {form.firstOccurrenceDate
                    ? <>Repeats every week on <strong>{weekdayOf(form.firstOccurrenceDate)}</strong>, from the first occurrence date above.</>
                    : 'Repeats every week on the first occurrence’s weekday — set the first occurrence date above.'}
                </p>

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
                    The first dates are created as soon as the session is saved, then kept extended to
                    60 days ahead automatically — there's no need to set an end date for an ongoing class.
                  </p>
                )}
              </div>
            )}
          </Field>

          <SectionHeader title="Pricing" />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Drop-in price (AUD)">
              <Input
                type="number"
                min="0"
                step="0.50"
                placeholder="25.00"
                value={form.price}
                onChange={e => update('price', e.target.value)}
              />
            </Field>
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

          <SectionHeader title="Settings" />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Visibility">
              <Select value={form.visibility} onChange={e => update('visibility', e.target.value)}>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="draft">Draft</option>
              </Select>
            </Field>
            <Field label="Booking access">
              <Select value={form.bookingAccessMode} onChange={e => update('bookingAccessMode', e.target.value)}>
                <option value="open">Open</option>
                <option value="free">Free</option>
                <option value="restricted">Restricted</option>
              </Select>
            </Field>
          </div>

          {form.bookingAccessMode === 'restricted' && (
            canManageSessions(roles) ? (
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
            ) : (
              <Field label="Approved pricing options">
                <p style={{ fontSize: '13px', color: '#666' }}>
                  {pricingAccessRows.length === 0 ? 'No approved options configured yet.' : [
                    ...pricingAccessRows.filter(r => r.pass_template).map(r => r.pass_template!.name),
                    ...(pricingAccessRows.some(r => r.pricing_type === 'drop_in') ? ['Drop-in payment'] : []),
                  ].join(', ')}
                </p>
              </Field>
            )
          )}

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Cancellation window (hours)">
              <Input
                type="number"
                min="0"
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
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            paddingTop: '24px',
            borderTop: '1px solid #e2e2e2'
          }}>
            
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

        {/* Occurrences */}
        <div style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 600 }}>Occurrences</h2>
              <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                Bookable dates and times for this session. Created from the schedule above when the session is saved, and kept extended to 60 days ahead automatically — add one manually below for a one-off extra date outside the usual pattern.
              </p>
            </div>
            {canCreateOccurrence(roles) && (
              <button
                onClick={openAddOccurrence}
                style={{
                  padding: '8px 16px', backgroundColor: '#085041', color: 'white', border: 'none',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                + Add occurrence
              </button>
            )}
          </div>

          {occurrences.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>No occurrences yet — the schedule above produced no dates within the booking horizon. Add one below to make this session bookable.</p>
          ) : (
            <div>
              {occurrences.map((occ, i) => (
                <div key={occ.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: i < occurrences.length - 1 ? '1px solid #f4f4f4' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '13px' }}>
                      {formatDateTimeWithWeekday(occ.starts_at)}
                      {' – '}
                      {new Date(occ.ends_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    <OccurrenceStatusBadge status={occ.status} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a href={`/dashboard/bookings?occurrence=${occ.id}`} style={{
                      padding: '6px 12px', backgroundColor: '#f4f4f4', borderRadius: '6px',
                      fontSize: '12px', color: '#444', textDecoration: 'none', fontWeight: 500
                    }}>
                      Manage roster
                    </a>
                    {occ.status === 'scheduled' && canManageOccurrences(roles) && (
                      <button
                        onClick={() => handleCancelOccurrence(occ.id)}
                        disabled={cancellingId === occ.id}
                        style={{
                          padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #fdecea',
                          borderRadius: '6px', fontSize: '12px', color: '#8b1a1a',
                          cursor: cancellingId === occ.id ? 'not-allowed' : 'pointer', fontWeight: 500
                        }}
                      >
                        {cancellingId === occ.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canViewAuditLog(roles) && orgId && token && (
          <SessionActivity orgId={orgId} token={token} sessionId={sessionId} />
        )}
      </div>

      {/* Add occurrence modal */}
      {showAddOccurrence && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
            maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Add occurrence</h2>
              <button
                onClick={() => setShowAddOccurrence(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="Date">
                <Input
                  type="date"
                  value={occurrenceForm.date}
                  onChange={e => setOccurrenceForm(p => ({ ...p, date: e.target.value }))}
                />
              </Field>
              <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="Start time">
                  <Input
                    type="time"
                    value={occurrenceForm.startTime}
                    onChange={e => handleStartTimeChange(occurrenceForm.date, e.target.value)}
                  />
                </Field>
                <Field label="End time">
                  <Input
                    type="time"
                    value={occurrenceForm.endTime}
                    onChange={e => setOccurrenceForm(p => ({ ...p, endTime: e.target.value }))}
                  />
                </Field>
              </div>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '-8px' }}>
                Capacity and price default to this session's settings unless overridden later.
              </p>

              {occurrenceError && (
                <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                  {occurrenceError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setShowAddOccurrence(false)}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                    borderRadius: '8px', fontSize: '14px', cursor: 'pointer', color: '#444'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddOccurrence}
                  disabled={addingOccurrence}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: addingOccurrence ? '#9fd6b8' : '#085041', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                    cursor: addingOccurrence ? 'not-allowed' : 'pointer'
                  }}
                >
                  {addingOccurrence ? 'Adding...' : 'Add occurrence'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session-change confirmation modal */}
      {showUpdateConfirm && updateImpact && (() => {
        const i = updateImpact
        const n = (x: number) => x === 1 ? '' : 's'
        const destructive = i.cancelOccurrences > 0
        return (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
              maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                {destructive ? 'Confirm session changes' : 'Review before saving'}
              </h2>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                This edit affects occurrences that already exist:
              </p>
              <ul style={{ fontSize: '14px', color: '#444', margin: '0 0 24px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {i.cancelOccurrences > 0 && (
                  <li>
                    <strong>{i.cancelOccurrences}</strong> upcoming occurrence{n(i.cancelOccurrences)} will be <strong>cancelled</strong>
                    {i.cancelBookings > 0 && <>, including {i.cancelBookings} confirmed booking{n(i.cancelBookings)}</>}.
                    Any pass credits are returned automatically.
                  </li>
                )}
                {i.rescheduleOccurrences > 0 && (
                  <li>
                    <strong>{i.rescheduleOccurrences}</strong> upcoming occurrence{n(i.rescheduleOccurrences)} will <strong>move</strong> to the new time/length
                    {i.rescheduleBookings > 0 && <>; {i.rescheduleBookings} confirmed booking{n(i.rescheduleBookings)} kept and those members notified</>}.
                  </li>
                )}
                {i.customLengthKept > 0 && (
                  <li>
                    <strong>{i.customLengthKept}</strong> occurrence{n(i.customLengthKept)} with a hand-set length will <strong>keep</strong> that length — the new duration isn’t applied to {i.customLengthKept === 1 ? 'it' : 'them'}.
                  </li>
                )}
                {i.overCapacityOccurrences > 0 && (
                  <li>
                    <strong>{i.overCapacityOccurrences}</strong> upcoming occurrence{n(i.overCapacityOccurrences)} currently {i.overCapacityOccurrences === 1 ? 'has' : 'have'} more bookings than the new capacity. No one is removed — {i.overCapacityOccurrences === 1 ? 'it stays' : 'they stay'} over capacity until bookings drop.
                  </li>
                )}
              </ul>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleCancelUpdate}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                    borderRadius: '8px', fontSize: '14px', cursor: 'pointer', color: '#444'
                  }}
                >
                  Go back
                </button>
                <button
                  onClick={handleConfirmUpdate}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '10px',
                    backgroundColor: saving ? (destructive ? '#e79999' : '#9fd6b8') : (destructive ? '#8b1a1a' : '#085041'),
                    color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : destructive ? 'Confirm and save' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}