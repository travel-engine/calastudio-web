'use client'

import { useBookingFlow, type BookableOccurrence } from '@/lib/store/bookingFlow'

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

  return (
    <button
      onClick={() => openOccurrence(studioSlug, occurrence, { brandColor, stripeAccountId, paymentsEnabled })}
      disabled={disabled}
      style={{
        padding: '8px 18px', backgroundColor: disabled ? '#f4f4f4' : (brandColor || '#085041'),
        color: disabled ? '#999' : 'white', border: 'none', borderRadius: '8px',
        fontSize: '13px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
      }}
    >
      {label}
    </button>
  )
}
