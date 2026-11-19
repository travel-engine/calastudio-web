'use client'

import { useEffect, useState, type ReactNode } from 'react'

// Hides a class row once the class has finished, without waiting for a page refresh — so a list
// left open on a phone drops each class as it ends. Starts visible so the server HTML and the first
// client render match (no hydration mismatch); the check runs after mount and again at ends_at.
export default function HideWhenFinished({ endsAt, children }: { endsAt: string; children: ReactNode }) {
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    const msLeft = new Date(endsAt).getTime() - Date.now()
    if (Number.isNaN(msLeft)) return
    if (msLeft <= 0) { setFinished(true); return }
    // setTimeout overflows above ~24.8 days; anything that far out gets caught by a later refresh.
    if (msLeft > 2_000_000_000) return
    const t = window.setTimeout(() => setFinished(true), msLeft)
    return () => window.clearTimeout(t)
  }, [endsAt])

  return finished ? null : <>{children}</>
}
