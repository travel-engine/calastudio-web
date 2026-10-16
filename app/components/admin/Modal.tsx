'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { color, font, radius } from '@/lib/ui/tokens'
import { buttonStyle } from './Button'
import ui from './admin.module.css'

/** Dialog over a dimmed page: title, close button, Escape closes. `width` caps the panel. */
export default function Modal({ title, onClose, children, width = 480, zIndex = 60 }: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  width?: number
  zIndex?: number
}) {
  const headingId = useId()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(23, 32, 28, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby={headingId} style={{
        background: color.surface, borderRadius: radius.card, padding: 28, width: '100%', maxWidth: width,
        maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        fontFamily: font.body, color: color.ink,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <h2 id={headingId} style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className={`${ui.button} ${ui.focusable}`}
            style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0, flex: 'none' }}>
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Checkbox with its sentence beside it, 44px tall target. */
export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, paddingTop: 4, fontSize: 15, lineHeight: 1.45, color: color.ink2, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 18, height: 18, marginTop: 2, accentColor: color.primary, flex: 'none' }} />
      <span>{children}</span>
    </label>
  )
}

export const alertStyle = (tone: 'danger' | 'ok' = 'danger') => ({
  padding: '12px 16px', borderRadius: radius.control, fontSize: 15,
  background: tone === 'danger' ? color.dangerBg : color.primarySoft,
  color: tone === 'danger' ? color.dangerInk : color.primaryInk,
})
