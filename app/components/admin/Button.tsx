import Link from 'next/link'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { color, radius, space } from '@/lib/ui/tokens'
import ui from './admin.module.css'

type Variant = 'primary' | 'secondary' | 'destructive'
type Size = 'md' | 'sm'

const look: Record<Variant, { bg: string; border: string; ink: string; hoverBg: string; hoverBorder: string }> = {
  primary: { bg: color.primary, border: color.primary, ink: '#FFFFFF', hoverBg: color.primaryHover, hoverBorder: color.primaryHover },
  secondary: { bg: color.surface, border: color.control, ink: color.ink, hoverBg: color.bg, hoverBorder: color.control },
  // Destructive is a text-coloured button, not a red block: deleting stays deliberate.
  destructive: { bg: color.surface, border: color.control, ink: color.dangerInk, hoverBg: color.dangerBg, hoverBorder: color.control },
}

export function buttonStyle(variant: Variant = 'secondary', size: Size = 'md'): CSSProperties {
  const l = look[variant]
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: size === 'sm' ? space.targetDense : space.target,
    padding: size === 'sm' ? '0 12px' : '0 18px',
    borderRadius: radius.control, border: `1px solid ${l.border}`,
    background: l.bg, color: l.ink,
    fontFamily: 'inherit', fontSize: size === 'sm' ? 14 : 15, fontWeight: 600,
    textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer', boxSizing: 'border-box',
    ['--hover-bg' as string]: l.hoverBg, ['--hover-border' as string]: l.hoverBorder,
  }
}

type Props = {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  children: ReactNode
  style?: CSSProperties
} & (
  | ({ href: string } & { onClick?: () => void; target?: string })
  | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
)

/** Primary / secondary / destructive (text) button. Pass `href` to render a link that looks like one. */
export default function Button({ variant = 'secondary', size = 'md', icon, children, style, ...rest }: Props) {
  const className = `${ui.button} ${ui.focusable}`
  const merged = { ...buttonStyle(variant, size), ...style }
  if ('href' in rest && rest.href !== undefined) {
    const { href, onClick, target } = rest
    return (
      <Link href={href} onClick={onClick} target={target} className={className} style={merged}>
        {icon}{children}
      </Link>
    )
  }
  const { type = 'button', ...buttonProps } = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button type={type} {...buttonProps} className={className} style={merged}>
      {icon}{children}
    </button>
  )
}
