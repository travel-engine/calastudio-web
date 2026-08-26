'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// Studio help content requires a signed-in user — same "check session, redirect to /login if
// missing" pattern every /dashboard page uses. Member help has no such gate; it's public.
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setAuthed(true)
    }
    check()
  }, [router])

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    )
  }

  return <>{children}</>
}
