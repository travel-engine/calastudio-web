'use client'

import { useRouter, usePathname } from 'next/navigation'
import styles from './photofirst.module.css'

// Schedule filter chips (handoff §Screen: Schedule). Two independent single-select groups —
// mode and type — that map to the existing `?mode=` / `?type=` search params ("all" = omitted),
// plus a location group when the studio runs more than one venue.
export default function FilterChips({ mode, sessionType, location, locations }: {
  mode: string
  sessionType: string
  location: string
  locations?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  const apply = (next: { mode: string; type: string; location: string }) => {
    const params = new URLSearchParams()
    if (next.mode !== 'all') params.set('mode', next.mode)
    if (next.type !== 'all') params.set('type', next.type)
    if (next.location !== 'all') params.set('location', next.location)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const current = { mode, type: sessionType, location }

  const chips: { label: string; on: boolean; patch: Partial<typeof current> }[] = [
    { label: 'All modes', on: mode === 'all', patch: { mode: 'all' } },
    { label: 'In-person', on: mode === 'in_person', patch: { mode: 'in_person' } },
    { label: 'Online', on: mode === 'online', patch: { mode: 'online' } },
    { label: 'All types', on: sessionType === 'all', patch: { type: 'all' } },
    { label: 'Classes', on: sessionType === 'class', patch: { type: 'class' } },
    { label: 'Workshops', on: sessionType === 'workshop', patch: { type: 'workshop' } },
    ...(locations && locations.length > 1
      ? [
          { label: 'All locations', on: location === 'all', patch: { location: 'all' } },
          ...locations.map(l => ({ label: l, on: location === l, patch: { location: l } })),
        ]
      : []),
  ]

  return (
    <div className={styles.chips}>
      {chips.map(c => (
        <button
          key={c.label}
          type="button"
          aria-pressed={c.on}
          className={`${styles.chip} ${c.on ? styles.chipOn : ''}`}
          onClick={() => apply({ ...current, ...c.patch })}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
