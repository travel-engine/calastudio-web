'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { clearRememberChoice } from '@/lib/authRemember'
import styles from './studionav.module.css'

interface Props {
  studioSlug: string
  name: string
  logoUrl: string | null
  brandColor: string
  /**
   * `photofirst` — bar overlays the hero photo on the home page, no CTA.
   * `themed` — always a solid bar with a "Book a class" CTA (handoff Studio Themes layout).
   */
  layout?: 'photofirst' | 'themed'
}

// Persistent top bar for the whole public studio tree ([studioSlug]/*): studio identity on the
// left, nav links + an account area on the right. Below 680px the links collapse into a burger
// menu that drops down under the header. Auth state is read client-side, so the bar renders in a
// neutral state until the Supabase session resolves to avoid a hydration mismatch.
//
// `brand_color` still drives the account avatar (the theme owns everything else).
export default function StudioNav({ studioSlug, name, logoUrl, brandColor, layout = 'photofirst' }: Props) {
  const pathname = usePathname()
  const themed = layout === 'themed'
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const home = `/${studioSlug}`
  const onHome = pathname === home

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

  // Collapse the mobile menu on navigation.
  useEffect(() => { setNavOpen(false) }, [pathname])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  // Full reload rather than a client transition — clears every page's in-memory auth/session state.
  const handleSignOut = async () => {
    await createClient().auth.signOut()
    clearRememberChoice()
    setMenuOpen(false)
    window.location.href = home
  }

  const onAccountPage = pathname === `/${studioSlug}/account`
  const initial = (email?.[0] ?? '?').toUpperCase()

  const navLinks = [
    // The themed layout leads with the studio name as "home" and drops the explicit Home link.
    ...(themed ? [] : [{ href: home, label: 'Home', active: onHome }]),
    { href: `${home}/schedule`, label: 'Schedule', active: pathname === `${home}/schedule` },
    { href: `${home}/teachers`, label: 'Teachers', active: pathname.startsWith(`${home}/teachers`) },
    { href: `${home}/pricing`, label: 'Pricing', active: pathname === `${home}/pricing` },
  ]

  return (
    <header className={`${styles.bar} ${!themed && onHome ? styles.barOverPhoto : ''}`}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <button
            type="button"
            className={styles.burger}
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen(o => !o)}
          >
            {navOpen ? '✕' : '☰'}
          </button>
          <Link
            href={home}
            className={styles.brand}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={`${name} logo`} style={{ width: 30, height: 30, borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
            ) : null}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          </Link>
        </div>

        <nav className={styles.right}>
          <div className={`${styles.links} ${navOpen ? styles.linksOpen : ''}`}>
            {navLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.link} ${l.active ? styles.linkActive : ''}`}
                onClick={() => setNavOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <a href="/help" target="_blank" rel="noopener noreferrer" className={styles.link} onClick={() => setNavOpen(false)}>
              Help
            </a>
          </div>

          {themed && (
            <Link href={`${home}/schedule`} className={styles.navCta} onClick={() => setNavOpen(false)}>
              Book a class
            </Link>
          )}

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
                    position: 'absolute', right: 0, top: 'calc(100% + 10px)', minWidth: '220px',
                    background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: '14px',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.45)', padding: '6px', zIndex: 30,
                  }}
                >
                  <div style={{
                    padding: '8px 10px 10px', fontSize: '12px', color: 'var(--text-label)',
                    borderBottom: '1px solid var(--line)', marginBottom: '4px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {email}
                  </div>
                  <Link
                    href={`/${studioSlug}/account`}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    style={{ display: 'block', padding: '9px 10px', borderRadius: '8px', fontSize: '13px', color: 'var(--ink)', textDecoration: 'none' }}
                  >
                    My bookings &amp; orders
                  </Link>
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '8px',
                      fontSize: '13px', color: '#e88f8f', background: 'none', border: 'none', cursor: 'pointer',
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
                padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 'var(--pill)',
                fontSize: '13px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
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
