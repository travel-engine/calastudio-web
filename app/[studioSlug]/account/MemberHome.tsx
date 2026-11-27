'use client'

// The member's Home tab: a summary of what matters to them right now, like the studio dashboard
// but for one member. Everything comes from GET /members/me/home: the API decides what needs
// attention, what's "low" or "expiring", which pass is used next and what their usual classes
// are. This file only lays it out. Sections with nothing in them aren't shown.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CalendarCheck, CalendarX, ChevronDown, CreditCard, MapPin, RotateCcw, UserPlus,
} from 'lucide-react'
import { formatClock, formatDayLabel, formatShortDate } from '@/lib/dates'
import { studioPath } from '@/lib/seo'
import { formatMoney as money } from '@/lib/money'
import BookAClass from './BookAClass'

// ── Types (GET /api/organisations/{orgId}/members/me/home) ──────────────────────────────────
interface AttentionItem {
  kind: 'unpaid_pass' | 'membership_payment_failed' | 'pass_low' | 'credits_expiring' | 'pass_expiring' | string
  title: string
  detail: string | null
  action: { label: string; kind: 'pay_pass' | 'pay_membership' | 'buy_pass' | 'schedule' | string; target_id: string | null } | null
}
interface PassPurchase {
  member_pass_id: string
  credits_left: number | null
  credits_total: number | null
  expires_on: string | null
  starts_on: string | null
  state: 'active' | 'unpaid' | 'frozen' | 'not_started' | string
  used_next: boolean
  expiring_soon: boolean
}
interface PassRow {
  kind: 'pass'
  template_id: string
  name: string
  valid_at_label: string | null
  credits_left_total: number | null
  is_unlimited: boolean
  purchase_count: number
  expires_on: string | null
  expiring_soon: boolean
  purchases: PassPurchase[]
}
interface MembershipRow {
  kind: 'membership'
  template_id: string
  member_membership_id: string
  name: string
  valid_at_label: string | null
  status: string
  next_payment_on: string | null
  next_payment_amount: number | null
  period_sessions_left: number | null
  period_sessions_cap: number | null
  ends_on: string | null
}
interface NextClass {
  booking_id: string
  occurrence_id: string
  session_name: string
  starts_at: string
  ends_at: string
  location_name: string | null
  teacher_name: string | null
  is_online: boolean
  join_available: boolean
  guest_count: number
  paid_with_label: string | null
}
interface BookAgainItem {
  occurrence_id: string
  session_name: string
  starts_at: string
  location_name: string | null
  spots_left: number | null
  action: 'book' | 'waitlist' | 'buy'
}
interface ActivityItem {
  at: string
  kind: string
  text: string
  detail: string | null
}
export interface MemberHomeData {
  greeting_name: string | null
  currency: string
  timezone: string | null
  attention: AttentionItem[]
  passes_and_memberships: (PassRow | MembershipRow)[]
  next_classes: NextClass[]
  stats: { attended_total: number; attended_this_year?: number; attended_this_month: number }
  /** No longer shown (Home lists the schedule instead); optional until the API drops it. */
  book_again?: { items: BookAgainItem[]; all_usual_booked: boolean }
  activity: ActivityItem[]
}

type Tab = 'upcoming' | 'past' | 'passes' | 'payments'

// ── Small helpers ───────────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A date-only value ("2026-12-03") as "3 Dec", with the year only when it isn't this year. */
function dayMonth(dateOnly: string | null): string {
  if (!dateOnly) return ''
  const [y, m, d] = dateOnly.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} ${MONTHS[m - 1]}${y === new Date().getFullYear() ? '' : ` ${y}`}`
}


/** "Good morning" etc. on the studio's clock. */
function greeting(timeZone: string | null) {
  let h = new Date().getHours()
  try {
    h = Number(new Intl.DateTimeFormat('en-AU', { hour: 'numeric', hourCycle: 'h23', timeZone: timeZone ?? undefined }).format(new Date()))
  } catch { /* unknown zone: browser time */ }
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function whenLabel(iso: string, timeZone: string | null) {
  const day = formatDayLabel(iso, timeZone)
  return day === 'Today' || day === 'Tomorrow' ? day : formatShortDate(iso, timeZone)
}

const card: React.CSSProperties = {
  backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)', overflow: 'hidden',
}
const eyebrow: React.CSSProperties = {
  fontSize: '13px', color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.06em',
}
const rowDivider = '1px solid var(--line)'

function CardHeader({ title, link }: { title: string; link?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', padding: '16px 18px 12px' }}>
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>{title}</h2>
      {link}
    </div>
  )
}

function Bar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0
  return (
    <div aria-hidden style={{ height: '6px', borderRadius: '3px', background: 'var(--line)', marginTop: '6px' }}>
      <div style={{ width: `${pct}%`, height: '6px', borderRadius: '3px', background: color }} />
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────────────────────
export default function MemberHome({
  api, apiUrl, orgId, accessToken, studioSlug, brand, timeZone, onOpenTab, nextClassActions, refreshKey, notificationsPrompt,
}: {
  api: (path: string, init?: RequestInit) => Promise<Response>
  apiUrl: string | undefined
  orgId: string
  accessToken: string
  studioSlug: string
  brand: string
  timeZone: string | null
  onOpenTab: (tab: Tab) => void
  /** Calendar / guest / join buttons for the next class, built by the account page from the booking. */
  nextClassActions?: (bookingId: string) => ReactNode
  /** Change it to reload (after a booking, payment or cancellation elsewhere on the page). */
  refreshKey?: number
  /** The "turn on notifications" nudge, shown under the attention box. */
  notificationsPrompt?: ReactNode
}) {
  const router = useRouter()
  const [home, setHome] = useState<MemberHomeData | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  // The greeting depends on the clock, so it's worked out after mount (no hydration mismatch).
  const [hello, setHello] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await api('/members/me/home')
      if (!res.ok) throw new Error(String(res.status))
      setHome(await res.json())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [api])
  useEffect(() => { load() }, [load, refreshKey])

  const tz = home?.timezone ?? timeZone
  useEffect(() => { setHello(greeting(tz)) }, [tz])

  const go = (path: string) => router.push(studioPath(studioSlug, path))

  const runAction = (a: NonNullable<AttentionItem['action']>) => {
    switch (a.kind) {
      case 'pay_pass': onOpenTab('passes'); break
      case 'pay_membership': if (a.target_id) go(`/account/memberships/${a.target_id}/pay`); break
      case 'buy_pass': go('/pricing'); break
      default: go('/schedule')
    }
  }

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz ?? undefined })
  const linkStyle: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '14px', fontWeight: 600, color: brand, textDecoration: 'none',
  }
  const primaryBtn: React.CSSProperties = {
    border: 'none', borderRadius: '8px', padding: '9px 14px', minHeight: '40px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '14px', fontWeight: 600, background: brand, color: '#fff', whiteSpace: 'nowrap',
  }
  const outlineBtn: React.CSSProperties = {
    ...primaryBtn, background: 'transparent', color: brand, border: `1px solid ${brand}`,
  }

  if (loading && !home) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-meta)' }}>Loading...</div>
  }
  if (failed || !home) {
    return (
      <div style={{ ...card, padding: '24px', textAlign: 'center', color: 'var(--text-meta)', fontSize: '15px' }}>
        <p style={{ margin: '0 0 12px' }}>Couldn&apos;t load your summary.</p>
        <button type="button" onClick={load} style={outlineBtn}>Try again</button>
      </div>
    )
  }

  const next = home.next_classes[0]
  const holdings = home.passes_and_memberships

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Greeting, with classes attended as a small counter on the right (hidden until the first class) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow}>{today}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: '26px', fontWeight: 700, color: 'var(--ink)' }}>
            {hello ?? 'Hello'}{home.greeting_name ? `, ${home.greeting_name}` : ''}
          </h1>
        </div>
        {home.stats.attended_total > 0 && (
          <div
            aria-label={`${home.stats.attended_total} classes attended, ${home.stats.attended_this_month} this month`}
            style={{ textAlign: 'right', flexShrink: 0, lineHeight: 1.15 }}
          >
            <div aria-hidden style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '5px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{home.stats.attended_total}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-meta)' }}>{home.stats.attended_total === 1 ? 'class' : 'classes'}</span>
            </div>
            {home.stats.attended_this_month > 0 && (
              <div aria-hidden style={{ fontSize: '13px', fontWeight: 600, color: brand }}>{home.stats.attended_this_month} this month</div>
            )}
          </div>
        )}
      </div>

      {/* Needs your attention (only when there's something to do) */}
      {home.attention.length > 0 && (
        <section aria-labelledby="attention-heading" style={{
          background: 'var(--warn-bg)', border: '1px solid var(--line)', borderRadius: '12px', padding: '14px',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <h2 id="attention-heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-warn)' }}>
            <AlertTriangle size={18} aria-hidden /> Needs your attention
          </h2>
          {home.attention.map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'var(--surface)', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.title}</div>
                {a.detail && <div style={{ fontSize: '14px', color: 'var(--text-meta)' }}>{a.detail}</div>}
              </div>
              {a.action && <button type="button" style={primaryBtn} onClick={() => runAction(a.action!)}>{a.action.label}</button>}
            </div>
          ))}
        </section>
      )}

      {notificationsPrompt}

      {/* Next class */}
      {next && (
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={eyebrow}>Next class</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}>
            {whenLabel(next.starts_at, tz)}, {formatClock(next.starts_at, tz)}
          </div>
          <div style={{ color: 'var(--text-meta)', fontSize: '15px' }}>
            {[next.session_name, next.is_online ? 'Online' : next.location_name, next.teacher_name ? `with ${next.teacher_name}` : null].filter(Boolean).join(' · ')}
          </div>
          {nextClassActions && <div style={{ marginTop: '10px' }}>{nextClassActions(next.booking_id)}</div>}
        </div>
      )}

      {/* Passes and memberships */}
      {holdings.length > 0 && (
        <section style={card} aria-label={holdings.some(h => h.kind === 'membership') ? 'Your memberships and passes' : 'Your passes'}>
          <CardHeader
            title={holdings.some(h => h.kind === 'membership') ? 'Your memberships and passes' : 'Your passes'}
            link={<button type="button" style={linkStyle} onClick={() => go('/pricing')}>Buy a pass</button>}
          />
          {holdings.map(h => h.kind === 'membership'
            ? <MembershipLine key={`m-${h.member_membership_id}`} m={h} currency={home.currency} />
            : <PassLine key={`p-${h.template_id}`} p={h} brand={brand} open={!!open[h.template_id]}
                onToggle={() => setOpen(o => ({ ...o, [h.template_id]: !o[h.template_id] }))} />)}
        </section>
      )}

      {/* Next classes */}
      {home.next_classes.length > 0 && (
        <section style={card} aria-label="Your next classes">
          <CardHeader title="Your next classes" link={<button type="button" style={linkStyle} onClick={() => onOpenTab('upcoming')}>All bookings</button>} />
          {home.next_classes.map(c => (
            <button key={c.booking_id} type="button" onClick={() => onOpenTab('upcoming')} style={{
              all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer',
              display: 'flex', gap: '14px', padding: '12px 18px', borderTop: rowDivider,
            }}>
              <div style={{ width: '72px', flex: 'none' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-label)' }}>{whenLabel(c.starts_at, tz)}</div>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatClock(c.starts_at, tz)}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.session_name}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-meta)' }}>
                  {[c.is_online ? 'Online' : c.location_name, c.paid_with_label, c.guest_count > 0 ? `+${c.guest_count} guest${c.guest_count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Book a class: the next classes on the schedule, booked right here */}
      <BookAClass apiUrl={apiUrl} studioSlug={studioSlug} orgId={orgId} accessToken={accessToken} brand={brand} timeZone={tz} onBooked={load} />

      {/* Recent activity */}
      {home.activity.length > 0 && (
        <section style={card} aria-label="Recent activity">
          <CardHeader title="Recent activity" />
          <div style={{ padding: '0 18px 10px' }}>
            {home.activity.map((a, i) => <ActivityLine key={i} a={a} brand={brand} timeZone={tz} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function PassLine({ p, brand, open, onToggle }: { p: PassRow; brand: string; open: boolean; onToggle: () => void }) {
  const grouped = p.purchase_count > 1
  // Credits about to expire: amber, readable on light and dark themes alike.
  const amber = '#C98A3E'
  const total = p.is_unlimited || p.credits_left_total == null
    ? <span style={{ fontSize: '16px', fontWeight: 600 }}>Unlimited</span>
    : grouped
      ? <>{p.credits_left_total} <span style={{ fontSize: '13px', color: 'var(--text-meta)', fontWeight: 500 }}>credits</span></>
      : <>{p.credits_left_total}{p.purchases[0]?.credits_total != null && <span style={{ fontSize: '13px', color: 'var(--text-meta)', fontWeight: 500 }}> / {p.purchases[0].credits_total}</span>}</>
  const meta = grouped
    ? [p.valid_at_label, `${p.purchase_count} purchases`, p.expires_on ? `next expires ${dayMonth(p.expires_on)}` : null]
    : [p.valid_at_label, p.expires_on ? `expires ${dayMonth(p.expires_on)}` : null]
  const head = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
          {p.name}{grouped && <span style={{ color: 'var(--text-meta)', fontWeight: 400 }}> ×{p.purchase_count}</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
          {total}
          {grouped && <ChevronDown size={18} aria-hidden style={{ color: brand, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '14px', color: 'var(--text-meta)', marginTop: '2px' }}>
        <MapPin size={14} aria-hidden style={{ flex: 'none' }} />
        <span>{meta.filter(Boolean).join(' · ')}</span>
      </div>
    </>
  )
  const single = p.purchases[0]
  return (
    <div style={{ borderTop: rowDivider }}>
      {grouped ? (
        <button type="button" aria-expanded={open} onClick={onToggle} style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', padding: '12px 18px' }}>
          {head}
        </button>
      ) : (
        <div style={{ padding: '12px 18px' }}>
          {head}
          {single && single.credits_left != null && single.credits_total != null && (
            <Bar value={single.credits_left} total={single.credits_total} color={single.expiring_soon ? amber : brand} />
          )}
        </div>
      )}
      {grouped && open && (
        <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {p.purchases.map(u => (
            <div key={u.member_pass_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '14px' }}>
                <span>
                  <span style={{ fontWeight: 600, color: u.expiring_soon ? amber : 'var(--ink)' }}>
                    {u.credits_left == null ? 'Unlimited' : `${u.credits_left} left`}
                  </span>
                  <span style={{ color: 'var(--text-meta)' }}>
                    {u.expires_on ? ` · expires ${dayMonth(u.expires_on)}` : ''}
                    {u.state === 'unpaid' ? ' · unpaid' : u.state === 'frozen' ? ' · frozen' : u.state === 'not_started' && u.starts_on ? ` · starts ${dayMonth(u.starts_on)}` : ''}
                  </span>
                </span>
                {u.used_next && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: brand, border: `1px solid ${brand}`, borderRadius: '999px', padding: '0 8px', whiteSpace: 'nowrap' }}>Used next</span>
                )}
              </div>
              {u.credits_left != null && u.credits_total != null && (
                <Bar value={u.credits_left} total={u.credits_total} color={u.expiring_soon ? amber : brand} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MembershipLine({ m, currency }: { m: MembershipRow; currency: string }) {
  const parts = [
    m.valid_at_label,
    m.period_sessions_cap != null && m.period_sessions_left != null ? `${m.period_sessions_left} of ${m.period_sessions_cap} classes left this period` : null,
    m.ends_on ? `ends ${dayMonth(m.ends_on)}`
      : m.next_payment_on ? `next payment${m.next_payment_amount != null ? ` ${money(m.next_payment_amount, currency)}` : ''} on ${dayMonth(m.next_payment_on)}` : null,
  ]
  return (
    <div style={{ padding: '12px 18px', borderTop: rowDivider }}>
      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{m.name}</div>
      <div style={{ fontSize: '14px', color: 'var(--text-meta)', marginTop: '2px' }}>{parts.filter(Boolean).join(' · ')}</div>
    </div>
  )
}

function ActivityLine({ a, brand, timeZone }: { a: ActivityItem; brand: string; timeZone: string | null }) {
  const Icon = a.kind === 'booked' ? CalendarCheck
    : a.kind === 'cancelled' || a.kind === 'late_cancelled' ? CalendarX
    : a.kind === 'guest_added' ? UserPlus
    : a.kind === 'refunded' ? RotateCcw
    : CreditCard
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '8px 0', alignItems: 'flex-start' }}>
      <span aria-hidden style={{
        width: '30px', height: '30px', flex: 'none', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--inset)', color: brand,
      }}>
        <Icon size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--ink)', fontSize: '15px' }}>{a.text}</div>
        <div style={{ color: 'var(--text-label)', fontSize: '13px' }}>
          {[whenLabel(a.at, timeZone), a.detail].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  )
}
