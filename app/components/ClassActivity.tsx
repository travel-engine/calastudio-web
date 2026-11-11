'use client'

import { useCallback, useEffect, useState } from 'react'
import { color } from '@/lib/ui/tokens'
import { Button, cardStyle } from '@/app/components/admin'
import { ActivityItems, type ActivityEntry } from '@/app/components/ActivityFeed'

// Everything that happened on one class, newest first: edits, bookings, cancellations, waitlist
// moves, refunds, and who checked whom in and how. A view over the activity log
// (GET …/occurrences/{id}/activity), where each event is recorded once. Sentences live in
// ActivityFeed, shared with the member and pass feeds.

export default function ClassActivity({ orgId, token, occurrenceId, refreshKey = 0, timeZone = null, currency }: {
  orgId: string; token: string; occurrenceId: string; refreshKey?: number; timeZone?: string | null; currency: string
}) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/occurrences/${occurrenceId}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setFailed(true); setEntries([]); return }
      const data = await res.json()
      setFailed(false)
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true); setEntries([])
    }
  }, [orgId, token, occurrenceId])

  // refreshKey lets the class page re-pull after a check-in, cancellation or edit.
  useEffect(() => { if (orgId && token && occurrenceId) load() }, [orgId, token, occurrenceId, load, refreshKey])

  const count = entries?.length ?? 0

  return (
    <section aria-labelledby="class-activity" style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px' }}>
        <div>
          <h2 id="class-activity" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Activity</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted }}>
            {entries === null ? 'Loading…'
              : failed ? "Couldn't load this class's activity."
              : count === 0 ? 'Nothing has happened on this class yet.'
              : `${count} event${count === 1 ? '' : 's'}: bookings, check-ins, cancellations and edits, and who did them.`}
          </p>
        </div>
        {count > 0 && <Button size="sm" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide' : 'Show'}</Button>}
      </div>

      {open && count > 0 && (
        <div style={{ borderTop: `1px solid ${color.border}` }}>
          <ActivityItems entries={entries!} currency={currency} timeZone={timeZone} context="class" />
        </div>
      )}
    </section>
  )
}
