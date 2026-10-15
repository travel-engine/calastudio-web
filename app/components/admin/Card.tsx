import type { CSSProperties, ReactNode } from 'react'
import { color, radius } from '@/lib/ui/tokens'

export const cardStyle: CSSProperties = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.card,
}

/** White surface with the card border and radius. `padded` adds the standard 20px inset. */
export default function Card({ children, padded = false, style, as: Tag = 'section', ...aria }: {
  children: ReactNode
  padded?: boolean
  style?: CSSProperties
  as?: 'section' | 'div' | 'article'
  'aria-labelledby'?: string
  'aria-label'?: string
}) {
  return (
    <Tag {...aria} style={{ ...cardStyle, ...(padded ? { padding: 20 } : {}), ...style }}>
      {children}
    </Tag>
  )
}
