'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { THEME_KEYS, resolveTheme, type ThemeKey } from '@/lib/studioTheme'

// Development-only theme preview (see app/[studioSlug]/layout.tsx). Writes a `cs-theme` cookie and
// refreshes so the server re-resolves the theme. Never rendered in production.
export default function ThemeSwitcher({ current }: { current: ThemeKey }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const pick = (key: ThemeKey) => {
    document.cookie = `cs-theme=${key}; path=/; max-age=31536000; samesite=lax`
    setOpen(false)
    router.refresh()
  }

  return (
    <div
      style={{
        position: 'fixed', left: 12, bottom: 12, zIndex: 90,
        display: 'flex', flexWrap: 'wrap', gap: 2, padding: 3, borderRadius: 12, maxWidth: 'calc(100vw - 24px)',
        background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ border: 0, cursor: 'pointer', borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#f5f4f1', color: '#0e0e0d' }}
        >
          Theme: {resolveTheme(current).name}
        </button>
      ) : (
        THEME_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pick(k)}
            style={{
              border: 0, cursor: 'pointer', borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 600,
              background: k === current ? '#f5f4f1' : 'transparent',
              color: k === current ? '#0e0e0d' : 'rgba(245,244,241,0.75)',
            }}
          >
            {resolveTheme(k).name}
          </button>
        ))
      )}
    </div>
  )
}
