import Link from 'next/link'
import type { ReactNode } from 'react'
import { color, tabularNums } from '@/lib/ui/tokens'
import { cardStyle } from './Card'
import { smallCapsStyle } from './PageHeader'
import { capacityColor } from './CapacityBar'
import ui from './admin.module.css'

/**
 * Dashboard KPI tile; the whole tile is a link. Give `value` for a big number, or `children` for
 * anything else (an empty-state sentence, a date). `bar` (0–1) draws a progress bar under it.
 */
export default function StatTile({ label, value, suffix, sub, bar, href, children }: {
  label: string
  value?: ReactNode
  suffix?: ReactNode
  sub?: ReactNode
  bar?: number
  href: string
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`${ui.tile} ${ui.focusable}`}
      style={{
        ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 22px',
        textDecoration: 'none', color: color.ink, ['--hover-border' as string]: '#B9C9C1',
      }}
    >
      <span style={smallCapsStyle}>{label}</span>
      {value !== undefined && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1, ...tabularNums }}>{value}</span>
          {suffix && <span style={{ fontSize: 17, color: color.muted, ...tabularNums }}>{suffix}</span>}
        </div>
      )}
      {children}
      {bar !== undefined && (
        <div style={{ height: 8, borderRadius: 4, background: color.track, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(Math.min(bar, 1) * 100)}%`, height: '100%', borderRadius: 4, background: capacityColor(bar) }} />
        </div>
      )}
      {sub && <span style={{ fontSize: 14, lineHeight: 1.4, color: color.muted }}>{sub}</span>}
    </Link>
  )
}
