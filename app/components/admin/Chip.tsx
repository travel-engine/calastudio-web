import type { CSSProperties, ReactNode } from 'react'
import { color, radius } from '@/lib/ui/tokens'

export type ChipTone = 'neutral' | 'primary' | 'warn' | 'danger' | 'info'

const tones: Record<ChipTone, { bg: string; ink: string }> = {
  neutral: { bg: color.neutralChip, ink: color.neutralInk },
  primary: { bg: color.primarySoft, ink: color.primaryInk },
  warn: { bg: color.warnBg, ink: color.warnInk },
  danger: { bg: color.dangerBg, ink: color.dangerInk },
  info: { bg: color.infoBg, ink: color.infoInk },
}

/** Status pill. Status is never colour-only: the words carry it, the tone reinforces it. */
export default function Chip({ tone = 'neutral', icon, children, style }: {
  tone?: ChipTone
  icon?: ReactNode
  children: ReactNode
  style?: CSSProperties
}) {
  const t = tones[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26, padding: '0 10px',
      borderRadius: radius.chip, background: t.bg, color: t.ink,
      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', ...style,
    }}>
      {icon}{children}
    </span>
  )
}
