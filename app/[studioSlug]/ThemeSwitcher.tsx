'use client'

import { useRouter } from 'next/navigation'
import { THEME_KEYS, type ThemeKey } from './theme'

const LABELS: Record<ThemeKey, string> = {
  'photo-first': 'Dark',
  'photo-first-light': 'Light',
}

// Development-only theme preview (see app/[studioSlug]/layout.tsx). Writes a `cs-theme` cookie and
// reloads so the server picks it up. Never rendered in production.
export default function ThemeSwitcher({ current }: { current: ThemeKey }) {
  const router = useRouter()

  const pick = (key: ThemeKey) => {
    document.cookie = `cs-theme=${key}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  return (
    <div
      style={{
        position: 'fixed', left: 12, bottom: 12, zIndex: 90,
        display: 'flex', gap: 2, padding: 3, borderRadius: 999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)', fontFamily: 'var(--font-body)',
      }}
    >
      {THEME_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => pick(k)}
          style={{
            border: 0, cursor: 'pointer', borderRadius: 999, padding: '6px 12px',
            fontSize: 12, fontWeight: 600,
            background: k === current ? '#f5f4f1' : 'transparent',
            color: k === current ? '#0e0e0d' : 'rgba(245,244,241,0.75)',
          }}
        >
          {LABELS[k]}
        </button>
      ))}
    </div>
  )
}
