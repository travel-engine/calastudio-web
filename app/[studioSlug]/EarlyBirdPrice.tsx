import { formatDayMonth, formatTime } from '@/lib/dates'
import { formatMoney } from '@/lib/money'

// A session's price on the studio site. While early bird applies (the API decides: `price` is
// already the current price), it reads "Early bird A$120 A$150" with the full price struck through,
// and a nudge underneath: spots left when there's a limit, otherwise when it ends.

export interface EarlyBirdInfo {
  full_price?: number | null
  early_bird_active?: boolean
  early_bird_ends_at?: string | null
  early_bird_spots_left?: number | null
}

function endsLabel(endsAt: string, timeZone?: string | null): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  const when = `${formatDayMonth(endsAt, timeZone)}, ${formatTime(endsAt, timeZone)}`
  if (ms < 864e5) return `Early bird ends soon · ${when}`
  const days = Math.floor(ms / 864e5)
  if (days <= 3) return `Early bird ends in ${days} day${days === 1 ? '' : 's'}`
  return `Early bird until ${when}`
}

export default function EarlyBirdPrice({ price, currency, info, timeZone }: {
  price: number
  currency: string
  info: EarlyBirdInfo
  timeZone?: string | null
}) {
  const full = info.full_price
  if (!info.early_bird_active || full == null || full <= price) return <>{formatMoney(price, currency)}</>

  const spots = info.early_bird_spots_left
  const nudge = spots != null && spots <= 5
    ? `Only ${spots} early bird spot${spots === 1 ? '' : 's'} left`
    : info.early_bird_ends_at ? endsLabel(info.early_bird_ends_at, timeZone) : null

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'inherit', gap: 2 }}>
      <span>
        <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>Early bird {formatMoney(price, currency)}</strong>{' '}
        <s aria-label={`usually ${formatMoney(full, currency)}`}>{formatMoney(full, currency)}</s>
      </span>
      {nudge && <span>{nudge}</span>}
    </span>
  )
}
