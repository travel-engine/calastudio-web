'use client'

import { Fragment, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import styles from './photofirst.module.css'

// Schedule filter chips (handoff §Screen: Schedule). Two independent single-select groups —
// mode and type — that map to the existing `?mode=` / `?type=` search params ("all" = omitted),
// plus a location group when the studio runs more than one venue. On a phone the chips sit on one
// row that scrolls sideways (groups separated by a thin divider), so classes start on the first screen.
export default function FilterChips({ mode, sessionType, location, locations, modes, types }: {
  mode: string
  sessionType: string
  location: string
  locations?: string[]
  // Values present in the studio's upcoming sessions, ignoring the current filters. A group only
  // shows when there's a real choice (2+ values) — or when it's filtered, so it can be cleared.
  modes?: string[]
  types?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  const apply = (next: { mode: string; type: string; location: string }) => {
    // Start from the current query so params that aren't filters survive (the website widget's
    // `color` / `popup`); then set or drop each filter.
    const params = new URLSearchParams(window.location.search)
    const put = (key: string, value: string) => (value === 'all' ? params.delete(key) : params.set(key, value))
    put('mode', next.mode)
    put('type', next.type)
    put('location', next.location)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const current = { mode, type: sessionType, location }

  type Chip = { label: string; on: boolean; patch: Partial<typeof current> }
  type Group = { name: string; chips: Chip[] }
  // Builds a group from the values actually on offer; null when there's nothing to choose between.
  const group = (
    name: string, allLabel: string, selected: string, key: 'mode' | 'type',
    options: { value: string; label: string }[], present: string[] | undefined,
  ): Group | null => {
    const offered = present ? options.filter(o => present.includes(o.value) || o.value === selected) : options
    if (offered.length < 2 && selected === 'all') return null
    return { name, chips: [
      { label: allLabel, on: selected === 'all', patch: { [key]: 'all' } },
      ...offered.map(o => ({ label: o.label, on: selected === o.value, patch: { [key]: o.value } })),
    ] }
  }
  const groups = [
    group('Mode', 'All modes', mode, 'mode', [
      { value: 'in_person', label: 'In-person' },
      { value: 'online', label: 'Online' },
    ], modes),
    group('Type', 'All types', sessionType, 'type', [
      { value: 'class', label: 'Classes' },
      { value: 'workshop', label: 'Workshops' },
    ], types),
    locations && (locations.length > 1 || location !== 'all')
      ? { name: 'Location', chips: [
          { label: 'All locations', on: location === 'all', patch: { location: 'all' } },
          ...locations.map(l => ({ label: l, on: location === l, patch: { location: l } })),
        ] }
      : null,
  ].filter((g): g is Group => g !== null)

  // On the scrolling row, bring a chosen filter (not an "All …") into view.
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const chosen = rowRef.current?.querySelector<HTMLElement>('[data-chosen="true"]')
    if (chosen && rowRef.current && rowRef.current.scrollWidth > rowRef.current.clientWidth) {
      rowRef.current.scrollLeft = chosen.offsetLeft - 16
    }
  }, [mode, sessionType, location])

  if (groups.length === 0) return null

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
