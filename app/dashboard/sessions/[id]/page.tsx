'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, ImageIcon, Plus } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '../../../components/Sidebar'
import { canManageSessions, canCreateOccurrence, canManageOccurrences, canViewAuditLog } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { formatClock, formatShortDate, formatWhen } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { studioUrl } from '@/lib/seo'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Button, CapacityBar, Card, Chip, Segmented, cardStyle, controlStyle, smallCapsStyle } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import EntityActivity from '@/app/components/EntityActivity'
import CancelOccurrenceModal from '@/app/components/CancelOccurrenceModal'
import styles from '@/app/dashboard/dashboard.module.css'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: color.ink }}>{label}</label>
      {children}
      {hint && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: color.muted }}>{hint}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...controlStyle, padding: '0 12px', ...(props.type === 'number' ? tabularNums : {}) }} />
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...controlStyle, cursor: props.disabled ? 'not-allowed' : 'pointer' }}>{children}</select>
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...controlStyle, padding: '10px 12px', minHeight: 100, resize: 'vertical', lineHeight: 1.45 }} />
}

// Each form section is its own card (handoff §5 Session detail).
const sectionCard: React.CSSProperties = { ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: space.formGap }

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: color.ink }}>{title}</h2>
      {description && <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted }}>{description}</p>}
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
  booked?: number
  capacity?: number | null
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
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [orgSlug, setOrgSlug] = useState('')
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [justCreated, setJustCreated] = useState(false)
  const [showAddOccurrence, setShowAddOccurrence] = useState(false)
  const [occurrenceForm, setOccurrenceForm] = useState({ date: '', startTime: '', endTime: '' })
  const [addingOccurrence, setAddingOccurrence] = useState(false)
  const [occurrenceError, setOccurrenceError] = useState('')
  const [cancelOccurrenceId, setCancelOccurrenceId] = useState('')

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
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const t = ctx.token
      setToken(t)
      const org = ctx.org
      setOrgId(org.id)
      const myRoles: string[] = ctx.roles
      setRoles(myRoles)

      setTimeZone(org.timezone ?? null)
      setOrgSlug(org.slug ?? '')
      const api = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}`
      const auth = { headers: { Authorization: `Bearer ${t}` } }
      // One round of requests instead of five in a row: everything only needs the org id.
      const [res, teachersRes, passTemplatesRes, pricingAccessRes, occRes] = await Promise.all([
        fetch(`${api}/sessions/${sessionId}`, auth),
        canManageSessions(myRoles) ? fetch(`${api}/teachers`, auth) : Promise.resolve(null),
        canManageSessions(myRoles) ? fetch(`${api}/pass-templates`, auth) : Promise.resolve(null),
        fetch(`${api}/sessions/${sessionId}/pricing-access`, auth),
        fetch(`${api}/sessions/${sessionId}/occurrences`, auth),
      ])
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

      if (teachersRes?.ok) {
        const data = await teachersRes.json()
        setTeachers(data.map((x: any) => ({ id: x.id, name: displayName(x) })))
      }
      if (passTemplatesRes?.ok) {
        const data = await passTemplatesRes.json()
        setPassTemplates(data.map((x: any) => ({ id: x.id, name: x.name })))
      }
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

  const handleOccurrenceCancelled = async () => {
    setCancelOccurrenceId('')
    await reloadOccurrences()
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
          <div style={{ color: color.muted }}>Loading...</div>
        </div>
      </div>
    )
  }

  const nowMs = Date.now()
  const upcomingOcc = occurrences.filter(o => Date.parse(o.starts_at) >= nowMs)
  const pastOcc = occurrences.filter(o => Date.parse(o.starts_at) < nowMs).reverse()
  const nextOcc = upcomingOcc.find(o => o.status === 'scheduled')
  const sessionCapacity = form.capacity ? parseInt(form.capacity) : null
  const capOf = (o: Occurrence) => (o.capacity ?? sessionCapacity)
  const shownUpcoming = showAllUpcoming ? upcomingOcc : upcomingOcc.slice(0, 6)
  // Form date/time are browser-local (see toDateInputValue), so the summary reads them the same way.
  const firstStart = form.firstOccurrenceDate ? new Date(`${form.firstOccurrenceDate}T${form.firstOccurrenceTime}`) : null
  const firstTime = firstStart ? formatClock(firstStart) : ''
  const weekday = weekdayOf(form.firstOccurrenceDate)
  const scheduleSummary = !firstStart ? 'Not scheduled yet'
    : form.isRecurring ? `Every ${weekday} at ${firstTime}` : `${formatShortDate(firstStart)} at ${firstTime}`
  const scheduleChip = !firstStart ? null
    : `${form.isRecurring ? `Every ${weekday.slice(0, 3)}` : formatShortDate(firstStart)} · ${firstTime} · ${form.durationMinutes} min`
  const teacherName = teachers.find(t => t.id === form.instructorId)?.name
  const visibilityChip = form.visibility === 'public' ? { label: 'Public', tone: 'primary' as const }
    : form.visibility === 'draft' ? { label: 'Draft', tone: 'warn' as const } : { label: 'Private', tone: 'neutral' as const }

  const occurrenceRow = (o: Occurrence) => {
    const cap = capOf(o)
    const cancelled = o.status === 'cancelled'
    return (
      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: `1px solid ${color.divider}` }}>
        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, ...tabularNums, ...(cancelled ? { color: color.muted, textDecoration: 'line-through' } : {}) }}>
            {formatShortDate(o.starts_at, timeZone)}
            {cancelled && <Chip style={{ textDecoration: 'none' }}>Cancelled</Chip>}
          </span>
          <span style={{ fontSize: 13, color: color.muted, ...tabularNums }}>
            {formatClock(o.starts_at, timeZone)} – {formatClock(o.ends_at, timeZone)}
            {!cancelled && ` · ${o.booked ?? 0}${cap != null ? ` / ${cap}` : ''} booked`}
          </span>
        </span>
        <Link href={`/dashboard/occurrences/${o.id}`} className={ui.focusable}
          style={{ fontSize: 14, fontWeight: 600, color: color.primary, textDecoration: 'none', minHeight: 36, display: 'inline-flex', alignItems: 'center' }}>
          Roster
        </Link>
        {o.status === 'scheduled' && canManageOccurrences(roles) && (
          <button type="button" onClick={() => setCancelOccurrenceId(o.id)} aria-label={`Cancel the class on ${formatShortDate(o.starts_at, timeZone)}`}
            className={ui.focusable}
            style={{ background: 'none', border: 0, padding: '8px 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: color.dangerInk, cursor: 'pointer' }}>
            Cancel
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="sessions" roles={roles} />

      <div className={styles.main}>
        <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <Breadcrumb items={[{ label: 'Sessions', href: '/dashboard/sessions' }, { label: form.name || 'Session' }]} />

          {/* Header card */}
          <section style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 96, height: 96, borderRadius: radius.card, flex: 'none', overflow: 'hidden',
              background: color.primarySoft, color: color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {form.photoUrl
                ? <img src={form.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <ImageIcon size={32} strokeWidth={1.6} aria-label="No session photo" />}
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-admin-display), Georgia, serif', fontWeight: 400, fontSize: 40, lineHeight: 1.05, color: color.ink }}>
                {form.name || 'Session'}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Chip tone={visibilityChip.tone}>{visibilityChip.label}</Chip>
                {scheduleChip && <Chip>{scheduleChip}</Chip>}
                {form.deliveryMode === 'online' ? <Chip>Online</Chip> : form.locationName && <Chip>{form.locationName}</Chip>}
                {form.instructorId ? (teacherName && <Chip>{teacherName}</Chip>) : <Chip tone="warn">No teacher</Chip>}
                {form.bookingAccessMode === 'free' ? <Chip>Free</Chip>
                  : form.price && <Chip>{formatMoney(parseFloat(form.price), form.currency)} drop-in</Chip>}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {orgSlug && form.visibility === 'public' && (
                <Button href={studioUrl(orgSlug, '/schedule')} target="_blank" icon={<ExternalLink size={18} strokeWidth={1.8} aria-hidden />}>View booking page</Button>
              )}
              {canManageSessions(roles) && (
                <Button href={`/dashboard/sessions/new?copy=${sessionId}`} icon={<Copy size={18} strokeWidth={1.8} aria-hidden />}>Duplicate</Button>
              )}
            </div>
          </section>

          {!canManageSessions(roles) && (
            <div style={{ padding: '12px 16px', background: color.infoBg, borderRadius: radius.control, color: color.infoInk, fontSize: 15 }}>
              You can view this session, but only an admin can change its settings.
            </div>
          )}

          {justCreated && (
            <div role="status" style={{ padding: '12px 16px', background: color.primarySoft, borderRadius: radius.control, color: color.primaryInk, fontSize: 15 }}>
              {occurrences.length > 0
                ? `Session created. ${occurrences.length} class${occurrences.length === 1 ? '' : 'es'} scheduled and ready to take bookings.`
                : 'Session created. No dates fell within the booking horizon yet. Add a date to make it bookable.'}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.cardGap, alignItems: 'flex-start' }}>
          {/* Left: the session's settings, one card per section */}
          <div style={{
            flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space.cardGap,
            opacity: canManageSessions(roles) ? 1 : 0.7,
            pointerEvents: canManageSessions(roles) ? 'auto' : 'none'
          }}>

          <section style={sectionCard}>
          <SectionHeader title="Basics" />

          <Field label="Photo" hint="Shown on your booking page and in the schedule. Optional.">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '12px', backgroundColor: color.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: `1px solid ${color.border}`, flexShrink: 0
              }}>
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Session" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={24} strokeWidth={1.6} color={color.muted} aria-hidden />
                )}
              </div>
              <label style={{
                padding: '8px 16px', backgroundColor: color.bg, borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, color: color.ink2, cursor: uploadingPhoto ? 'not-allowed' : 'pointer'
              }}>
                {uploadingPhoto ? 'Uploading...' : form.photoUrl ? 'Replace photo' : 'Upload photo'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
              </label>
              {form.photoUrl && (
                <button
                  onClick={() => update('photoUrl', '')}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: color.dangerInk, cursor: 'pointer' }}
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

          <Field label="Teacher" hint="The class appears in this teacher's own schedule and bookings.">
            <Select value={form.instructorId} onChange={e => update('instructorId', e.target.value)}>
              <option value="">No teacher</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>

          </section>

          <section style={sectionCard}>
          <SectionHeader title="Where" />

          <Field label="Delivery">
            <Segmented
              label="Delivery"
              value={form.deliveryMode as 'in_person' | 'online'}
              onChange={v => update('deliveryMode', v)}
              options={[{ value: 'in_person', label: 'In person' }, { value: 'online', label: 'Online' }]}
            />
          </Field>

          {form.deliveryMode === 'in_person' && (
            <>
              <Field label="Venue">
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

          <Field label="Capacity" hint="Leave blank for unlimited.">
            <Input
              type="number"
              min="1"
              placeholder={form.deliveryMode === 'online' ? 'Unlimited' : '12'}
              value={form.capacity}
              onChange={e => update('capacity', e.target.value)}
            />
          </Field>

          </section>

          <section style={sectionCard}>
          <SectionHeader title="When" description={form.isRecurring && firstStart ? `${scheduleSummary}. Classes are created 60 days ahead automatically.` : scheduleSummary} />

          <Field
            label="First class"
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
            <Segmented
              label="Repeats"
              value={form.isRecurring ? 'weekly' : 'once'}
              onChange={v => update('isRecurring', v === 'weekly')}
              options={[{ value: 'once', label: 'One-off' }, { value: 'weekly', label: 'Weekly' }]}
            />
            {form.isRecurring && (
              <div>
                <p style={{ fontSize: '13px', color: color.muted, marginBottom: '10px' }}>
                  {form.firstOccurrenceDate
                    ? <>Repeats every week on <strong>{weekdayOf(form.firstOccurrenceDate)}</strong>, from the first occurrence date above.</>
                    : 'Repeats every week on the first occurrence’s weekday — set the first occurrence date above.'}
                </p>

                <p style={{ fontSize: 14, fontWeight: 600, color: color.ink, margin: '16px 0 6px' }}>Ends</p>
                <div style={{ marginBottom: 12 }}>
                  <Segmented
                    label="Ends"
                    value={form.recurrenceEndMode}
                    onChange={v => update('recurrenceEndMode', v)}
                    options={[{ value: 'never', label: 'Never' }, { value: 'date', label: 'On a date' }, { value: 'count', label: 'After a number of classes' }]}
                  />
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
                  <p style={{ fontSize: '12px', color: color.muted }}>
                    The first dates are created as soon as the session is saved, then kept extended to
                    60 days ahead automatically — there's no need to set an end date for an ongoing class.
                  </p>
                )}
              </div>
            )}
          </Field>

          </section>

          <section style={sectionCard}>
          <SectionHeader title="Price & who can book" />

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label={`Drop-in price (${form.currency})`}>
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

          <Field label="Tax rate (%)" hint="Leave blank for the studio's current rate. Enter 0 to make this class tax-exempt.">
            <Input
              type="number"
              min="0"
              step="0.1"
              placeholder="Studio default"
              value={form.taxRateOverride}
              onChange={e => update('taxRateOverride', e.target.value)}
            />
          </Field>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Visibility">
              <Segmented
                label="Visibility"
                value={form.visibility as 'public' | 'private' | 'draft'}
                onChange={v => update('visibility', v)}
                options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }, { value: 'draft', label: 'Draft' }]}
              />
            </Field>
            <Field label="Booking access">
              <Segmented
                label="Booking access"
                value={form.bookingAccessMode as 'open' | 'free' | 'restricted'}
                onChange={v => update('bookingAccessMode', v)}
                options={[{ value: 'open', label: 'Open' }, { value: 'free', label: 'Free' }, { value: 'restricted', label: 'Restricted' }]}
              />
            </Field>
          </div>

          {form.bookingAccessMode === 'restricted' && (
            canManageSessions(roles) ? (
              <Field label="Passes that can be used" hint="Bookings you add as admin skip this list.">
                <div style={{ border: `1px solid ${color.border}`, borderRadius: '8px', padding: '0 14px' }}>
                  {passTemplates.length === 0 ? (
                    <p style={{ fontSize: '13px', color: color.muted, padding: '12px 0' }}>
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
                    Also allow drop-in payment
                  </label>
                </div>
                {form.approvedPassTemplateIds.length === 0 && !form.allowDropIn && (
                  <p style={{ fontSize: '12px', color: color.dangerInk, marginTop: '8px' }}>
                    Select at least one option — otherwise nobody can self-book this session.
                  </p>
                )}
              </Field>
            ) : (
              <Field label="Approved pricing options">
                <p style={{ fontSize: '13px', color: color.muted }}>
                  {pricingAccessRows.length === 0 ? 'No approved options configured yet.' : [
                    ...pricingAccessRows.filter(r => r.pass_template).map(r => r.pass_template!.name),
                    ...(pricingAccessRows.some(r => r.pricing_type === 'drop_in') ? ['Drop-in payment'] : []),
                  ].join(', ')}
                </p>
              </Field>
            )
          )}

          </section>

          <section style={sectionCard}>
          <SectionHeader title="Booking rules" description="Leave blank to use your studio defaults." />
          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Cancellation window (hours)">
              <Input
                type="number"
                min="0"
                value={form.cancellationHours}
                onChange={e => update('cancellationHours', e.target.value)}
              />
            </Field>
            <Field label="Guests per booking">
              <Select value={form.guestMaxPerBooking} onChange={e => update('guestMaxPerBooking', e.target.value)}>
                <option value="0">No guests</option>
                <option value="1">1 guest</option>
                <option value="2">2 guests</option>
                <option value="3">3 guests</option>
              </Select>
            </Field>
          </div>

          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Book up to (days ahead)" hint="How far ahead members can book.">
              <Input
                type="number"
                min="0"
                placeholder="Studio default"
                value={form.bookingWindowDays}
                onChange={e => update('bookingWindowDays', e.target.value)}
              />
            </Field>

            <Field label="Booking closes (hours before)" hint="How close to the start a booking can still be made.">
              <Input
                type="number"
                min="0"
                placeholder="Studio default"
                value={form.minAdvanceBookingHours}
                onChange={e => update('minAdvanceBookingHours', e.target.value)}
              />
            </Field>
          </div>

          </section>

          {error && (
            <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>
              {error}
            </div>
          )}

          {canManageSessions(roles) && (
            <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px' }}>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete session'}</Button>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Button href="/dashboard/sessions">Discard</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </div>
          )}
          </div>

          {/* Right: next class, upcoming classes, change history */}
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <section aria-label="Next class" style={{ ...cardStyle, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: '#F4F9F6', borderColor: '#CFE2D8' }}>
              <span style={smallCapsStyle}>Next class</span>
              {nextOcc ? (
                <>
                  <span style={{ fontSize: 22, fontWeight: 600, ...tabularNums }}>{formatWhen(nextOcc.starts_at, timeZone)}</span>
                  <CapacityBar booked={nextOcc.booked ?? 0} capacity={capOf(nextOcc)} width={180} layout="inline" />
                  <Button variant="primary" href={`/dashboard/occurrences/${nextOcc.id}`}>Open roster</Button>
                </>
              ) : (
                <span style={{ fontSize: 15, color: color.ink2 }}>No upcoming classes.</span>
              )}
            </section>

            <Card style={{ overflow: 'hidden' }} aria-labelledby="upcoming-heading">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 18px 12px' }}>
                <h2 id="upcoming-heading" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Upcoming classes</h2>
                {canCreateOccurrence(roles) && (
                  <Button size="sm" onClick={openAddOccurrence} icon={<Plus size={16} strokeWidth={2} aria-hidden />}>Add a date</Button>
                )}
              </div>
              {upcomingOcc.length === 0 ? (
                <p style={{ margin: 0, padding: '12px 18px 18px', fontSize: 15, color: color.muted }}>
                  No upcoming classes. Add a date to make this session bookable.
                </p>
              ) : shownUpcoming.map(occurrenceRow)}
              {(upcomingOcc.length > 6 || pastOcc.length > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 18px', borderTop: `1px solid ${color.divider}`, fontSize: 14 }}>
                  {upcomingOcc.length > 6 ? (
                    <button type="button" onClick={() => setShowAllUpcoming(v => !v)} className={ui.focusable}
                      style={{ background: 'none', border: 0, padding: '6px 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: color.primary, cursor: 'pointer' }}>
                      {showAllUpcoming ? 'Show fewer' : `Show all ${upcomingOcc.length}`}
                    </button>
                  ) : <span />}
                  {pastOcc.length > 0 && (
                    <button type="button" onClick={() => setShowPast(v => !v)} aria-expanded={showPast} className={ui.focusable}
                      style={{ background: 'none', border: 0, padding: '6px 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: color.muted, cursor: 'pointer' }}>
                      Past classes ({pastOcc.length})
                    </button>
                  )}
                </div>
              )}
              {showPast && pastOcc.map(occurrenceRow)}
            </Card>

            {canViewAuditLog(roles) && orgId && token && (
              <EntityActivity orgId={orgId} token={token} entityType="session" entityId={sessionId} noun="session" timeZone={timeZone} />
            )}
          </div>
          </div>
        </div>
      </div>

      {cancelOccurrenceId && (
        <CancelOccurrenceModal
          occurrenceId={cancelOccurrenceId}
          orgId={orgId}
          token={token}
          onClose={() => setCancelOccurrenceId('')}
          onCancelled={handleOccurrenceCancelled}
        />
      )}

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
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: color.muted }}
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
              <p style={{ fontSize: '12px', color: color.muted, marginTop: '-8px' }}>
                Capacity and price default to this session's settings unless overridden later.
              </p>

              {occurrenceError && (
                <div style={{ padding: '12px', backgroundColor: color.dangerBg, borderRadius: '8px', color: color.dangerInk, fontSize: '13px' }}>
                  {occurrenceError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setShowAddOccurrence(false)}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: 'transparent', border: `1px solid ${color.border}`,
                    borderRadius: '8px', fontSize: '14px', cursor: 'pointer', color: color.ink2
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddOccurrence}
                  disabled={addingOccurrence}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: addingOccurrence ? '#9fd6b8' : color.primary, color: 'white',
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
              <p style={{ fontSize: '13px', color: color.muted, marginBottom: '12px' }}>
                This edit affects occurrences that already exist:
              </p>
              <ul style={{ fontSize: '14px', color: color.ink2, margin: '0 0 24px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    flex: 1, padding: '10px', backgroundColor: 'transparent', border: `1px solid ${color.border}`,
                    borderRadius: '8px', fontSize: '14px', cursor: 'pointer', color: color.ink2
                  }}
                >
                  Go back
                </button>
                <button
                  onClick={handleConfirmUpdate}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '10px',
                    backgroundColor: saving ? (destructive ? '#e79999' : '#9fd6b8') : (destructive ? color.dangerInk : color.primary),
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