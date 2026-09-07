'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { splitName } from '@/lib/names'
import { formatDate, formatDateTimeWithWeekday } from '@/lib/dates'
import styles from './account.module.css'

interface OrgInfo {
  id: string
  name: string
  logo_url: string | null
  brand_color: string | null
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
  cancellation_reason: string | null
  session_occurrence: {
    starts_at: string
    ends_at: string
    meeting_url: string | null
    session: { name: string; session_type: string; delivery_mode: string } | null
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
  currency: string
  refunded_amount: number
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
  width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '14px', outline: 'none', backgroundColor: 'white'
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#e8f5ee', color: '#085041', label: 'Active' },
    low: { bg: '#fff3cd', color: '#7a4f00', label: 'Low' },
    frozen: { bg: '#e8eef8', color: '#1B4F8A', label: 'Frozen' },
    expired: { bg: '#f4f4f4', color: '#666', label: 'Expired' },
    exhausted: { bg: '#fdecea', color: '#8b1a1a', label: 'Exhausted' },
    confirmed: { bg: '#e8f5ee', color: '#085041', label: 'Confirmed' },
    attended: { bg: '#e8eef8', color: '#1B4F8A', label: 'Attended' },
    cancelled: { bg: '#f4f4f4', color: '#666', label: 'Cancelled' },
    late_cancel: { bg: '#fdecea', color: '#8b1a1a', label: 'Late cancel' },
    waitlisted: { bg: '#fff3cd', color: '#7a4f00', label: 'Waitlisted' },
    pending: { bg: '#fff3cd', color: '#7a4f00', label: 'Pending' },
    succeeded: { bg: '#e8f5ee', color: '#085041', label: 'Paid' },
    failed: { bg: '#fdecea', color: '#8b1a1a', label: 'Failed' },
    refunded: { bg: '#f4f4f4', color: '#666', label: 'Refunded' },
    partially_refunded: { bg: '#f4f4f4', color: '#666', label: 'Partially refunded' },
    waiting: { bg: '#fff3cd', color: '#7a4f00', label: 'Waiting' },
    promoted: { bg: '#e8f5ee', color: '#085041', label: 'Spot ready' },
    booked: { bg: '#e8f5ee', color: '#085041', label: 'Booked' },
    removed: { bg: '#f4f4f4', color: '#666', label: 'Left' },
  }
  const s = map[status]
  if (!s) return null // no_show and any unknown status carry no badge
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

function formatDateTime(iso: string) {
  return formatDateTimeWithWeekday(iso)
}

export default function MemberAccountPage() {
  const params = useParams()
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
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  // Resolved membership
  const [orgId, setOrgId] = useState('')
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [studioNotFound, setStudioNotFound] = useState(false)
  const [portalError, setPortalError] = useState('')

  const [tab, setTab] = useState<'bookings' | 'waitlist' | 'passes' | 'payments' | 'profile'>('bookings')
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
        if (session) {
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
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/${studioSlug}/account`,
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
        setTab('bookings')
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

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setAccessToken(''); setOrgId(''); setOrg(null); setProfile(null)
  }

  const brand = org?.brand_color || '#085041'

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    )
  }

  if (studioNotFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Studio not found</h1>
          <p style={{ color: '#666', fontSize: '14px' }}>There's no studio at &quot;{studioSlug}&quot;.</p>
        </div>
      </div>
    )
  }

  // ── Signed in, but this studio needs Terms/Waiver acceptance before registration completes ──
  if (needsAgreements) {
    const canContinue = agreeTerms && (!waiverInfo?.required || agreeWaiver)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4', padding: '24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Before you continue</h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
            Please review and accept the following to finish signing up.
          </p>

          {waiverLoading ? (
            <p style={{ color: '#666', fontSize: '14px' }}>Loading...</p>
          ) : (
            <>
              {waiverInfo?.text && (
                <div style={{
                  border: '1px solid #e2e2e2', borderRadius: '8px', padding: '14px', marginBottom: '16px',
                  maxHeight: '180px', overflowY: 'auto', fontSize: '13px', color: '#444', whiteSpace: 'pre-wrap'
                }}>
                  {waiverInfo.text}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ marginTop: '2px' }} />
                  I accept the Terms &amp; Conditions
                </label>
                {waiverInfo?.required && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreeWaiver} onChange={e => setAgreeWaiver(e.target.checked)} style={{ marginTop: '2px' }} />
                    I accept the Liability Waiver
                  </label>
                )}
              </div>

              {agreementsError && (
                <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
                  {agreementsError}
                </div>
              )}

              <button
                onClick={handleAcceptAgreements}
                disabled={agreementsBusy || !canContinue}
                style={{
                  width: '100%', padding: '12px', backgroundColor: agreementsBusy || !canContinue ? '#9fd6b8' : brand,
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4', padding: '24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
            <p style={{ color: '#666', marginTop: '6px', fontSize: '14px' }}>
              {authMode === 'signin' ? 'Sign in to manage your bookings and passes' : 'Book classes and manage your passes'}
            </p>
          </div>

          {portalError && (
            <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
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
              {authMode === 'signin' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={authBusy}
                  style={{
                    background: 'none', border: 'none', padding: 0, marginTop: '6px',
                    color: brand, fontSize: '12px', fontWeight: 600,
                    cursor: authBusy ? 'default' : 'pointer',
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={authBusy}
              style={{
                padding: '12px', backgroundColor: authBusy ? '#9fd6b8' : brand, color: 'white', border: 'none',
                borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: authBusy ? 'default' : 'pointer', marginTop: '4px'
              }}
            >
              {authBusy ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            {authMessage && (
              <div style={{
                padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center',
                backgroundColor: authMessage.includes('Check your email') ? '#e8f5ee' : '#fdecea',
                color: authMessage.includes('Check your email') ? '#085041' : '#8b1a1a',
              }}>
                {authMessage}
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#666', marginTop: '4px' }}>
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e2e2', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <Link
          href={`/${studioSlug}`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}
        >
          {org?.logo_url ? (
            <img src={org.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: '6px', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '6px', backgroundColor: brand }} />
          )}
          <span style={{ fontWeight: 700, fontSize: '16px' }}>{org?.name ?? 'My account'}</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href={`/${studioSlug}`}
            style={{ padding: '8px 16px', backgroundColor: brand, color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            Book classes
          </Link>
          <button
            onClick={handleSignOut}
            style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #e2e2e2', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#666' }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px' }}>
        <div className={styles.tabs}>
          {(['bookings', 'waitlist', 'passes', 'payments', 'profile'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`${styles.tabButton} ${tab === t ? styles.tabButtonActive : ''}`}
            >
              {t === 'bookings' ? 'My bookings' : t === 'waitlist' ? 'My waitlist' : t === 'passes' ? 'My passes' : t === 'payments' ? 'Payments' : 'Profile'}
            </button>
          ))}
        </div>

        {portalError && (
          <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
            {portalError}
          </div>
        )}

        {dataLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#666' }}>Loading...</div>
        ) : (
          <>
            {tab === 'profile' && profile && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#666' }}>{profile.email}</div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                      Member since {formatDate(profile.join_date)} · {profile.total_sessions_attended} session{profile.total_sessions_attended !== 1 ? 's' : ''} attended
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
                    padding: '10px 24px', backgroundColor: savingProfile ? '#9fd6b8' : brand, color: 'white', border: 'none',
                    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: savingProfile ? 'default' : 'pointer'
                  }}
                >
                  {savingProfile ? 'Saving...' : 'Save changes'}
                </button>
                {profileSaved && <span style={{ marginLeft: '12px', fontSize: '13px', color: '#085041' }}>Saved.</span>}
              </div>
            )}

            {tab === 'bookings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cancelError && (
                  <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                    {cancelError}
                  </div>
                )}
                {bookings.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                    No bookings yet.
                  </div>
                ) : bookings.map(b => (
                  <div key={b.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        {b.session_occurrence?.session?.name ?? 'Session'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        {b.session_occurrence ? formatDateTime(b.session_occurrence.starts_at) : '—'}
                        {b.booked_mode === 'online' ? ' · Online' : ' · In person'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <StatusBadge status={b.status} />
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={cancellingId === b.id}
                          style={{
                            padding: '6px 14px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                            borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#8b1a1a'
                          }}
                        >
                          {cancellingId === b.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'waitlist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {waitlistActionError && (
                  <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                    {waitlistActionError}
                  </div>
                )}
                {waitlist.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                    You&apos;re not on any waitlists.
                  </div>
                ) : waitlist.map(w => {
                  const isActive = w.status === 'waiting' || w.status === 'promoted'
                  const holdExpired = w.status === 'promoted' && (!w.token_expires_at || new Date(w.token_expires_at) <= new Date())
                  return (
                    <div key={w.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', opacity: isActive ? 1 : 0.7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                            {w.session_occurrence?.session?.name ?? 'Session'}
                          </div>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            {w.session_occurrence ? formatDateTime(w.session_occurrence.starts_at) : '—'}
                            {w.intended_guest_count > 0 ? ` · ${w.intended_guest_count + 1} spots` : ''}
                          </div>
                          {w.status === 'waiting' && (
                            <div style={{ fontSize: '13px', color: '#7a4f00', marginTop: '4px' }}>You&apos;re #{w.position} in line</div>
                          )}
                          {w.status === 'promoted' && !holdExpired && (
                            <div style={{ fontSize: '13px', color: '#085041', marginTop: '4px', fontWeight: 600 }}>
                              Your spot is ready — claim by {w.token_expires_at ? formatDateTime(w.token_expires_at) : 'soon'}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <StatusBadge status={holdExpired ? 'expired' : w.status} />
                        </div>
                      </div>

                      {w.status === 'promoted' && !holdExpired && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f4f4f4', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleClaimWaitlist(w)}
                            disabled={claimingWaitlistId === w.id}
                            style={{
                              padding: '8px 16px', backgroundColor: claimingWaitlistId === w.id ? '#9fd6b8' : brand, color: 'white',
                              border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: claimingWaitlistId === w.id ? 'default' : 'pointer'
                            }}
                          >
                            {claimingWaitlistId === w.id ? 'Claiming...' : 'Claim my spot'}
                          </button>
                        </div>
                      )}

                      {isActive && (
                        <div style={{ marginTop: w.status === 'promoted' && !holdExpired ? '10px' : '14px' }}>
                          <button
                            onClick={() => handleLeaveWaitlist(w.id)}
                            disabled={leavingWaitlistId === w.id}
                            style={{
                              padding: '6px 14px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                              borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#8b1a1a'
                            }}
                          >
                            {leavingWaitlistId === w.id ? 'Leaving...' : 'Leave waitlist'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'passes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passes.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                    No passes yet.
                  </div>
                ) : passes.map(p => {
                  const isCredit = p.credits_total !== null
                  const open = expandedPassId === p.id
                  const entries = ledger.filter(e => e.member_pass_id === p.id)
                  return (
                    <div key={p.id} style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <div
                        onClick={isCredit ? () => setExpandedPassId(open ? null : p.id) : undefined}
                        style={{
                          padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          flexWrap: 'wrap', gap: '12px', cursor: isCredit ? 'pointer' : 'default',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                            {isCredit && <span style={{ color: '#999', marginRight: '6px' }}>{open ? '▾' : '▸'}</span>}
                            {p.pass_template?.name ?? 'Pass'}
                            {p.pass_template && <span style={{ fontWeight: 400, color: '#999', marginLeft: '8px' }}>{formatMoney(p.pass_template.price, p.pass_template.currency)}</span>}
                          </div>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            {p.credits_remaining === null ? 'Unlimited' : `${p.credits_remaining} / ${p.credits_total} credits`} · Expires {formatDate(p.expires_at)}
                          </div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>

                      {open && (
                        <div style={{ borderTop: '1px solid #f4f4f4' }}>
                          {entries.length === 0 ? (
                            <div style={{ padding: '16px 20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>No credit activity on this pass yet.</div>
                          ) : entries.map((entry, i) => (
                            <div key={entry.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px',
                              borderBottom: i < entries.length - 1 ? '1px solid #f7f7f7' : 'none', gap: '12px', flexWrap: 'wrap',
                            }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 500 }}>{movementLabels[entry.movement_type] ?? entry.movement_type}</div>
                                <div style={{ fontSize: '12px', color: '#999' }}>{formatDateTime(entry.created_at)}</div>
                                {entry.notes && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{entry.notes}</div>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: entry.credits_delta >= 0 ? '#085041' : '#8b1a1a' }}>
                                  {entry.credits_delta >= 0 ? '+' : ''}{entry.credits_delta}
                                </div>
                                <div style={{ fontSize: '11px', color: '#999' }}>balance: {entry.credits_after}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'payments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {receiptError && (
                  <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                    {receiptError}
                  </div>
                )}
                {payments.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                    No payments yet.
                  </div>
                ) : payments.map(p => (
                  <div key={p.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        {paymentTypeLabels[p.payment_type] ?? p.payment_type}
                        <span style={{ fontWeight: 400, color: '#999', marginLeft: '8px' }}>{formatMoney(p.amount, p.currency)}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>{formatDateTime(p.created_at)}</div>
                      {p.refunded_amount > 0 && (
                        <div style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '2px' }}>
                          {p.status === 'refunded' ? 'Fully refunded' : `Refunded ${formatMoney(p.refunded_amount, p.currency)}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <StatusBadge status={p.status} />
                      {p.status === 'succeeded' && (
                        <button
                          onClick={() => handleDownloadReceipt(p.id)}
                          disabled={downloadingReceiptId === p.id}
                          style={{
                            padding: '6px 14px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                            borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#444'
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
          </>
        )}
      </div>
    </div>
  )
}
