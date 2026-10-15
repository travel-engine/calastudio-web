'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { clearRememberChoice } from '@/lib/authRemember'
import { clearOrgContext } from '@/lib/orgContext'
import { canViewSessions, canViewOccurrences, canViewBookings, canViewPassTemplates, canViewTeam, canViewAuditLog, canManageSettings, canViewMembers, canViewReports } from '@/lib/roles'
import styles from './sidebar.module.css'

interface SidebarProps {
  active?: string
  // Current user's roles in this org, if known — gates nav items whose page enforces a role.
  // Omit while roles are still loading; items with no gate always show.
  roles?: string[]
}

const SECTIONS = [
  { key: 'studio', label: 'Studio' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'settings', label: 'Settings' },
] as const

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard', key: 'dashboard', section: 'studio', canView: undefined },
  { href: '/dashboard/schedule', icon: '🗓', label: 'Schedule', key: 'schedule', section: 'studio', canView: canViewOccurrences },
  { href: '/dashboard/sessions', icon: '📅', label: 'Sessions', key: 'sessions', section: 'studio', canView: canViewSessions },
  { href: '/dashboard/members', icon: '👥', label: 'Members', key: 'members', section: 'studio', canView: canViewMembers },
  { href: '/dashboard/bookings', icon: '🎟', label: 'Bookings', key: 'bookings', section: 'studio', canView: canViewBookings },
  { href: '/dashboard/passes', icon: '💳', label: 'Passes', key: 'passes', section: 'revenue', canView: canViewPassTemplates },
  { href: '/dashboard/reports', icon: '📊', label: 'Reports', key: 'reports', section: 'revenue', canView: canViewReports },
  { href: '/dashboard/team', icon: '👤', label: 'Team', key: 'team', section: 'settings', canView: canViewTeam },
  { href: '/dashboard/audit-log', icon: '🕘', label: 'Activity log', key: 'audit-log', section: 'settings', canView: canViewAuditLog },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Settings', key: 'settings', section: 'settings', canView: canManageSettings },
]

export default function Sidebar({ active, roles }: SidebarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const visible = (item: typeof navItems[0]) => !item.canView || !roles || item.canView(roles)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearRememberChoice()
    clearOrgContext()
    router.push('/')
  }

  return (
    <>
      {/* Mobile topbar */}
      <div className={styles.topbar}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '22px',
            cursor: 'pointer',
            padding: '4px 8px',
            lineHeight: 1
          }}
        >
          ☰
        </button>
        <Link href="/dashboard" style={{
          backgroundColor: '#085041',
          color: 'white',
          fontWeight: 700,
          fontSize: '14px',
          padding: '6px 12px',
          borderRadius: '8px',
          textDecoration: 'none'
        }}>
          CalaStudio
        </Link>
      </div>

      {/* Mobile backdrop */}
      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      <div className={`${styles.panel} ${open ? styles.open : ''}`}>
      {/* Logo */}

        <Link href="/dashboard"
        style={{
          display: 'block',
          backgroundColor: '#085041',
          color: 'white',
          fontWeight: 700,
          fontSize: '16px',
          padding: '8px 16px',
          borderRadius: '8px',
          marginBottom: '32px',
          textAlign: 'center',
          textDecoration: 'none'
        }}
      >
        CalaStudio
      </Link>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {/* A heading only renders when its section has something this role can see. */}
        {SECTIONS.map((section, i) => {
          const items = navItems.filter(item => item.section === section.key && visible(item))
          if (items.length === 0) return null
          return (
            <div key={section.key}>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '8px',
                marginTop: i === 0 ? 0 : '24px',
                padding: '0 16px'
              }}>
                {section.label}
              </div>
              {items.map(item => (
                <NavLink key={item.key} item={item} active={active === item.key} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Sign out */}
      <div style={{ borderTop: '1px solid #e2e2e2', paddingTop: '16px', marginTop: '16px' }}>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'transparent',
            border: '1px solid #e2e2e2',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          Sign out
        </button>
      </div>
      </div>
    </>
  )
}

function NavLink({ item, active, onNavigate }: { item: typeof navItems[0]; active: boolean; onNavigate?: () => void }) {
  return (

      // next/link: client-side navigation keeps the cached org/roles (lib/orgContext), so a page
      // switch only waits on that page's own data.
      <Link href={item.href}
      onClick={onNavigate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderRadius: '8px',
        backgroundColor: active ? '#e8f5ee' : 'transparent',
        color: active ? '#085041' : '#444',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        marginBottom: '2px'
      }}
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  )
}