'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isSessionExpiredByPolicy, clearRememberChoice } from '@/lib/authRemember'
import { clearOrgContext } from '@/lib/orgContext'

// Enforces the "remember me" session cap across the authenticated dashboard (see lib/authRemember).
// If the viewer chose "don't remember me" and their session is older than the cap, sign them out
// and send them to the login screen. Runs once on mount; the individual pages still do their own
// no-session redirect, so this only needs to handle the "still has a session but it's stale" case.
export default function SessionPolicyGuard() {
  const router = useRouter()

  useEffect(() => {
    if (!isSessionExpiredByPolicy()) return
    ;(async () => {
      try {
        await createClient().auth.signOut()
      } finally {
        clearRememberChoice()
        clearOrgContext()
        router.replace('/login')
      }
    })()
  }, [router])

  return null
}
