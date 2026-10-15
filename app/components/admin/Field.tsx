import type { CSSProperties, ReactNode } from 'react'
import { color, radius, space, type } from '@/lib/ui/tokens'

/** Style for text inputs, selects and textareas inside a Field. */
export const controlStyle: CSSProperties = {
  width: '100%', minHeight: space.target, padding: '0 12px', boxSizing: 'border-box',
  border: `1px solid ${color.control}`, borderRadius: radius.control, background: color.surface,
  fontFamily: 'inherit', fontSize: 15, color: color.ink,
}

/**
 * Label + optional hint + the control. `htmlFor` must match the control's id so the label is real
 * (clicking it focuses the control, screen readers announce it). With a hint, give the control
 * aria-describedby={`${id}-hint`} so the hint is read out too.
 */
export default function Field({ label, hint, htmlFor, children, style }: {
  label: ReactNode
  hint?: ReactNode
  htmlFor: string
  children: ReactNode
  style?: CSSProperties
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label htmlFor={htmlFor} style={{ fontSize: type.label, fontWeight: 600, color: color.ink }}>{label}</label>
      {children}
      {hint && <span id={hintId} style={{ fontSize: 13, lineHeight: 1.4, color: color.muted }}>{hint}</span>}
    </div>
  )
}
