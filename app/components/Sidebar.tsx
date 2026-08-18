'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canViewSessions, canViewBookings, canViewPassTemplates, canViewTeam, canViewAuditLog } from '@/lib/roles'

interface SidebarProps {
  active?: string
  // Current user's roles in this org, if known — gates nav items whose page enforces a role.
  // Omit while roles are still loading; items with no gate always show.
  roles?: string[]
}

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard', key: 'dashboard', canView: undefined },
  { href: '/dashboard/sessions', icon: '📅', label: 'Sessions', key: 'sessions', canView: canViewSessions },
  { href: '/dashboard/members', icon: '👥', label: 'Members', key: 'members', canView: undefined },
  { href: '/dashboard/bookings', icon: '🎟', label: 'Bookings', key: 'bookings', canView: canViewBookings },
  { href: '/dashboard/passes', icon: '💳', label: 'Passes', key: 'passes', canView: canViewPassTemplates },
  { href: '/dashboard/memberships', icon: '⭐', label: 'Memberships', key: 'memberships', canView: undefined },
  { href: '/dashboard/reports', icon: '📊', label: 'Reports', key: 'reports', canView: undefined },
  { href: '/dashboard/team', icon: '👤', label: 'Team', key: 'team', canView: canViewTeam },
  { href: '/dashboard/audit-log', icon: '🕘', label: 'Activity log', key: 'audit-log', canView: canViewAuditLog },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Settings', key: 'settings', canView: undefined },
]

export default function Sidebar({ active, roles }: SidebarProps) {
  const router = useRouter()
  const visible = (item: typeof navItems[0]) => !item.canView || !roles || item.canView(roles)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{
      width: '240px',
      backgroundColor: 'white',
      borderRight: '1px solid #e2e2e2',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      height: '100vh',
      overflowY: 'auto'
    }}>
      {/* Logo */}
      
        <a href="/dashboard"
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
      </a>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '8px',
          padding: '0 16px'
        }}>
          Studio
        </div>

        {navItems.slice(0, 4).filter(visible).map(item => (
          <NavLink key={item.key} item={item} active={active === item.key} />
        ))}

        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '8px',
          marginTop: '24px',
          padding: '0 16px'
        }}>
          Revenue
        </div>

        {navItems.slice(4, 7).filter(visible).map(item => (
          <NavLink key={item.key} item={item} active={active === item.key} />
        ))}

        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '8px',
          marginTop: '24px',
          padding: '0 16px'
        }}>
          Settings
        </div>

        {navItems.slice(7).filter(visible).map(item => (
          <NavLink key={item.key} item={item} active={active === item.key} />
        ))}
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
  )
}

function NavLink({ item, active }: { item: typeof navItems[0]; active: boolean }) {
  return (
    
      <a href={item.href}
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
    </a>
  )
}