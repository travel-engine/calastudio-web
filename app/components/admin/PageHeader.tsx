import type { CSSProperties, ReactNode } from 'react'
import { color, font, type } from '@/lib/ui/tokens'

export const smallCapsStyle: CSSProperties = {
  fontSize: type.smallCaps, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: color.muted,
}

/** Small-caps eyebrow + serif H1 on the left, actions right-aligned (wrapping under on narrow screens). */
export default function PageHeader({ eyebrow, title, actions, children }: {
  eyebrow?: ReactNode
  title: ReactNode
  actions?: ReactNode
  /** Extra line under the title (e.g. a count or a breadcrumb) */
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {eyebrow && <span style={smallCapsStyle}>{eyebrow}</span>}
        <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.h1, lineHeight: 1.05, color: color.ink }}>
          {title}
        </h1>
        {children}
      </div>
      {actions && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{actions}</div>}
    </div>
  )
}
