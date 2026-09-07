'use client'

import { useState } from 'react'
import { useBookingFlow, type BookableOccurrence } from '@/lib/store/bookingFlow'
import { useMemberSchedule } from '@/lib/store/memberSchedule'

const apiUrl = process.env.NEXT_PUBLIC_API_URL

export default function BookButton({ studioSlug, occurrence, disabled, label, brandColor, stripeAccountId, paymentsEnabled }: {
  studioSlug: string
  occurrence: BookableOccurrence
  disabled: boolean
  label: string
  brandColor?: string
  stripeAccountId: string | null
  paymentsEnabled: boolean
}) {
  const openOccurrence = useBookingFlow(s => s.openOccurrence)
  const booked = useMemberSchedule(s => s.byOccurrence[occurrence.occurrence_id])
  const orgId = useMemberSchedule(s => s.orgId)
  const accessToken = useMemberSchedule(s => s.accessToken)
  const removeBooking = useMemberSchedule(s => s.removeBooking)

  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const accent = brandColor || '#085041'

  // Already holding a confirmed booking for this class (and the studio hasn't cancelled the class
  // itself) — offer to cancel instead of book again.
  if (booked && !occurrence.is_cancelled && orgId && accessToken) {
    const handleCancel = async () => {
      if (cancelling) return
      if (!window.confirm('Cancel this booking? Depending on the studio’s policy this may forfeit a credit or incur a late fee.')) return
      setCancelling(true)
      setError('')
      try {
        const res = await fetch(
          `${apiUrl}/api/organisations/${orgId}/members/me/bookings/${booked.bookingId}/cancel`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (res.ok) {
          removeBooking(occurrence.occurrence_id)
        } else {
          const body = await res.json().catch(() => null)
          setError(body?.error ?? 'Could not cancel. Try again.')
        }
      } catch {
        setError('Could not reach the server.')
      } finally {
        setCancelling(false)
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '6px 12px', borderRadius: '8px', backgroundColor: '#e8f5ee',
          color: '#085041', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          ✓ Booked
        </span>
        {booked.canCancel ? (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: cancelling ? '#999' : '#8b1a1a', fontSize: '12px', fontWeight: 500,
              cursor: cancelling ? 'default' : 'pointer',
            }}
          >
            {cancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
        ) : (
          <span style={{ fontSize: '11px', color: '#999' }}>Cancellation window closed</span>
        )}
        {error && <span style={{ color: '#8b1a1a', fontSize: '11px', maxWidth: 160, textAlign: 'right' }}>{error}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => openOccurrence(studioSlug, occurrence, { brandColor, stripeAccountId, paymentsEnabled })}
      disabled={disabled}
      style={{
        padding: '8px 18px', backgroundColor: disabled ? '#f4f4f4' : accent,
        color: disabled ? '#999' : 'white', border: 'none', borderRadius: '8px',
        fontSize: '13px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
      }}
    >
      {label}
    </button>
  )
}
