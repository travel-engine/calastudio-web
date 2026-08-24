'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useBookingFlow, type PassTemplateOption } from '@/lib/store/bookingFlow'
import StripePaymentForm from './StripePaymentForm'
import styles from './booking.module.css'

const apiUrl = process.env.NEXT_PUBLIC_API_URL

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '14px', outline: 'none', backgroundColor: 'white'
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

export default function BookingDrawer() {
  const {
    studioSlug, occurrence, brandColor, step, bookedMode, accessToken, orgId, stripeAccountId,
    bookingOptions, confirmedBooking, errorMessage,
    close, setStep, setBookedMode, setAuth, setBookingOptions, setConfirmedBooking, setError,
  } = useBookingFlow()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const [optionsLoading, setOptionsLoading] = useState(false)
  const [note, setNote] = useState('')

  const [dropInSecret, setDropInSecret] = useState<string | null>(null)
  const [dropInBusy, setDropInBusy] = useState(false)
  const [purchaseSecret, setPurchaseSecret] = useState<{ templateId: string; clientSecret: string } | null>(null)
  const [purchaseBusyId, setPurchaseBusyId] = useState('')
  const [confirmingLabel, setConfirmingLabel] = useState('Confirming your booking...')

  const resolveAuth = async (token: string) => {
    if (!occurrence || !studioSlug) return
    const registerRes = await fetch(`${apiUrl}/api/public/${studioSlug}/members/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ full_name: fullName || null, phone: null })
    })
    if (!registerRes.ok) { setError("Couldn't sign you in to this studio. Please try again."); return }
    const member = await registerRes.json()

    const orgRes = await fetch(`${apiUrl}/api/organisations/${member.organisation_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const org = orgRes.ok ? await orgRes.json() : null

    setAuth({ accessToken: token, orgId: member.organisation_id, stripeAccountId: org?.stripe_account_id ?? null })
    setStep('options')
  }

  // Whenever the drawer reaches the auth step, first check for an already-signed-in member so
  // returning visitors skip straight past the sign-in form.
  useEffect(() => {
    if (step !== 'auth') return
    let cancelled = false
    setCheckingAuth(true)
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        await resolveAuth(session.access_token)
      }
      if (!cancelled) setCheckingAuth(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, occurrence?.occurrence_id])

  // Load booking-options once we reach the payment step for this occurrence.
  useEffect(() => {
    if (step !== 'options' || !occurrence || !studioSlug) return
    let cancelled = false
    setOptionsLoading(true)
    setNote('')
    fetch(`${apiUrl}/api/public/${studioSlug}/occurrences/${occurrence.occurrence_id}/booking-options`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
    }).then(async res => {
      if (cancelled) return
      if (!res.ok) { setError("Couldn't load pricing options for this class."); return }
      const data = await res.json()
      setBookingOptions(data)
    }).finally(() => { if (!cancelled) setOptionsLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, occurrence?.occurrence_id, accessToken])

  if (!occurrence) return null

  const handleSignIn = async () => {
    setAuthBusy(true)
    setAuthMessage('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setAuthMessage(error.message); setAuthBusy(false); return }
    await resolveAuth(data.session.access_token)
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
        data: { full_name: fullName, phone: null },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/${studioSlug}/account`,
      },
    })
    if (error) { setAuthMessage(error.message); setAuthBusy(false); return }
    if (data.session) {
      await resolveAuth(data.session.access_token)
    } else {
      setAuthMessage('Check your email for a verification link, then come back here to finish booking.')
    }
    setAuthBusy(false)
  }

  const handleConfirmBooking = async () => {
    setConfirmingLabel('Confirming your booking...')
    setStep('confirming')
    try {
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ session_occurrence_id: occurrence.occurrence_id, booked_mode: bookedMode })
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.booked) {
        setConfirmedBooking({ id: data.booking.id, status: data.booking.status })
      } else if (res.ok && !data?.booked) {
        setNote('That pass is no longer usable — choose another option below.')
        setBookingOptions({
          ...bookingOptions!,
          usable_pass_id: null,
          usable_pass_name: null,
          purchasable_pass_templates: data?.suitable_pass_templates ?? [],
        })
        setStep('options')
      } else {
        setError(data?.error ?? "Couldn't complete your booking. Please try again.")
      }
    } catch {
      setError("Couldn't reach the server. Please try again.")
    }
  }

  const pollForConfirmedBooking = async (since: number) => {
    setConfirmingLabel('Payment received — confirming your booking...')
    setStep('confirming')
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(r => setTimeout(r, 1500))
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/bookings`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const bookings = await res.json()
        const match = bookings
          .filter((b: any) => b.status === 'confirmed' && new Date(b.booked_at).getTime() >= since)
          .sort((a: any, b: any) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime())[0]
        if (match) { setConfirmedBooking({ id: match.id, status: match.status }); return }
      }
    }
    setError("Your payment succeeded, but we're still confirming your booking. Check My Bookings in a minute — if it's not there, contact the studio.")
  }

  const pollForIssuedPassThenBook = async (templateId: string, since: number) => {
    setConfirmingLabel('Payment received — issuing your pass...')
    setStep('confirming')
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(r => setTimeout(r, 1500))
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const passes = await res.json()
        const found = passes.find((p: any) =>
          p.pass_template_id === templateId && new Date(p.effective_from).getTime() >= since - 60_000)
        if (found) { await handleConfirmBooking(); return }
      }
    }
    setError("Your payment succeeded, but we're still issuing your pass. Check My Passes in a minute, then come back and book.")
  }

  const startDropInPayment = async () => {
    setDropInBusy(true)
    setNote('')
    try {
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/bookings/payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ session_occurrence_id: occurrence.occurrence_id, booked_mode: bookedMode })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setNote(data?.error ?? "Couldn't start payment. Please try again."); return }
      setDropInSecret(data.client_secret)
    } finally {
      setDropInBusy(false)
    }
  }

  const startPassPurchase = async (templateId: string) => {
    setPurchaseBusyId(templateId)
    setNote('')
    try {
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes/${templateId}/payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setNote(data?.error ?? "Couldn't start payment. Please try again."); return }
      setPurchaseSecret({ templateId, clientSecret: data.client_secret })
    } finally {
      setPurchaseBusyId('')
    }
  }

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (authMode === 'signin') handleSignIn()
    else handleSignUp()
  }

  const modeLabel = (m: 'in_person' | 'online') => m === 'online' ? 'Online' : 'In-person'

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '17px' }}>{occurrence.session_name}</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{formatDateTime(occurrence.starts_at)}</div>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
        </div>

        {step === 'mode' && (
          <div>
            <p style={{ fontSize: '14px', color: '#444', marginBottom: '16px' }}>This class is offered both in-person and online. How would you like to attend?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(['in_person', 'online'] as const).map(m => {
                const spots = m === 'in_person' ? occurrence.spots_remaining_inperson : occurrence.spots_remaining_online
                const price = m === 'in_person' ? occurrence.price_inperson : occurrence.price_online
                const full = spots !== null && spots <= 0
                return (
                  <button
                    key={m}
                    disabled={full}
                    onClick={() => { setBookedMode(m); setStep('auth') }}
                    style={{
                      textAlign: 'left', padding: '14px 16px', border: '1px solid #e2e2e2', borderRadius: '10px',
                      backgroundColor: full ? '#f4f4f4' : 'white', cursor: full ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{modeLabel(m)}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                      {full ? 'Full' : spots !== null ? `${spots} spots left` : 'Open'}
                      {price != null ? ` · from ${formatMoney(price, occurrence.currency)}` : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 'auth' && (
          checkingAuth ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#666', fontSize: '14px' }}>Checking...</div>
          ) : (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                {authMode === 'signin' ? 'Sign in to book' : 'Create your account'}
              </h3>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>Your class selection is saved — you won&apos;t lose your spot in the queue.</p>

              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  style={{
                    padding: '12px', backgroundColor: authBusy ? '#9fd6b8' : brandColor, color: 'white', border: 'none',
                    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: authBusy ? 'default' : 'pointer', marginTop: '4px'
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
                    <>New here? <button type="button" onClick={() => { setAuthMode('signup'); setAuthMessage('') }} style={{ background: 'none', border: 'none', color: brandColor, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Create an account</button></>
                  ) : (
                    <>Already have an account? <button type="button" onClick={() => { setAuthMode('signin'); setAuthMessage('') }} style={{ background: 'none', border: 'none', color: brandColor, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Sign in</button></>
                  )}
                </p>
              </form>
            </div>
          )
        )}

        {step === 'options' && (
          optionsLoading || !bookingOptions ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#666', fontSize: '14px' }}>Loading options...</div>
          ) : (
            <div>
              {note && (
                <div style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '8px', color: '#7a4f00', fontSize: '13px', marginBottom: '16px' }}>
                  {note}
                </div>
              )}

              {bookedMode && (
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>Attending: <strong>{modeLabel(bookedMode)}</strong></div>
              )}

              {bookingOptions.is_free ? (
                <div>
                  <p style={{ fontSize: '14px', color: '#444', marginBottom: '16px' }}>This class is free — no payment required.</p>
                  <button onClick={handleConfirmBooking} style={confirmButtonStyle(brandColor)}>Confirm booking</button>
                </div>
              ) : bookingOptions.usable_pass_id ? (
                <div>
                  <div className={styles.optionCard}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Using your pass</div>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{bookingOptions.usable_pass_name}</div>
                  </div>
                  <button onClick={handleConfirmBooking} style={confirmButtonStyle(brandColor)}>Confirm booking</button>
                </div>
              ) : (
                <div>
                  {!bookingOptions.drop_in_allowed && !bookingOptions.purchasable_pass_templates?.length ? (
                    <p style={{ fontSize: '14px', color: '#8b1a1a' }}>
                      No pricing options are available for this class. Please contact the studio.
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: '14px', color: '#444', marginBottom: '16px' }}>
                        You need a pass to book this class, or you can pay for a single drop-in.
                      </p>

                      {bookingOptions.drop_in_allowed && (
                        <div className={styles.optionCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>Pay drop-in</div>
                              <div style={{ fontSize: '13px', color: '#666' }}>
                                {formatMoney(
                                  (bookedMode === 'online' ? bookingOptions.base_price_online : bookingOptions.base_price_inperson) ?? 0,
                                  bookingOptions.currency
                                )}
                              </div>
                            </div>
                            {!dropInSecret && (
                              <button onClick={startDropInPayment} disabled={dropInBusy} style={smallButtonStyle(brandColor)}>
                                {dropInBusy ? 'Starting...' : 'Pay now'}
                              </button>
                            )}
                          </div>
                          {dropInSecret && stripeAccountId && (
                            <div style={{ marginTop: '14px' }}>
                              <StripePaymentForm
                                key={dropInSecret}
                                clientSecret={dropInSecret}
                                stripeAccountId={stripeAccountId}
                                accentColor={brandColor}
                                submitLabel="Pay & book"
                                onSuccess={() => pollForConfirmedBooking(Date.now() - 5000)}
                                onError={msg => setNote(msg)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {bookingOptions.purchasable_pass_templates?.map((pt: PassTemplateOption) => (
                        <div key={pt.id} className={styles.optionCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>{pt.name}</div>
                              <div style={{ fontSize: '13px', color: '#666' }}>{formatMoney(pt.price, pt.currency)}</div>
                            </div>
                            {purchaseSecret?.templateId !== pt.id && (
                              <button onClick={() => startPassPurchase(pt.id)} disabled={purchaseBusyId === pt.id} style={smallButtonStyle(brandColor)}>
                                {purchaseBusyId === pt.id ? 'Starting...' : 'Buy now'}
                              </button>
                            )}
                          </div>
                          {purchaseSecret?.templateId === pt.id && stripeAccountId && (
                            <div style={{ marginTop: '14px' }}>
                              <StripePaymentForm
                                key={purchaseSecret.clientSecret}
                                clientSecret={purchaseSecret.clientSecret}
                                stripeAccountId={stripeAccountId}
                                accentColor={brandColor}
                                submitLabel="Buy & book"
                                onSuccess={() => pollForIssuedPassThenBook(pt.id, Date.now() - 5000)}
                                onError={msg => setNote(msg)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {step === 'confirming' && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#666', fontSize: '14px' }}>{confirmingLabel}</div>
        )}

        {step === 'success' && confirmedBooking && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>Booking confirmed</div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              You&apos;re booked for {occurrence.session_name} on {formatDateTime(occurrence.starts_at)}. A confirmation email is on its way.
            </p>
            <a
              href={`/${studioSlug}/account`}
              style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: brandColor, color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
            >
              View my bookings
            </a>
          </div>
        )}

        {step === 'error' && (
          <div>
            <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
              {errorMessage}
            </div>
            <button onClick={() => setStep('options')} style={confirmButtonStyle(brandColor)}>Back to options</button>
          </div>
        )}
      </div>
    </div>
  )
}

const confirmButtonStyle = (brandColor: string): React.CSSProperties => ({
  width: '100%', padding: '12px', backgroundColor: brandColor, color: 'white', border: 'none',
  borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
})

const smallButtonStyle = (brandColor: string): React.CSSProperties => ({
  padding: '8px 16px', backgroundColor: brandColor, color: 'white', border: 'none',
  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
})
