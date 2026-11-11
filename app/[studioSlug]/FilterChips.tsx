'use client'

import { Fragment, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import styles from './photofirst.module.css'

// Schedule filter chips (handoff §Screen: Schedule). Two independent single-select groups —
// mode and type — that map to the existing `?mode=` / `?type=` search params ("all" = omitted),
// plus a location group when the studio runs more than one venue. On a phone the chips sit on one
// row that scrolls sideways (groups separated by a thin divider), so classes start on the first screen.
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

  type Chip = { label: string; on: boolean; patch: Partial<typeof current> }
  const groups: { name: string; chips: Chip[] }[] = [
    { name: 'Mode', chips: [
      { label: 'All modes', on: mode === 'all', patch: { mode: 'all' } },
      { label: 'In-person', on: mode === 'in_person', patch: { mode: 'in_person' } },
      { label: 'Online', on: mode === 'online', patch: { mode: 'online' } },
    ] },
    { name: 'Type', chips: [
      { label: 'All types', on: sessionType === 'all', patch: { type: 'all' } },
      { label: 'Classes', on: sessionType === 'class', patch: { type: 'class' } },
      { label: 'Workshops', on: sessionType === 'workshop', patch: { type: 'workshop' } },
    ] },
    ...(locations && locations.length > 1
      ? [{ name: 'Location', chips: [
          { label: 'All locations', on: location === 'all', patch: { location: 'all' } },
          ...locations.map(l => ({ label: l, on: location === l, patch: { location: l } })),
        ] }]
      : []),
  ]

  // On the scrolling row, bring a chosen filter (not an "All …") into view.
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const chosen = rowRef.current?.querySelector<HTMLElement>('[data-chosen="true"]')
    if (chosen && rowRef.current && rowRef.current.scrollWidth > rowRef.current.clientWidth) {
      rowRef.current.scrollLeft = chosen.offsetLeft - 16
    }
  }, [mode, sessionType, location])

  return (
    <div ref={rowRef} className={styles.chips}>
      {groups.map((g, gi) => (
        <Fragment key={g.name}>
          {gi > 0 && <span className={styles.chipDivider} aria-hidden />}
          <div role="group" aria-label={g.name} className={styles.chipGroup}>
            {g.chips.map((c, ci) => (
              <button
                key={c.label}
                type="button"
                aria-pressed={c.on}
                data-chosen={c.on && ci > 0 ? 'true' : undefined}
                className={`${styles.chip} ${c.on ? styles.chipOn : ''}`}
                onClick={() => apply({ ...current, ...c.patch })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
