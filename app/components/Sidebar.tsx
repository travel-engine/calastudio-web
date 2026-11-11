'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { CalendarDays, ChartColumn, Check, ChevronsUpDown, Clock, ExternalLink, House, Layers, LogOut, Menu, ShieldCheck, SlidersHorizontal, Ticket, UserPlus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clearRememberChoice } from '@/lib/authRemember'
import { clearOrgContext, getMyStudios, getOrgContext, switchStudio, PLATFORM_ADMIN, type MyStudio } from '@/lib/orgContext'
import { STUDIO_SUBDOMAINS, studioOrigin, studioUrl } from '@/lib/seo'
import { canViewSessions, canViewOccurrences, canViewPassTemplates, canViewTeam, canViewAuditLog, canManageSettings, canViewMembers, canViewReports } from '@/lib/roles'
import { color } from '@/lib/ui/tokens'
import { buttonStyle } from '@/app/components/admin/Button'
import ui from '@/app/components/admin/admin.module.css'
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

type NavItem = {
  href: string
  icon: LucideIcon
  label: string
  key: string
  section: (typeof SECTIONS)[number]['key']
  canView?: (roles: string[]) => boolean
  /** Hidden until roles are known (most items show while roles load; this one must not). */
  strict?: boolean
}

// No Bookings item: its job is Schedule → a class's roster (handoff §2); next.config redirects it.
const navItems: NavItem[] = [
  { href: '/dashboard', icon: House, label: 'Dashboard', key: 'dashboard', section: 'studio' },
  { href: '/dashboard/schedule', icon: CalendarDays, label: 'Schedule', key: 'schedule', section: 'studio', canView: canViewOccurrences },
  { href: '/dashboard/sessions', icon: Layers, label: 'Sessions', key: 'sessions', section: 'studio', canView: canViewSessions },
  { href: '/dashboard/members', icon: Users, label: 'Members', key: 'members', section: 'studio', canView: canViewMembers },
  { href: '/dashboard/passes', icon: Ticket, label: 'Passes', key: 'passes', section: 'revenue', canView: canViewPassTemplates },
  { href: '/dashboard/reports', icon: ChartColumn, label: 'Reports', key: 'reports', section: 'revenue', canView: canViewReports },
  { href: '/dashboard/team', icon: UserPlus, label: 'Team', key: 'team', section: 'settings', canView: canViewTeam },
  { href: '/dashboard/audit-log', icon: Clock, label: 'Activity log', key: 'audit-log', section: 'settings', canView: canViewAuditLog },
  { href: '/dashboard/settings', icon: SlidersHorizontal, label: 'Settings', key: 'settings', section: 'settings', canView: canManageSettings },
  // CalaStudio's own staff (Travel Engine staff) only — not a studio role.
  { href: '/admin', icon: ShieldCheck, label: 'CalaStudio admin', key: 'platform', section: 'settings', canView: r => r.includes(PLATFORM_ADMIN), strict: true },
]

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill={color.primary} />
      <path d="M6 17c2.5-3 5-3 8 0s5.5 3 8 0" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="14" cy="10" r="2.4" fill="#FFFFFF" />
    </svg>
  )
}

export default function Sidebar({ active, roles }: SidebarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Which studio this dashboard belongs to — from the per-tab org cache every page already loads.
  const [studio, setStudio] = useState<{ id: string; name: string; slug: string; logo: string | null } | null>(null)
  // Other studios this person is on staff at; the switcher only appears when there's more than one.
  const [studios, setStudios] = useState<MyStudio[]>([])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  useEffect(() => {
    getOrgContext().then(ctx => {
      if (ctx.status === 'ok') setStudio({ id: ctx.org.id, name: ctx.org.name ?? '', slug: ctx.org.slug, logo: ctx.org.logo_url ?? null })
    }).catch(() => {})
    getMyStudios().then(setStudios).catch(() => {})
  }, [])
  const canSwitch = studios.length > 1
  const visible = (item: NavItem) => !item.canView || (!roles ? !item.strict : item.canView(roles))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

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
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className={ui.focusable}
          style={{ ...buttonStyle('secondary'), width: 44, padding: 0 }}
        >
          <Menu size={20} strokeWidth={1.8} aria-hidden />
        </button>
        <Link href="/dashboard" className={`${styles.brand} ${ui.focusable}`} style={{ minWidth: 0 }}>
          <BrandMark size={24} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studio?.name || 'CalaStudio'}</span>
        </Link>
      </div>

      {/* Mobile backdrop */}
      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      <nav aria-label="Main" className={`${styles.panel} ${open ? styles.open : ''}`}>
        <Link href="/dashboard" className={`${styles.brand} ${ui.focusable}`} onClick={() => setOpen(false)}>
          <BrandMark />CalaStudio
        </Link>

        {studio && (
          <div className={styles.studioWrap}>
            <div className={styles.studio}>
              <StudioMark name={studio.name} logo={studio.logo} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className={styles.studioLabel}>Your studio</span>
                <span className={styles.studioName}>{studio.name}</span>
                <a href={studioUrl(studio.slug)} target="_blank" rel="noreferrer" className={`${styles.studioLink} ${ui.focusable}`}>
                  {STUDIO_SUBDOMAINS ? studioOrigin(studio.slug).replace(/^https?:\/\//, '') : 'View booking page'}
                  <ExternalLink size={12} strokeWidth={2} aria-hidden />
                </a>
              </span>
              {canSwitch && (
                <button
                  type="button"
                  onClick={() => setSwitcherOpen(o => !o)}
                  aria-expanded={switcherOpen}
                  aria-controls="studio-switcher"
                  aria-label={`Switch studio (${studios.length} studios)`}
                  className={`${styles.switchBtn} ${ui.focusable}`}
                >
                  <ChevronsUpDown size={18} strokeWidth={1.8} aria-hidden />
                </button>
              )}
            </div>
            {canSwitch && switcherOpen && (
              <ul id="studio-switcher" className={styles.switcher} aria-label="Your studios">
                {studios.map(s => {
                  const current = s.id === studio.id
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={current || switching !== null}
                        aria-current={current ? 'true' : undefined}
                        onClick={() => { setSwitching(s.id); switchStudio(s.id) }}
                        className={`${styles.switchItem} ${current ? styles.switchCurrent : ''} ${ui.focusable}`}
                      >
                        <StudioMark name={s.name} logo={s.logo_url} small />
                        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                          <span className={styles.studioName}>{s.name}</span>
                          <span className={styles.switchRole}>{switching === s.id ? 'Opening…' : roleLabel(s.roles)}</span>
                        </span>
                        {current && <Check size={16} strokeWidth={2} aria-hidden />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* A heading only renders when its section has something this role can see. */}
        {SECTIONS.map(section => {
          const items = navItems.filter(item => item.section === section.key && visible(item))
          if (items.length === 0) return null
          return (
            <div key={section.key}>
              <div className={styles.group}>{section.label}</div>
              {items.map(item => (
                <NavLink key={item.key} item={item} active={active === item.key} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )
        })}

        <div className={styles.signout}>
          <button
            type="button"
            onClick={handleSignOut}
            className={`${ui.button} ${ui.focusable}`}
            style={{ ...buttonStyle('secondary'), width: '100%' }}
          >
            <LogOut size={18} strokeWidth={1.8} aria-hidden />Sign out
          </button>
        </div>
      </nav>
    </>
  )
}

function StudioMark({ name, logo, small }: { name: string; logo: string | null; small?: boolean }) {
  return (
    <span className={`${styles.studioMark} ${small ? styles.studioMarkSmall : ''}`} aria-hidden>
      {logo ? <img src={logo} alt="" /> : (name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  teacher_super: 'Senior teacher',
  teacher_general: 'Teacher',
  teacher_basic: 'Teacher',
  front_desk: 'Front desk',
}
// The highest staff role, in the same order the API ranks studios by.
function roleLabel(roles: string[]): string {
  const top = ['admin', 'teacher_super', 'teacher_general', 'teacher_basic', 'front_desk'].find(r => roles.includes(r))
  return top ? ROLE_LABEL[top] : ''
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    // next/link: client-side navigation keeps the cached org/roles (lib/orgContext), so a page
    // switch only waits on that page's own data.
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`${styles.navlink} ${active ? styles.active : ''} ${ui.focusable}`}
    >
      <Icon size={20} strokeWidth={1.8} aria-hidden />
      {item.label}
    </Link>
  )
}
