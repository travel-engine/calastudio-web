'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './account.module.css'

interface OrgInfo {
  id: string
  name: string
  logo_url: string | null
  brand_color: string | null
}

interface Profile {
  id: string
  full_name: string
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

interface LedgerEntry {
  id: string
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
    no_show: { bg: '#fdecea', color: '#8b1a1a', label: 'No-show' },
    waitlisted: { bg: '#fff3cd', color: '#7a4f00', label: 'Waitlisted' },
    pending: { bg: '#fff3cd', color: '#7a4f00', label: 'Pending' },
    succeeded: { bg: '#e8f5ee', color: '#085041', label: 'Paid' },
    failed: { bg: '#fdecea', color: '#8b1a1a', label: 'Failed' },
    refunded: { bg: '#f4f4f4', color: '#666', label: 'Refunded' },
    partially_refunded: { bg: '#f4f4f4', color: '#666', label: 'Partially refunded' },
  }
  const s = map[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
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
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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

  const [tab, setTab] = useState<'profile' | 'bookings' | 'passes' | 'credits' | 'payments'>('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [passes, setPasses] = useState<Pass[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [downloadingReceiptId, setDownloadingReceiptId] = useState('')
  const [receiptError, setReceiptError] = useState('')

  const [profileForm, setProfileForm] = useState({
    full_name: '', phone: '', date_of_birth: '', emergency_contact_name: '',
    emergency_contact_phone: '', address: '', person_type: '', gender: ''
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [cancellingId, setCancellingId] = useState('')
  const [cancelError, setCancelError] = useState('')

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
        body: JSON.stringify({ full_name: meta.fullName ?? '', phone: meta.phone || null })
      })
      if (res.status === 404) { setStudioNotFound(true); return }
      if (!res.ok) { setPortalError("Couldn't sign you in to this studio. Please try again."); return }
      const member = await res.json()
      setOrgId(member.organisation_id)
    } catch {
      setPortalError("Couldn't reach the server. Please check your connection and try again.")
    }
  }, [apiUrl, studioSlug])

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
        const [orgRes, profileRes, bookingsRes, passesRes, ledgerRes, paymentsRes] = await Promise.all([
          fetch(`${apiUrl}/api/organisations/${orgId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          authedFetch('/members/me'),
          authedFetch('/members/me/bookings'),
          authedFetch('/members/me/passes'),
          authedFetch('/members/me/ledger'),
          authedFetch('/members/me/payments'),
        ])
        if (orgRes.ok) setOrg(await orgRes.json())
        if (profileRes.ok) {
          const p: Profile = await profileRes.json()
          setProfile(p)
          setProfileForm({
            full_name: p.full_name ?? '',
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
          full_name: profileForm.full_name,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {org?.logo_url ? (
            <img src={org.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: '6px', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '6px', backgroundColor: brand }} />
          )}
          <span style={{ fontWeight: 700, fontSize: '16px' }}>{org?.name ?? 'My account'}</span>
        </div>
        <button
          onClick={handleSignOut}
          style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #e2e2e2', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#666' }}
        >
          Sign out
        </button>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px' }}>
        <div className={styles.tabs}>
          {(['profile', 'bookings', 'passes', 'credits', 'payments'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`${styles.tabButton} ${tab === t ? styles.tabButtonActive : ''}`}
            >
              {t === 'profile' ? 'Profile' : t === 'bookings' ? 'My bookings' : t === 'passes' ? 'My passes' : t === 'credits' ? 'Credit history' : 'Payments'}
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
                      Member since {new Date(profile.join_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · {profile.total_sessions_attended} session{profile.total_sessions_attended !== 1 ? 's' : ''} attended
                    </div>
                  </div>
                </div>

                <div className={styles.formGrid} style={{ marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Full name</label>
                    <input type="text" value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} style={inputStyle} />
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

            {tab === 'passes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passes.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                    No passes yet.
                  </div>
                ) : passes.map(p => (
                  <div key={p.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        {p.pass_template?.name ?? 'Pass'}
                        {p.pass_template && <span style={{ fontWeight: 400, color: '#999', marginLeft: '8px' }}>{formatMoney(p.pass_template.price, p.pass_template.currency)}</span>}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        {p.credits_remaining === null ? 'Unlimited' : `${p.credits_remaining} / ${p.credits_total} credits`} · Expires {new Date(p.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}

            {tab === 'credits' && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {ledger.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px' }}>No credit activity yet.</div>
                ) : ledger.map((entry, i) => (
                  <div key={entry.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px',
                    borderBottom: i < ledger.length - 1 ? '1px solid #f4f4f4' : 'none', gap: '12px', flexWrap: 'wrap'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{movementLabels[entry.movement_type] ?? entry.movement_type}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>{new Date(entry.created_at).toLocaleString()}</div>
                      {entry.notes && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{entry.notes}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: entry.credits_delta >= 0 ? '#085041' : '#8b1a1a' }}>
                        {entry.credits_delta >= 0 ? '+' : ''}{entry.credits_delta}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999' }}>balance: {entry.credits_after}</div>
                    </div>
                  </div>
                ))}
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
                      <div style={{ fontSize: '13px', color: '#666' }}>{new Date(p.created_at).toLocaleString()}</div>
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
