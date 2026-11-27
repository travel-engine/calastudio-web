'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BLACK_FRIDAY } from './pricing'

// Black Friday 2026 offer (user, 27 Nov): studios that sign up by 11:59 pm Mon 30 Nov Brisbane time
// get 6 months free, then Pay as you go at 1%, locked in for life. The API decides who gets it (by
// sign-up time) and says whether it's open: GET /api/public/platform-offer → {ends_at, …} or 404
// once closed. The banner shows only while the API says open AND before ends_at (rechecked each
// minute), so a cached page never advertises a closed offer. Rendered after mount for that reason.

type Offer = { code: string; ends_at: string; free_months: number; rate_after: number }

function useOpenOffer(): Offer | null {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let cancelled = false
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/platform-offer`)
      .then(r => (r.ok ? r.json() : null))
      .then((o: Offer | null) => { if (!cancelled) setOffer(o?.ends_at ? o : null) })
      .catch(() => { if (!cancelled) setOffer(null) })
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => { cancelled = true; window.clearInterval(t) }
  }, [])
  return offer && now < new Date(offer.ends_at).getTime() ? offer : null
}

export default function BlackFridayBanner({ variant }: { variant: 'bar' | 'card' }) {
  const offer = useOpenOffer()
  if (!offer) return null
  const months = offer.free_months || BLACK_FRIDAY.freeMonths
  const rate = Math.round((offer.rate_after ?? BLACK_FRIDAY.rateAfter / 100) * 1000) / 10

  if (variant === 'card') {
    return (
      <div role="note" style={{
        background: '#E2EEE9', color: '#0C3A2D', borderRadius: 10, padding: '12px 14px',
        fontSize: 14, lineHeight: 1.45, marginBottom: 20, textAlign: 'left',
      }}>
        <strong style={{ display: 'block', fontSize: 15, marginBottom: 2 }}>{`Black Friday: ${months} months free`}</strong>
        {`Sign up by ${BLACK_FRIDAY.endsLabel} and pay CalaStudio nothing for ${months} months. After that it’s just ${rate}% of bookings, locked in for life. Stripe’s card fees still apply.`}
      </div>
    )
  }

  return (
    <div role="note" style={{
      background: '#085041', color: '#FFFFFF', textAlign: 'center', padding: '10px 16px',
      fontSize: 15, lineHeight: 1.4,
    }}>
      <strong>Black Friday:</strong>{` sign up by ${BLACK_FRIDAY.endsLabel} and pay nothing for ${months} months, then just ${rate}%, locked in for life. `}
      <Link href="/register" style={{ color: '#FFFFFF', fontWeight: 700, textUnderlineOffset: 3, whiteSpace: 'nowrap' }}>
        Claim it →
      </Link>
    </div>
  )
}
