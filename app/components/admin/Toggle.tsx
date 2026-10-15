'use client'

import { color, space } from '@/lib/ui/tokens'
import ui from './admin.module.css'

/**
 * On/off switch: a real <button role="switch" aria-checked>. Give `label` for a visible label
 * beside it, or `ariaLabel` when the label lives elsewhere (then point aria-labelledby yourself).
 */
export default function Toggle({ checked, onChange, label, ariaLabel, disabled, id }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  ariaLabel?: string
  disabled?: boolean
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={ui.focusable}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: space.target, padding: 0,
        border: 0, background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1, fontFamily: 'inherit', fontSize: 15, color: color.ink, borderRadius: 8,
      }}
    >
      <span aria-hidden style={{
        position: 'relative', width: 40, height: 24, borderRadius: 12, flex: 'none',
        background: checked ? color.primary : color.control, transition: 'background-color 0.12s ease',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: checked ? 19 : 3, width: 18, height: 18, borderRadius: '50%',
          background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.12s ease',
        }} />
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}
