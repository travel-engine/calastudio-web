'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    isRecurring: false,
    recurrenceRule: '',
    recurrenceDays: [] as string[],
    visibility: 'public',
    bookingAccessMode: 'open',
    cancellationHours: '12',
    guestBookingsEnabled: true,
    guestMaxPerBooking: '1',
  })

  const update = (key: string, value: string | boolean | string[]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleDay = (day: string) => {
    const days = form.recurrenceDays.includes(day)
      ? form.recurrenceDays.filter(d => d !== day)
      : [...form.recurrenceDays, day]
    update('recurrenceDays', days)
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
          sessionType: form.sessionType,
          deliveryMode: form.deliveryMode,
          locationName: form.locationName || null,
          locationAddress: form.locationAddress || null,
          capacityInperson: form.capacityInperson ? parseInt(form.capacityInperson) : null,
          capacityOnline: form.capacityOnline ? parseInt(form.capacityOnline) : null,
          priceInperson: form.priceInperson ? parseFloat(form.priceInperson) : null,
          priceOnline: form.priceOnline ? parseFloat(form.priceOnline) : null,
          currency: form.currency,
          durationMinutes: parseInt(form.durationMinutes),
          isRecurring: form.isRecurring,
          recurrenceRule: buildRRule() || null,
          visibility: form.visibility,
          bookingAccessMode: form.bookingAccessMode,
          cancellationHours: parseInt(form.cancellationHours),
          guestBookingsEnabled: form.guestBookingsEnabled,
          guestMaxPerBooking: parseInt(form.guestMaxPerBooking),
        })
      })

      if (res.ok) {
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>

      {/* Sidebar */}
      <div style={{
        width: '240px',
        backgroundColor: 'white',
        borderRight: '1px solid #e2e2e2',
        padding: '24px 16px',
        position: 'fixed',
        height: '100vh'
      }}>
        <div style={{
          backgroundColor: '#085041',
          color: 'white',
          fontWeight: 700,
          fontSize: '16px',
          padding: '8px 16px',
          borderRadius: '8px',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          CalaStudio
        </div>
        <nav>
          {[
            { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
            { href: '/dashboard/sessions', icon: '📅', label: 'Sessions', active: true },
            { href: '/dashboard/members', icon: '👥', label: 'Members' },
            { href: '/dashboard/bookings', icon: '🎟', label: 'Bookings' },
            { href: '/dashboard/passes', icon: '💳', label: 'Passes' },
            { href: '/dashboard/memberships', icon: '⭐', label: 'Memberships' },
            { href: '/dashboard/reports', icon: '📊', label: 'Reports' },
            { href: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
          ].map(item => (
            
              <a key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: item.active ? '#e8f5ee' : 'transparent',
                color: item.active ? '#085041' : '#444',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: item.active ? 600 : 400,
                marginBottom: '2px'
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px', maxWidth: '800px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          
            <a href="/dashboard/sessions"
            style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}
          >
            ← Sessions
          </a>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>New session</h1>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>

          {/* Basics */}
          <SectionHeader title="Basics" />

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              </div>
            )}
          </Field>

          {/* Pricing */}
          <SectionHeader title="Pricing" description="Set your drop-in prices. You can add passes and memberships later." />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

          {/* Settings */}
          <SectionHeader title="Settings" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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