import Image from 'next/image'
import type { BookableOccurrence } from '@/lib/store/bookingFlow'
import { formatFriendlyDay, formatTime } from '@/lib/dates'
import RowBookButton from './RowBookButton'
import HideWhenFinished from './HideWhenFinished'
import EarlyBirdPrice from './EarlyBirdPrice'
import styles from './photofirst.module.css'

function durationLabel(startIso: string, endIso: string) {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  if (mins <= 0) return null
  if (mins >= 60 && mins % 60 === 0) return `${mins / 60} hr`
  return `${mins} min`
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

function spots(occ: BookableOccurrence): { text: string; cls: string } | null {
  if (occ.is_cancelled) return { text: 'Cancelled', cls: styles.rowSpotsFull }
  if (occ.spots_remaining === null) return null
  const n = occ.spots_remaining
  if (n <= 0) return { text: 'Full', cls: styles.rowSpotsFull }
  if (n <= 3) return { text: `Only ${n} left`, cls: styles.rowSpotsLow }
  // Plenty of room: say nothing, so the classes that are nearly full stand out.
  return null
}

// One class/workshop row — handoff §"Session row". `showLocation` adds the location line (schedule
// screen only). The meta line is `{day}, {time} · {duration}`, plus `· Online` for online classes
// (in-person is the norm, so it isn't labelled). Under a day heading, `showDay={false}` drops the day.
export default function SessionRow({
  occ, studioSlug, showLocation = false, showDay = true, brandColor, stripeAccountId, paymentsEnabled, timeZone,
}: {
  occ: BookableOccurrence
  studioSlug: string
  showLocation?: boolean
  showDay?: boolean
  brandColor?: string
  stripeAccountId: string | null
  paymentsEnabled: boolean
  // Studio IANA zone; class times are shown on the studio's clock, not the server's or visitor's.
  timeZone?: string | null
}) {
  const thumb = occ.photo_url ?? occ.instructor_photo_url
  const duration = durationLabel(occ.starts_at, occ.ends_at)
  const mode = occ.delivery_mode === 'online' ? 'Online' : null
  const when = showDay
    ? `${formatFriendlyDay(occ.starts_at, timeZone)}, ${formatTime(occ.starts_at, timeZone)}`
    : formatTime(occ.starts_at, timeZone)
  const meta = [when, duration, mode].filter(Boolean).join(' · ')
  const s = spots(occ)

  return (
    <HideWhenFinished endsAt={occ.ends_at}>
    <article className={styles.row}>
      {thumb ? (
        <Image src={thumb} alt={occ.session_name} width={64} height={64} className={styles.rowThumb} />
      ) : (
        <div className={styles.rowThumb} aria-hidden />
      )}

      <div className={styles.rowMain}>
        <div className={styles.rowName}>{occ.session_name}</div>
        <div className={styles.rowMeta}>{meta}</div>
        {showLocation && occ.location_name && <div className={styles.rowLoc}>{occ.location_name}</div>}
      </div>

      <div className={styles.rowRight}>
        <div className={styles.rowRightText}>
          {s && <div className={`${styles.rowSpots} ${s.cls}`}>{s.text}</div>}
          {occ.price != null && <div className={styles.rowPrice}><EarlyBirdPrice price={occ.price} currency={occ.currency} info={occ} timeZone={timeZone} /></div>}
        </div>
        <RowBookButton
          studioSlug={studioSlug}
          occurrence={occ}
          brandColor={brandColor}
          stripeAccountId={stripeAccountId}
          paymentsEnabled={paymentsEnabled}
          timeZone={timeZone}
        />
      </div>
    </article>
    </HideWhenFinished>
  )
}
