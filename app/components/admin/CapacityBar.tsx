import { color, tabularNums } from '@/lib/ui/tokens'

/** Bar colour for a fill ratio: brand green, amber from 80%, red at 100%. */
export function capacityColor(ratio: number): string {
  if (ratio >= 1) return color.fullBar
  if (ratio >= 0.8) return color.lowBar
  return color.primary
}

/**
 * "12 / 20" over a bar. `capacity` null = unlimited: just the booked count, no bar.
 * The numbers are always shown, so the colour never carries the meaning alone.
 */
export default function CapacityBar({ booked, capacity, width = 110, align = 'end' }: {
  booked: number
  capacity: number | null
  width?: number
  align?: 'start' | 'end'
}) {
  const ratio = capacity && capacity > 0 ? Math.min(booked / capacity, 1) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: align === 'end' ? 'flex-end' : 'flex-start', flex: 'none' }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: color.ink, ...tabularNums }}>
        {capacity == null ? `${booked} booked` : `${booked} / ${capacity}`}
      </span>
      {capacity != null && (
        <div
          role="meter" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={booked}
          aria-label={`${booked} of ${capacity} spots booked`}
          style={{ width, height: 6, borderRadius: 3, background: color.track, overflow: 'hidden' }}
        >
          <div style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', borderRadius: 3, background: capacityColor(ratio) }} />
        </div>
      )}
    </div>
  )
}
