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
 * `trend` sits beside the number (e.g. "▲ 12% vs last week").
 *
 * On phones the tile is compact: smaller number, and the `sub` line and bar are hidden unless
 * `keepSubOnPhone` (admin.module.css). `className` lets the page place it in its grid.
 */
export default function StatTile({ label, value, suffix, trend, sub, bar, href, children, className, keepSubOnPhone }: {
  label: string
  value?: ReactNode
  suffix?: ReactNode
  trend?: ReactNode
  sub?: ReactNode
  bar?: number
  href: string
  children?: ReactNode
  className?: string
  keepSubOnPhone?: boolean
}) {
  return (
    <Link
      href={href}
      className={[ui.tile, ui.statTile, ui.focusable, keepSubOnPhone ? ui.tileKeepSub : '', className ?? ''].filter(Boolean).join(' ')}
      style={{
        ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 22px', minWidth: 0,
        textDecoration: 'none', color: color.ink, ['--hover-border' as string]: '#B9C9C1',
      }}
    >
      <span style={smallCapsStyle}>{label}</span>
      {value !== undefined && (
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
          <span className={ui.tileValue} style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1, ...tabularNums }}>{value}</span>
          {suffix && <span className={ui.tileSuffix} style={{ fontSize: 17, color: color.muted, ...tabularNums }}>{suffix}</span>}
          {trend}
        </div>
      )}
      {children}
      {bar !== undefined && (
        <div className={ui.tileBar} style={{ height: 8, borderRadius: 4, background: color.track, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(Math.min(bar, 1) * 100)}%`, height: '100%', borderRadius: 4, background: capacityColor(bar) }} />
        </div>
      )}
      {sub && <span className={ui.tileSub} style={{ fontSize: 14, lineHeight: 1.4, color: color.muted }}>{sub}</span>}
    </Link>
  )
}
