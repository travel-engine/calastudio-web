'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Props {
  studioSlug: string
  name: string
  logoUrl: string | null
  brandColor: string
}

// Persistent top bar for the whole public studio tree ([studioSlug]/*): studio identity on the
// left, Schedule + an account area on the right. Signed-in members get an avatar menu; everyone
// else gets a "Sign in" link. Auth state is read client-side, so the bar renders in a neutral
// state until the Supabase session resolves to avoid a hydration mismatch.
export default function StudioNav({ studioSlug, name, logoUrl, brandColor }: Props) {
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? null)
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
      setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Full reload rather than a client transition — clears every page's in-memory auth/session state.
  const handleSignOut = async () => {
    await createClient().auth.signOut()
    setMenuOpen(false)
    window.location.href = `/${studioSlug}`
  }

  const onAccountPage = pathname === `/${studioSlug}/account`
  const initial = (email?.[0] ?? '?').toUpperCase()

  return (
    <header style={{
      backgroundColor: 'white', borderBottom: '1px solid #e2e2e2',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div style={{
        maxWidth: '1100px', margin: '0 auto', padding: '0 20px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>
        <Link
          href={`/${studioSlug}`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit', minWidth: 0 }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '6px', backgroundColor: brandColor, flexShrink: 0 }} />
          )}
          <span style={{
            fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {name}
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
          <Link
            href={`/${studioSlug}`}
            style={{
              fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              color: pathname === `/${studioSlug}` ? '#1a1a1a' : '#666',
            }}
          >
            Schedule
          </Link>
          <Link
            href={`/${studioSlug}/pricing`}
            style={{
              fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              color: pathname === `/${studioSlug}/pricing` ? '#1a1a1a' : '#666',
            }}
          >
            Pricing
          </Link>

          {!ready ? (
            <span style={{ width: '32px' }} aria-hidden />
          ) : email ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                style={{
                  width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                  backgroundColor: brandColor, color: 'white', fontSize: '13px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {initial}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: '220px',
                    backgroundColor: 'white', border: '1px solid #e2e2e2', borderRadius: '10px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)', padding: '6px', zIndex: 30,
                  }}
                >
                  <div style={{
                    padding: '8px 10px 10px', fontSize: '12px', color: '#999',
                    borderBottom: '1px solid #f0f0f0', marginBottom: '4px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {email}
                  </div>
                  <Link
                    href={`/${studioSlug}/account`}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'block', padding: '9px 10px', borderRadius: '6px', fontSize: '13px',
                      color: '#1a1a1a', textDecoration: 'none',
                    }}
                  >
                    My bookings &amp; orders
                  </Link>
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '6px',
                      fontSize: '13px', color: '#8b1a1a', background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : onAccountPage ? null : (
            <Link
              href={`/${studioSlug}/account`}
              style={{
                padding: '8px 16px', backgroundColor: brandColor, color: 'white', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
