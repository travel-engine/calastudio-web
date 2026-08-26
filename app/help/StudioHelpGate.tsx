'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// The help index mixes both audiences on one page, so unlike RequireAuth (which hard-redirects
// the dedicated /help/studio/... routes), this shows a sign-in prompt in place of the studio
// section grid rather than bouncing the whole page — a signed-out visitor can still read the
// member half of this same page.
export default function StudioHelpGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authed' | 'anon'>('loading')

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setStatus(session ? 'authed' : 'anon')
    }
    check()
  }, [])

  if (status === 'loading') return null

  if (status === 'anon') {
    return (
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center',
        border: '1px solid #e2e2e2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
          Sign in to your studio dashboard to view these guides.
        </p>
        <Link href="/login" style={{
          display: 'inline-block', padding: '10px 24px', backgroundColor: '#085041', color: 'white',
          borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none'
        }}>
          Sign in →
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
