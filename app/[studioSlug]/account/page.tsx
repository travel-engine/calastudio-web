'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useSearchParams, usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { splitName } from '@/lib/names'
import { formatDayMonth, formatShortDate, formatTimeRange, formatWhen } from '@/lib/dates'
import { setRememberChoice, clearRememberChoice, isSessionExpiredByPolicy } from '@/lib/authRemember'
import styles from './account.module.css'
import pf from '../photofirst.module.css'
import CalendarLinks from '../CalendarLinks'
import { studioPath } from '@/lib/seo'

interface OrgInfo {
  id: string
  name: string
  logo_url: string | null
  brand_color: string | null
  timezone?: string | null
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  date_of_birth: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
  person_type: string | null
  gender: string | null
  roles: string[]
  join_date: string
  total_sessions_attended: number
}

interface Booking {
  id: string
  status: 'confirmed' | 'attended' | 'cancelled' | 'late_cancel' | 'no_show' | 'waitlisted'
  booked_mode: 'in_person' | 'online'
  booked_at: string
  guest_count: number
  cancellation_reason: string | null
  calendar_ics_url?: string | null
  calendar_google_url?: string | null
  session_occurrence: {
    starts_at: string
    ends_at: string
    meeting_url: string | null
    session: {
      name: string
      session_type: string
      delivery_mode: string
      location_name: string | null
      location_address: string | null
      meeting_url: string | null
      meeting_url_visible: boolean
    } | null
  } | null
}

interface Pass {
  id: string
  credits_total: number | null
  credits_remaining: number | null
  effective_from: string
  expires_at: string
  status: 'active' | 'low' | 'frozen' | 'expired' | 'exhausted'
  auto_renew_enabled: boolean
  pass_template: { name: string; price: number; currency: string } | null
}

interface Payment {
  id: string
  payment_type: 'booking' | 'pass_purchase' | 'membership_purchase'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'
  amount: number
  subtotal: number
  tax_amount: number
  tax_name: string | null
  currency: string
  invoice_number: string | null
  refunded_amount: number
  refund_reason: string | null
  created_at: string
}

interface WaitlistEntry {
  id: string
  preferred_mode: 'in_person' | 'online'
  position: number
  spots_needed: number
  intended_guest_count: number
  token: string | null
  token_expires_at: string | null
  status: 'waiting' | 'promoted' | 'booked' | 'expired' | 'removed'
  joined_at: string
  promoted_at: string | null
  session_occurrence: {
    starts_at: string
    ends_at: string
    session: { name: string; session_type: string; delivery_mode: string } | null
  } | null
}

interface LedgerEntry {
  id: string
  member_pass_id: string
  movement_type: 'purchase' | 'booking_debit' | 'cancel_credit' | 'expired_forfeit' | 'promotion_credit' | 'studio_adjustment'
  credits_delta: number
  credits_after: number
  notes: string | null
  created_at: string
}

const movementLabels: Record<string, string> = {
  purchase: 'Purchase',
  booking_debit: 'Booking',
  cancel_credit: 'Cancellation credit',
  expired_forfeit: 'Expired',
  promotion_credit: 'Promotion',
  studio_adjustment: 'Studio adjustment',
}

const paymentTypeLabels: Record<string, string> = {
  booking: 'Class booking',
  pass_purchase: 'Pass purchase',
  membership_purchase: 'Membership purchase',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', border: '1px solid var(--line-chip)', borderRadius: '10px',
  fontSize: '14px', outline: 'none', background: 'var(--inset)', color: 'var(--ink)',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }

function StatusBadge({ status }: { status: string }) {
  // Theme colours, so badges read on light and dark themes alike.
  const ok = { bg: 'var(--ok-bg)', color: 'var(--ink)' }
  const warn = { bg: 'var(--warn-bg)', color: 'var(--text-warn)' }
  const info = { bg: 'var(--ok-bg)', color: 'var(--text-body)' }
  const bad = { bg: 'var(--danger-bg)', color: 'var(--danger)' }
  const mute = { bg: 'transparent', color: 'var(--text-label)' }
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { ...ok, label: 'Active' },
    low: { ...warn, label: 'Low' },
    frozen: { ...info, label: 'Frozen' },
    expired: { ...mute, label: 'Expired' },
    exhausted: { ...mute, label: 'Used up' },
    confirmed: { ...ok, label: 'Confirmed' },
    attended: { ...info, label: 'Attended' },
    cancelled: { ...mute, label: 'Cancelled' },
    late_cancel: { ...bad, label: 'Late cancel' },
    waitlisted: { ...warn, label: 'Waitlisted' },
    pending: { ...warn, label: 'Pending' },
    succeeded: { ...ok, label: 'Paid' },
    failed: { ...bad, label: 'Failed' },
    refunded: { ...mute, label: 'Refunded' },
    partially_refunded: { ...mute, label: 'Partially refunded' },
    waiting: { ...warn, label: 'Waiting' },
    promoted: { ...ok, label: 'Spot ready' },
    booked: { ...ok, label: 'Booked' },
    removed: { ...mute, label: 'Left' },
  }
  const s = map[status]
  if (!s) return null // no_show and any unknown status carry no badge
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px', border: '1px solid var(--line-chip)',
      fontSize: '14px', fontWeight: 600, backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap'
    }}>
      {s.label}
    </span>
  )
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

// "Today, 7:00 am" · "Sat 24 Oct, 7:00 am" (year only when it isn't this year)
function formatDateTime(iso: string, timeZone?: string | null) {
  return formatWhen(iso, timeZone)
}

function timeRange(startIso: string, endIso: string, timeZone?: string | null) {
  return formatTimeRange(startIso, endIso, timeZone)
}

const JOIN_WINDOW_MS = 15 * 60 * 1000

// What the "Join" affordance should show for an upcoming online booking, per 04-booking-flow.md §4.2.6.
function onlineJoin(occ: NonNullable<Booking['session_occurrence']>) {
  const now = Date.now()
  const starts = new Date(occ.starts_at).getTime()
  const ends = new Date(occ.ends_at).getTime()
  const url = occ.meeting_url ?? occ.session?.meeting_url ?? null
  if (url && now >= starts - JOIN_WINDOW_MS && now <= ends) return { kind: 'link' as const, url }
  if (now < starts - JOIN_WINDOW_MS) {
    return occ.session?.meeting_url_visible || url
      ? { kind: 'note' as const, text: 'Join link opens 15 min before' }
      : { kind: 'note' as const, text: 'Join link emailed 15 min before' }
  }
  return null // session over, or no link available at all
}

// Profile and Privacy & policies open from the account menu (StudioNav) as ?tab=…, so the page reads
// the tab from the URL; useSearchParams needs a Suspense boundary.
export default function MemberAccountPage() {
  return <Suspense fallback={null}><MemberAccountContent /></Suspense>
}

const TAB_KEYS = ['upcoming', 'past', 'passes', 'payments', 'policies', 'profile'] as const
type AccountTab = typeof TAB_KEYS[number]

function MemberAccountContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const studioSlug = params.studioSlug as string
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  const [checking, setChecking] = useState(true)
  const [accessToken, setAccessToken] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  // Auth form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  // Resolved membership
  const [orgId, setOrgId] = useState('')
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [studioNotFound, setStudioNotFound] = useState(false)
  const [portalError, setPortalError] = useState('')

  const [tab, setTab] = useState<AccountTab>('upcoming')
  const urlTab = searchParams.get('tab')
  useEffect(() => {
    if (urlTab && (TAB_KEYS as readonly string[]).includes(urlTab)) setTab(urlTab as AccountTab)
  }, [urlTab])
  // A tab pill clears ?tab=, so choosing Profile from the menu again still registers as a change.
  const chooseTab = (t: AccountTab) => {
    setTab(t)
    if (urlTab) router.replace(pathname, { scroll: false })
  }
  // Credit history isn't its own tab — it's the movement list you expand under an individual pass.
  const [expandedPassId, setExpandedPassId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [passes, setPasses] = useState<Pass[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [downloadingReceiptId, setDownloadingReceiptId] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const [leavingWaitlistId, setLeavingWaitlistId] = useState('')
  const [claimingWaitlistId, setClaimingWaitlistId] = useState('')
  const [waitlistActionError, setWaitlistActionError] = useState('')

  const [profileForm, setProfileForm] = useState({
    first_name: '', last_name: '', phone: '', date_of_birth: '', emergency_contact_name: '',
    emergency_contact_phone: '', address: '', person_type: '', gender: ''
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [cancellingId, setCancellingId] = useState('')
  const [cancelError, setCancelError] = useState('')

  const [invoicePayment, setInvoicePayment] = useState<Payment | null>(null)

  // Terms & Liability Waiver acceptance — only surfaced when registering with this studio for the
  // first time fails because it hasn't been accepted yet.
  const [needsAgreements, setNeedsAgreements] = useState(false)
  const [waiverInfo, setWaiverInfo] = useState<{ required: boolean; version: number; text: string | null } | null>(null)
  const [waiverLoading, setWaiverLoading] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeWaiver, setAgreeWaiver] = useState(false)
  const [agreementsBusy, setAgreementsBusy] = useState(false)
  const [agreementsError, setAgreementsError] = useState('')
  const [pendingAuth, setPendingAuth] = useState<{ token: string; meta: { fullName?: string; phone?: string } } | null>(null)

  const authedFetch = useCallback((path: string, init?: RequestInit) =>
    fetch(`${apiUrl}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
    }), [apiUrl, orgId, accessToken])

  const resolveMembership = useCallback(async (token: string, meta: { fullName?: string; phone?: string }) => {
    try {
      const res = await fetch(`${apiUrl}/api/public/${studioSlug}/members/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...splitName(meta.fullName ?? ''), phone: meta.phone || null,
          accept_terms: agreeTerms, accept_waiver: agreeWaiver,
        })
      })
      if (res.status === 404) { setStudioNotFound(true); return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const message: string = data?.error ?? ''
        if (message.includes('Terms & Conditions') || message.includes('Liability Waiver')) {
          setWaiverLoading(true)
          try {
            const waiverRes = await fetch(`${apiUrl}/api/public/${studioSlug}/liability-waiver`)
            if (waiverRes.ok) setWaiverInfo(await waiverRes.json())
          } finally {
            setWaiverLoading(false)
          }
          setPendingAuth({ token, meta })
          setAgreementsError('')
          setNeedsAgreements(true)
          return
        }
        setPortalError("Couldn't sign you in to this studio. Please try again.")
        return
      }
      const member = await res.json()
      setNeedsAgreements(false)
      setOrgId(member.organisation_id)
    } catch {
      setPortalError("Couldn't reach the server. Please check your connection and try again.")
    }
  }, [apiUrl, studioSlug, agreeTerms, agreeWaiver])

  const handleAcceptAgreements = async () => {
    if (!pendingAuth) return
    setAgreementsBusy(true)
    try {
      await resolveMembership(pendingAuth.token, pendingAuth.meta)
    } finally {
      setAgreementsBusy(false)
    }
  }

  // Initial auth check — resume an existing session (including one just verified via /auth/callback)
  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session && isSessionExpiredByPolicy()) {
          // "Keep me signed in" was off and the session cap has passed — drop back to the gate.
          await supabase.auth.signOut()
          clearRememberChoice()
        } else if (session) {
          setAccessToken(session.access_token)
          const meta = session.user.user_metadata as { full_name?: string; phone?: string } | undefined
          await resolveMembership(session.access_token, { fullName: meta?.full_name, phone: meta?.phone })
        }
      } finally {
        setChecking(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Studio waiver text for the Privacy & policies tab (public endpoint, no auth).
  useEffect(() => {
    if (!studioSlug || waiverInfo) return
    fetch(`${apiUrl}/api/public/${studioSlug}/liability-waiver`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setWaiverInfo(d) })
      .catch(() => {})
  }, [apiUrl, studioSlug, waiverInfo])

  // Once orgId is known, load studio branding + all portal data
  useEffect(() => {
    if (!orgId) return
    const loadAll = async () => {
      setDataLoading(true)
      try {
        const [orgRes, profileRes, bookingsRes, waitlistRes, passesRes, ledgerRes, paymentsRes] = await Promise.all([
          fetch(`${apiUrl}/api/organisations/${orgId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          authedFetch('/members/me'),
          authedFetch('/members/me/bookings'),
          authedFetch('/members/me/waitlist'),
          authedFetch('/members/me/passes'),
          authedFetch('/members/me/ledger'),
          authedFetch('/members/me/payments'),
        ])
        if (orgRes.ok) setOrg(await orgRes.json())
        if (profileRes.ok) {
          const p: Profile = await profileRes.json()
          setProfile(p)
          setProfileForm({
            first_name: p.first_name ?? '',
            last_name: p.last_name ?? '',
            phone: p.phone ?? '',
            date_of_birth: p.date_of_birth ?? '',
            emergency_contact_name: p.emergency_contact_name ?? '',
            emergency_contact_phone: p.emergency_contact_phone ?? '',
            address: p.address ?? '',
            person_type: p.person_type ?? '',
            gender: p.gender ?? '',
          })
        }
        if (bookingsRes.ok) setBookings(await bookingsRes.json())
        if (waitlistRes.ok) setWaitlist(await waitlistRes.json())
        if (passesRes.ok) setPasses(await passesRes.json())
        if (ledgerRes.ok) setLedger(await ledgerRes.json())
        if (paymentsRes.ok) setPayments(await paymentsRes.json())
      } catch {
        setPortalError("Couldn't load your account data. Please refresh and try again.")
      } finally {
        setDataLoading(false)
      }
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const handleSignIn = async () => {
    setAuthBusy(true)
    setAuthMessage('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setAuthMessage(error.message); setAuthBusy(false); return }
    setRememberChoice(rememberMe)
    setAccessToken(data.session.access_token)
    const meta = data.session.user.user_metadata as { full_name?: string; phone?: string } | undefined
    await resolveMembership(data.session.access_token, { fullName: meta?.full_name, phone: meta?.phone })
    setAuthBusy(false)
  }

  const handleSignUp = async () => {
    if (!fullName.trim()) { setAuthMessage('Your name is required.'); return }
    setAuthBusy(true)
    setAuthMessage('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, phone: phone || null },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${studioPath(studioSlug, '/account')}`,
      },
    })
    if (error) { setAuthMessage(error.message); setAuthBusy(false); return }
    if (data.session) {
      setAccessToken(data.session.access_token)
      await resolveMembership(data.session.access_token, { fullName, phone })
    } else {
      setAuthMessage('Check your email for a verification link to finish signing up!')
    }
    setAuthBusy(false)
  }

  const handleForgotPassword = async () => {
    if (authBusy) return
    if (!email.trim()) { setAuthMessage('Enter your email address first, then tap "Forgot password?".'); return }
    setAuthBusy(true)
    setAuthMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    })
    // Neutral wording either way — don't reveal whether the address is registered.
    setAuthMessage(error ? error.message : `Check your email — if an account exists for ${email}, a reset link is on its way.`)
    setAuthBusy(false)
  }

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (authMode === 'signin') handleSignIn()
    else handleSignUp()
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileSaved(false)
    try {
      const res = await authedFetch('/members/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone || null,
          date_of_birth: profileForm.date_of_birth || null,
          emergency_contact_name: profileForm.emergency_contact_name || null,
          emergency_contact_phone: profileForm.emergency_contact_phone || null,
          address: profileForm.address || null,
          person_type: profileForm.person_type || null,
          gender: profileForm.gender || null,
        })
      })
      if (res.ok) { setProfile(await res.json()); setProfileSaved(true) }
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCancelBooking = async (id: string) => {
    setCancellingId(id)
    setCancelError('')
    try {
      const res = await authedFetch(`/members/me/bookings/${id}/cancel`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setBookings(prev => prev.map(b => b.id === id ? updated : b))
      } else {
        const body = await res.json().catch(() => null)
        setCancelError(body?.error ?? "Couldn't cancel this booking.")
      }
    } catch {
      setCancelError("Couldn't reach the server. Please try again.")
    } finally {
      setCancellingId('')
    }
  }

  const handleLeaveWaitlist = async (id: string) => {
    setLeavingWaitlistId(id)
    setWaitlistActionError('')
    try {
      const res = await authedFetch(`/waitlist/${id}/leave`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setWaitlist(prev => prev.map(w => w.id === id ? updated : w))
      } else {
        const body = await res.json().catch(() => null)
        setWaitlistActionError(body?.error ?? "Couldn't leave the waitlist.")
      }
    } catch {
      setWaitlistActionError("Couldn't reach the server. Please try again.")
    } finally {
      setLeavingWaitlistId('')
    }
  }

  // Guests aren't re-collected here — the group size was fixed at join time (intended_guest_count)
  // and this account tab has no per-guest name capture UI, so each guest just gets a generic label,
  // same spirit as BookingDrawer's "{member} - Guest N" default.
  const handleClaimWaitlist = async (entry: WaitlistEntry) => {
    setClaimingWaitlistId(entry.id)
    setWaitlistActionError('')
    try {
      const res = await authedFetch(`/waitlist/${entry.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: entry.token,
          guests: Array.from({ length: entry.intended_guest_count }, (_, i) => ({
            first_name: `Guest ${i + 1}`, last_name: null, email: null,
          })),
        })
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.booked) {
        const [wlRes, bkRes] = await Promise.all([authedFetch('/members/me/waitlist'), authedFetch('/members/me/bookings')])
        if (wlRes.ok) setWaitlist(await wlRes.json())
        if (bkRes.ok) setBookings(await bkRes.json())
        setTab('upcoming')
      } else if (res.ok && !data?.booked) {
        setWaitlistActionError("You'll need an eligible pass to claim this spot — buy one from the booking page, then come back and claim again before your hold expires.")
      } else {
        setWaitlistActionError(data?.error ?? "Couldn't claim this spot.")
      }
    } catch {
      setWaitlistActionError("Couldn't reach the server. Please try again.")
    } finally {
      setClaimingWaitlistId('')
    }
  }

  const handleDownloadReceipt = async (paymentId: string) => {
    setDownloadingReceiptId(paymentId)
    setReceiptError('')
    try {
      const res = await authedFetch(`/members/me/payments/${paymentId}/receipt`)
      if (!res.ok) { setReceiptError("Couldn't download this receipt."); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${paymentId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setReceiptError("Couldn't reach the server. Please try again.")
    } finally {
      setDownloadingReceiptId('')
    }
  }

  const brand = org?.brand_color || '#085041'

  const now = Date.now()
  const isUpcoming = (b: Booking) =>
    b.status === 'confirmed' && !!b.session_occurrence && new Date(b.session_occurrence.starts_at).getTime() > now
  const upcomingBookings = bookings
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.session_occurrence!.starts_at).getTime() - new Date(b.session_occurrence!.starts_at).getTime())
  const pastBookings = bookings
    .filter(b => !isUpcoming(b))
    .sort((a, b) =>
      new Date(b.session_occurrence?.starts_at ?? b.booked_at).getTime() -
      new Date(a.session_occurrence?.starts_at ?? a.booked_at).getTime())

  // Waitlisted "bookings" live in the Upcoming list too — no separate tab.
  const activeWaitlist = waitlist
    .filter(w => w.status === 'waiting' || w.status === 'promoted')
    .sort((a, b) =>
      new Date(a.session_occurrence?.starts_at ?? 0).getTime() -
      new Date(b.session_occurrence?.starts_at ?? 0).getTime())

  const nextStartsAt = upcomingBookings[0]?.session_occurrence?.starts_at
  const daysToNext = nextStartsAt ? Math.ceil((new Date(nextStartsAt).getTime() - now) / 86_400_000) : null
  const nextClassLabel = daysToNext == null ? null
    : daysToNext <= 0 ? 'Today'
    : daysToNext === 1 ? 'Tomorrow'
    : `In ${daysToNext} days`

  const renderWaitlistRow = (w: WaitlistEntry) => {
    const holdExpired = w.status === 'promoted' && (!w.token_expires_at || new Date(w.token_expires_at) <= new Date())
    const occ = w.session_occurrence
    return (
      <div key={w.id} style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
              {occ?.session?.name ?? 'Session'}
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-meta)' }}>
              {occ ? `${formatShortDate(occ.starts_at, org?.timezone)} · ${timeRange(occ.starts_at, occ.ends_at, org?.timezone)}` : '—'}
              {w.preferred_mode === 'online' ? ' · Online' : ' · In person'}
              {w.intended_guest_count > 0 ? ` · ${w.intended_guest_count + 1} spots` : ''}
            </div>
            {w.status === 'waiting' && (
              <div style={{ fontSize: '15px', color: 'var(--text-warn)', marginTop: '4px' }}>You&apos;re #{w.position} in line</div>
            )}
            {w.status === 'promoted' && !holdExpired && (
              <div style={{ fontSize: '15px', color: 'var(--ink)', marginTop: '4px', fontWeight: 600 }}>
                A spot opened — claim by {w.token_expires_at ? formatDateTime(w.token_expires_at, org?.timezone) : 'soon'}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <StatusBadge status={holdExpired ? 'expired' : w.status === 'waiting' ? 'waitlisted' : w.status} />
            {w.status === 'promoted' && !holdExpired && (
              <button
                onClick={() => handleClaimWaitlist(w)}
                disabled={claimingWaitlistId === w.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 16px', backgroundColor: claimingWaitlistId === w.id ? 'rgba(245,244,241,0.3)' : brand, color: 'white',
                  border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: claimingWaitlistId === w.id ? 'default' : 'pointer'
                }}
              >
                {claimingWaitlistId === w.id ? 'Claiming…' : 'Claim my spot'}
              </button>
            )}
            <button
              onClick={() => handleLeaveWaitlist(w.id)}
              disabled={leavingWaitlistId === w.id}
              style={{
                minHeight: '44px', padding: '0 16px', backgroundColor: 'transparent', border: '1px solid var(--danger)',
                borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: 'var(--danger)'
              }}
            >
              {leavingWaitlistId === w.id ? 'Leaving…' : 'Leave waitlist'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderBookingRow = (b: Booking, upcoming: boolean) => {
    const occ = b.session_occurrence
    const sess = occ?.session
    const join = upcoming && b.booked_mode === 'online' && occ ? onlineJoin(occ) : null
    return (
      <div key={b.id} style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {sess?.name ?? 'Session'}
            {b.guest_count > 0 && (
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-warn)', backgroundColor: 'var(--warn-bg)', borderRadius: '999px', padding: '2px 8px' }}>
                +{b.guest_count} guest{b.guest_count > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ fontSize: '15px', color: 'var(--text-meta)' }}>
            {occ ? `${formatShortDate(occ.starts_at, org?.timezone)} · ${timeRange(occ.starts_at, occ.ends_at, org?.timezone)}` : '—'}
            {b.booked_mode === 'online' ? ' · Online' : ' · In person'}
          </div>
          {b.booked_mode !== 'online' && sess?.location_name && (
            <div style={{ fontSize: '14px', color: 'var(--text-label)', marginTop: '2px' }}>
              {sess.location_name}{sess.location_address ? ` · ${sess.location_address}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <StatusBadge status={b.status} />
          {join?.kind === 'link' && (
            <a
              href={join.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 16px', backgroundColor: brand, color: 'white', borderRadius: '6px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
            >
              Join
            </a>
          )}
          {join?.kind === 'note' && (
            <span style={{ fontSize: '13px', color: 'var(--text-label)' }}>{join.text}</span>
          )}
          {upcoming && b.status === 'confirmed' && (
            <button
              onClick={() => handleCancelBooking(b.id)}
              disabled={cancellingId === b.id}
              style={{
                minHeight: '44px', padding: '0 16px', backgroundColor: 'transparent', border: '1px solid var(--danger)',
                borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: 'var(--danger)'
              }}
            >
              {cancellingId === b.id ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
        {upcoming && <CalendarLinks compact icsUrl={b.calendar_ics_url} googleUrl={b.calendar_google_url} />}
      </div>
    )
  }

  const emptyPanel = (text: string) => (
    <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
      <div style={{ color: 'var(--text-meta)', fontSize: '14px', marginBottom: '16px' }}>{text}</div>
      <a
        href={studioPath(studioSlug)}
        style={{ display: 'inline-block', padding: '9px 20px', backgroundColor: brand, color: 'white', borderRadius: '8px', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}
      >
        Go to schedule
      </a>
    </div>
  )

  if (checking) {
    return (
      <div className={pf.root} style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-meta)' }}>Loading...</div>
      </div>
    )
  }

  if (studioNotFound) {
    return (
      <div className={pf.root} style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', background: 'var(--bg)' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Studio not found</h1>
          <p style={{ color: 'var(--text-meta)', fontSize: '14px' }}>There's no studio at &quot;{studioSlug}&quot;.</p>
        </div>
      </div>
    )
  }

  // ── Signed in, but this studio needs Terms/Waiver acceptance before registration completes ──
  if (needsAgreements) {
    const canContinue = agreeTerms && (!waiverInfo?.required || agreeWaiver)
    return (
      <div className={pf.root} style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
        <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px', border: '1px solid var(--line-strong)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Before you continue</h1>
          <p style={{ color: 'var(--text-meta)', fontSize: '14px', marginBottom: '20px' }}>
            Please review and accept the following to finish signing up.
          </p>

          {waiverLoading ? (
            <p style={{ color: 'var(--text-meta)', fontSize: '14px' }}>Loading...</p>
          ) : (
            <>
              {waiverInfo?.text && (
                <div style={{
                  border: '1px solid var(--line-chip)', borderRadius: '8px', padding: '14px', marginBottom: '16px',
                  maxHeight: '180px', overflowY: 'auto', fontSize: '15px', color: 'var(--text-body)', whiteSpace: 'pre-wrap'
                }}>
                  {waiverInfo.text}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '15px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ marginTop: '2px' }} />
                  I accept the Terms &amp; Conditions
                </label>
                {waiverInfo?.required && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '15px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreeWaiver} onChange={e => setAgreeWaiver(e.target.checked)} style={{ marginTop: '2px' }} />
                    I accept the Liability Waiver
                  </label>
                )}
              </div>

              {agreementsError && (
                <div style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px', marginBottom: '16px' }}>
                  {agreementsError}
                </div>
              )}

              <button
                onClick={handleAcceptAgreements}
                disabled={agreementsBusy || !canContinue}
                style={{
                  width: '100%', padding: '12px', backgroundColor: agreementsBusy || !canContinue ? 'rgba(245,244,241,0.3)' : brand,
                  color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                  cursor: agreementsBusy || !canContinue ? 'not-allowed' : 'pointer'
                }}
              >
                {agreementsBusy ? 'Please wait...' : 'Accept & continue'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Not signed in: auth gate ──────────────────────────────
  if (!accessToken || !orgId) {
    return (
      <div className={pf.root} style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
        <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px', border: '1px solid var(--line-strong)' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
            <p style={{ color: 'var(--text-meta)', marginTop: '6px', fontSize: '14px' }}>
              {authMode === 'signin' ? 'Sign in to manage your bookings and passes' : 'Book classes and manage your passes'}
            </p>
          </div>

          {portalError && (
            <div style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px', marginBottom: '16px' }}>
              {portalError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {authMode === 'signup' && (
              <div>
                <label style={labelStyle}>Full name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
            {authMode === 'signup' && (
              <div>
                <label style={labelStyle}>Phone (optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </div>

            {authMode === 'signin' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: 'var(--text-meta)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--ink)', cursor: 'pointer' }}
                />
                Keep me signed in on this device
              </label>
            )}

            <button
              type="submit"
              disabled={authBusy}
              style={{
                padding: '12px', backgroundColor: authBusy ? 'rgba(245,244,241,0.3)' : brand, color: 'white', border: 'none',
                borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: authBusy ? 'default' : 'pointer', marginTop: '4px'
              }}
            >
              {authBusy ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            {authMode === 'signin' && (
              <p style={{ textAlign: 'center', marginTop: '-2px' }}>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={authBusy}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: brand, fontSize: '14px', fontWeight: 600,
                    cursor: authBusy ? 'default' : 'pointer',
                  }}
                >
                  Forgot password?
                </button>
              </p>
            )}

            {authMessage && (
              <div style={{
                padding: '12px', borderRadius: '8px', fontSize: '15px', textAlign: 'center',
                backgroundColor: authMessage.includes('Check your email') ? 'rgba(245,244,241,0.08)' : 'rgba(214,120,120,0.16)',
                color: authMessage.includes('Check your email') ? 'var(--text-body)' : 'var(--danger)',
              }}>
                {authMessage}
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: '15px', color: 'var(--text-meta)', marginTop: '4px' }}>
              {authMode === 'signin' ? (
                <>New here? <button type="button" onClick={() => { setAuthMode('signup'); setAuthMessage('') }} style={{ background: 'none', border: 'none', color: brand, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Create an account</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => { setAuthMode('signin'); setAuthMessage('') }} style={{ background: 'none', border: 'none', color: brand, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Sign in</button></>
              )}
            </p>
          </form>
        </div>
      </div>
    )
  }

  // ── Signed in: portal ──────────────────────────────────────
  return (
    <div className={pf.root} style={{ minHeight: 'calc(100vh - 57px)', background: 'var(--bg)' }}>
      <div className={styles.layout}>
        <nav className={styles.nav}>
          {(['upcoming', 'past', 'passes', 'payments'] as const).map(t => (
            <button
              key={t}
              onClick={() => chooseTab(t)}
              className={`${styles.navItem} ${tab === t ? styles.navItemActive : ''}`}
            >
              {t === 'upcoming' ? 'Upcoming' : t === 'past' ? 'Past bookings' : t === 'passes' ? 'My passes' : t === 'payments' ? 'Order history' : t === 'policies' ? 'Privacy & policies' : 'Profile'}
            </button>
          ))}
        </nav>

        <div className={styles.body}>
        {profile && (
          // One row of equal columns, so the stats never wrap onto a second line on a phone.
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, max-content)', marginBottom: '22px' }}>
            {[
              { label: 'Member since', value: formatDayMonth(profile.join_date) },
              { label: 'Bookings', value: String(bookings.length) },
              ...(nextClassLabel ? [{ label: 'Next class', value: nextClassLabel }] : []),
            ].map((s, i) => (
              <div key={s.label} style={{ paddingRight: 'clamp(14px, 4vw, 28px)', ...(i === 0 ? {} : { borderLeft: '1px solid var(--line-chip)', paddingLeft: 'clamp(14px, 4vw, 28px)' }) }}>
                <div style={{ fontSize: '13px', color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {portalError && (
          <div style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px', marginBottom: '16px' }}>
            {portalError}
          </div>
        )}

        {dataLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-meta)' }}>Loading...</div>
        ) : (
          <>
            {(tab === 'profile' || tab === 'policies') && (
              <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
                {tab === 'profile' ? 'Profile' : 'Privacy & policies'}
              </h2>
            )}

            {tab === 'profile' && profile && (
              <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '15px', color: 'var(--text-meta)' }}>{profile.email}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-label)', marginTop: '2px' }}>
                      Member since {formatDayMonth(profile.join_date)} · {profile.total_sessions_attended} session{profile.total_sessions_attended !== 1 ? 's' : ''} attended
                    </div>
                  </div>
                </div>

                <div className={styles.formGrid} style={{ marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>First name</label>
                    <input type="text" value={profileForm.first_name} onChange={e => setProfileForm(p => ({ ...p, first_name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Last name</label>
                    <input type="text" value={profileForm.last_name} onChange={e => setProfileForm(p => ({ ...p, last_name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle} />
                  </div>
                </div>

                <div className={styles.formGrid} style={{ marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Date of birth</label>
                    <input type="date" value={profileForm.date_of_birth} onChange={e => setProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Gender</label>
                    <select value={profileForm.gender} onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))} style={inputStyle}>
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGrid} style={{ marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Emergency contact name</label>
                    <input type="text" value={profileForm.emergency_contact_name} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Emergency contact phone</label>
                    <input type="tel" value={profileForm.emergency_contact_phone} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_phone: e.target.value }))} style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Address</label>
                  <input type="text" value={profileForm.address} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))} style={inputStyle} />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  style={{
                    padding: '10px 24px', backgroundColor: savingProfile ? 'rgba(245,244,241,0.3)' : brand, color: 'white', border: 'none',
                    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: savingProfile ? 'default' : 'pointer'
                  }}
                >
                  {savingProfile ? 'Saving...' : 'Save changes'}
                </button>
                {profileSaved && <span style={{ marginLeft: '12px', fontSize: '15px', color: 'var(--ink)' }}>Saved.</span>}

                <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>Password</div>
                  <p style={{ fontSize: '15px', color: 'var(--text-meta)', margin: 0 }}>
                    To change your password, sign out and use{' '}
                    <span style={{ fontWeight: 600 }}>&ldquo;Forgot password?&rdquo;</span> on the sign-in screen. We&apos;ll email you a secure reset link.
                  </p>
                </div>
              </div>
            )}

            {tab === 'upcoming' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cancelError && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px' }}>
                    {cancelError}
                  </div>
                )}
                {waitlistActionError && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px' }}>
                    {waitlistActionError}
                  </div>
                )}
                {upcomingBookings.length === 0 && activeWaitlist.length === 0
                  ? emptyPanel('No upcoming bookings.')
                  : (
                    <>
                      {upcomingBookings.map(b => renderBookingRow(b, true))}
                      {activeWaitlist.map(renderWaitlistRow)}
                    </>
                  )}
              </div>
            )}

            {tab === 'past' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pastBookings.length === 0
                  ? emptyPanel('No past bookings.')
                  : pastBookings.map(b => renderBookingRow(b, false))}
              </div>
            )}


            {tab === 'passes' && (() => {
              // Passes you can still use first (soonest expiry first), then used-up and expired ones.
              const usable = (p: Pass) => p.status === 'active' || p.status === 'low' || p.status === 'frozen'
              const sorted = [...passes].sort((a, b) =>
                Number(usable(b)) - Number(usable(a)) ||
                (usable(a) ? (a.expires_at ?? '9').localeCompare(b.expires_at ?? '9') : (b.expires_at ?? '').localeCompare(a.expires_at ?? '')))
              const firstPast = sorted.findIndex(p => !usable(p))
              const headline = (p: Pass) =>
                p.credits_remaining === null ? 'Unlimited classes'
                  : p.status === 'exhausted' || p.credits_remaining === 0 ? `All ${p.credits_total} class${p.credits_total === 1 ? '' : 'es'} used`
                  : `${p.credits_remaining} of ${p.credits_total} class${p.credits_total === 1 ? '' : 'es'} left`
              const when = (p: Pass) => {
                if (!p.expires_at) return 'No expiry'
                const d = formatDayMonth(p.expires_at)
                if (p.effective_from && new Date(p.effective_from) > new Date()) return `Starts ${formatDayMonth(p.effective_from)} · expires ${d}`
                return p.status === 'expired' ? `Expired ${d}` : `Expires ${d}`
              }
              return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passes.length === 0 ? (
                  <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '48px', textAlign: 'center', color: 'var(--text-meta)', fontSize: '15px' }}>
                    No passes yet.
                  </div>
                ) : sorted.map((p, idx) => {
                  const isCredit = p.credits_total !== null
                  const open = expandedPassId === p.id
                  const entries = ledger.filter(e => e.member_pass_id === p.id)
                  const past = !usable(p)
                  return (
                    <div key={p.id} style={{ display: 'contents' }}>
                    {idx === firstPast && (
                      <div style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-label)', margin: idx ? '12px 0 0' : 0 }}>
                        Used up and expired
                      </div>
                    )}
                    <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', overflow: 'hidden', opacity: past ? 0.75 : 1 }}>
                      <button
                        type="button"
                        onClick={isCredit ? () => setExpandedPassId(open ? null : p.id) : undefined}
                        aria-expanded={isCredit ? open : undefined}
                        disabled={!isCredit}
                        style={{
                          width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none', border: 0,
                          padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                          gap: '12px', cursor: isCredit ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '15px', color: 'var(--text-meta)', marginBottom: '4px' }}>
                            {p.pass_template?.name ?? 'Pass'}
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>{headline(p)}</div>
                          <div style={{ fontSize: '15px', color: 'var(--text-meta)', marginTop: '4px' }}>{when(p)}</div>
                          {isCredit && (
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '10px', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                              {open ? 'Hide history' : 'Show history'}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={p.status} />
                      </button>

                      {open && (
                        <div style={{ borderTop: '1px solid var(--line)' }}>
                          {entries.length === 0 ? (
                            <div style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--text-label)', fontSize: '15px' }}>No credit activity on this pass yet.</div>
                          ) : entries.map((entry, i) => (
                            <div key={entry.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px',
                              borderBottom: i < entries.length - 1 ? '1px solid var(--line)' : 'none', gap: '12px', flexWrap: 'wrap',
                            }}>
                              <div>
                                <div style={{ fontSize: '15px', fontWeight: 500 }}>{movementLabels[entry.movement_type] ?? entry.movement_type}</div>
                                <div style={{ fontSize: '14px', color: 'var(--text-label)' }}>{formatDateTime(entry.created_at, org?.timezone)}</div>
                                {entry.notes && <div style={{ fontSize: '14px', color: 'var(--text-meta)', marginTop: '2px' }}>{entry.notes}</div>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: entry.credits_delta >= 0 ? 'var(--ink)' : 'var(--danger)' }}>
                                  {entry.credits_delta >= 0 ? '+' : ''}{entry.credits_delta}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-label)' }}>balance: {entry.credits_after}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </div>
                  )
                })}
              </div>
              )
            })()}

            {tab === 'payments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {receiptError && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px' }}>
                    {receiptError}
                  </div>
                )}
                {payments.length === 0 ? (
                  <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '48px', textAlign: 'center', color: 'var(--text-meta)', fontSize: '14px' }}>
                    No payments yet.
                  </div>
                ) : payments.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setInvoicePayment(p)}
                    style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        {paymentTypeLabels[p.payment_type] ?? p.payment_type}
                        <span style={{ fontWeight: 400, color: 'var(--text-label)', marginLeft: '8px' }}>{formatMoney(p.amount, p.currency)}</span>
                      </div>
                      <div style={{ fontSize: '15px', color: 'var(--text-meta)' }}>
                        {formatDateTime(p.created_at, org?.timezone)}{p.invoice_number ? ` · Invoice ${p.invoice_number}` : ''}
                      </div>
                      {p.refunded_amount > 0 && (
                        <div style={{ fontSize: '14px', color: 'var(--danger)', marginTop: '2px' }}>
                          {p.status === 'refunded' ? 'Fully refunded' : `Refunded ${formatMoney(p.refunded_amount, p.currency)}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <StatusBadge status={p.status} />
                      {p.status === 'succeeded' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDownloadReceipt(p.id) }}
                          disabled={downloadingReceiptId === p.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 16px', backgroundColor: 'transparent', border: '1px solid var(--line-chip)',
                            borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-body)'
                          }}
                        >
                          {downloadingReceiptId === p.id ? 'Downloading...' : 'Download receipt'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'policies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>Terms &amp; Conditions</div>
                  <p style={{ fontSize: '15px', color: 'var(--text-meta)', margin: '0 0 12px' }}>
                    The CalaStudio platform terms you agreed to when you created your account.
                  </p>
                  <a
                    href="https://calastudio.app/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '15px', fontWeight: 600, color: brand }}
                  >
                    Read the Terms &amp; Conditions →
                  </a>
                </div>

                <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                    {org?.name ? `${org.name} Liability Waiver` : 'Liability Waiver'}
                  </div>
                  {waiverInfo === null ? (
                    <p style={{ fontSize: '15px', color: 'var(--text-label)', margin: 0 }}>Loading…</p>
                  ) : waiverInfo.text ? (
                    <>
                      <div style={{
                        fontSize: '15px', color: 'var(--text-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '14px',
                      }}>
                        {waiverInfo.text}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-label)', margin: '8px 0 0' }}>Version {waiverInfo.version}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: '15px', color: 'var(--text-label)', margin: 0 }}>This studio hasn&apos;t published a liability waiver.</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {invoicePayment && (() => {
        const p = invoicePayment
        const label = paymentTypeLabels[p.payment_type] ?? p.payment_type
        return (
          <div
            onClick={() => setInvoicePayment(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}
          >
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>{label}</div>
                  <div style={{ marginTop: '4px' }}><StatusBadge status={p.status} /></div>
                </div>
                <button onClick={() => setInvoicePayment(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-meta)' }}>×</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', rowGap: '6px', columnGap: '16px', fontSize: '15px', marginBottom: '16px' }}>
                {p.invoice_number && (<><span style={{ color: 'var(--text-label)' }}>Invoice number</span><span style={{ fontWeight: 600 }}>{p.invoice_number}</span></>)}
                <span style={{ color: 'var(--text-label)' }}>Date</span><span>{formatDateTime(p.created_at, org?.timezone)}</span>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', fontSize: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{label}</span><span>{formatMoney(p.subtotal || p.amount, p.currency)}</span>
                </div>
                {p.tax_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--text-meta)' }}>
                    <span>{p.tax_name || 'Tax'}</span><span>{formatMoney(p.tax_amount, p.currency)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: '4px', borderTop: '1px solid var(--line)', fontWeight: 700 }}>
                  <span>Total</span><span>{formatMoney(p.amount, p.currency)}</span>
                </div>
                {p.refunded_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', color: 'var(--danger)' }}>
                    <span>Refunded{p.refund_reason ? ` — ${p.refund_reason}` : ''}</span>
                    <span>−{formatMoney(p.refunded_amount, p.currency)}</span>
                  </div>
                )}
              </div>

              {p.status === 'succeeded' && (
                <button
                  onClick={() => handleDownloadReceipt(p.id)}
                  disabled={downloadingReceiptId === p.id}
                  style={{ marginTop: '18px', width: '100%', padding: '10px', backgroundColor: brand, color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {downloadingReceiptId === p.id ? 'Downloading…' : 'Download receipt (PDF)'}
                </button>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
