'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clearRememberChoice } from '@/lib/authRemember'
import { clearOrgContext } from '@/lib/orgContext'
import { getPlatformIdentity } from '@/lib/platformAdmin'
import { color, font, space } from '@/lib/ui/tokens'
import Forbidden from '@/app/components/Forbidden'

// The CalaStudio admin area (/admin): Travel Engine staff only. A plain top bar instead of the studio
// sidebar, so it's always clear this is the platform, not a studio. Children get the token once the
// signed-in person is confirmed as a platform admin.
export default function AdminShell({ children }: { children: (token: string) => ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<{ token: string; hasStudio: boolean; firstName: string | null } | 'loading' | 'forbidden' | 'offline'>('loading')

  useEffect(() => {
    getPlatformIdentity().then(id => {
      if (id.status === 'signed-out') { router.replace('/login'); return }
      setState(id.isPlatformAdmin ? { token: id.token, hasStudio: id.hasStudio, firstName: id.firstName } : 'forbidden')
    }).catch(() => setState('offline'))
  }, [router])

  const signOut = async () => {
    await createClient().auth.signOut()
    clearRememberChoice()
    clearOrgContext()
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: color.bg, fontFamily: font.body, color: color.ink }}>
      <header style={{ background: color.ink, color: '#FFFFFF' }}>
        <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', padding: '12px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#FFFFFF', textDecoration: 'none', fontWeight: 700, fontSize: 17 }}>
            <ShieldCheck size={20} strokeWidth={2} aria-hidden />CalaStudio admin
          </Link>
          <span style={{ flex: 1 }} />
          {typeof state === 'object' && state.hasStudio && (
            <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FFFFFF', fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '8px 10px' }}>
              <LayoutDashboard size={16} aria-hidden />My studio dashboard
            </Link>
          )}
          <button type="button" onClick={signOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', color: '#FFFFFF', borderRadius: 10, padding: '7px 12px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <LogOut size={16} aria-hidden />Sign out
          </button>
        </div>
      </header>
      <main style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', padding: space.pagePadding }}>
        {state === 'loading' ? <p style={{ color: color.muted }}>Loading…</p>
          : state === 'forbidden' ? <Forbidden />
          : state === 'offline' ? <p role="alert" style={{ color: color.dangerInk }}>Couldn&apos;t reach the CalaStudio server. Check your connection and reload.</p>
          : children(state.token)}
      </main>
    </div>
  )
}
