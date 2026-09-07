'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMemberSchedule } from '@/lib/store/memberSchedule'

const apiUrl = process.env.NEXT_PUBLIC_API_URL

// Mounted once on the public schedule page. If the viewer has a Supabase session, re-fetch the
// occurrence listing WITH their bearer token — the backend then attaches viewer_booking /
// viewer_can_cancel to each occurrence — and map that into the store so BookButton can show
// "Booked · Cancel". Silent no-op for anonymous viewers.
export default function MemberScheduleLoader({
  studioSlug,
  orgId,
  queryString,
}: {
  studioSlug: string
  orgId: string
  queryString: string
}) {
  const setContext = useMemberSchedule(s => s.setContext)
  const markLoaded = useMemberSchedule(s => s.markLoaded)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { markLoaded(); return }
        const token = session.access_token

        const res = await fetch(
          `${apiUrl}/api/public/${studioSlug}/occurrences${queryString ? `?${queryString}` : ''}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) { markLoaded(); return }

        const occurrences = await res.json()
        const byOccurrence: Record<string, { bookingId: string; status: string; canCancel: boolean }> = {}
        for (const o of occurrences) {
          if (o.viewer_booking) {
            byOccurrence[o.occurrence_id] = {
              bookingId: o.viewer_booking.id,
              status: o.viewer_booking.status,
              canCancel: !!o.viewer_can_cancel,
            }
          }
        }

        if (!cancelled) setContext({ orgId, accessToken: token, byOccurrence })
      } catch {
        if (!cancelled) markLoaded()
      }
    })()

    return () => { cancelled = true }
  }, [studioSlug, orgId, queryString, setContext, markLoaded])

  return null
}
