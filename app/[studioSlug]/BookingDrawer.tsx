'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useBookingFlow, type PassTemplateOption } from '@/lib/store/bookingFlow'
import { displayName, splitName } from '@/lib/names'
import StripePaymentForm from './StripePaymentForm'
import { formatDate, formatDateTimeWithWeekday } from '@/lib/dates'
import styles from './photofirst.module.css'

const apiUrl = process.env.NEXT_PUBLIC_API_URL

function formatDateTime(iso: string) {
  return formatDateTimeWithWeekday(iso)
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function durationMinutes(startIso: string, endIso: string) {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  return mins > 0 ? mins : null
}

function spotsLabel(remaining: number | null) {
  if (remaining === null) return null
  if (remaining <= 0) return { text: 'Full', tone: 'full' as const }
  if (remaining <= 3) return { text: `Only ${remaining} left`, tone: 'low' as const }
  return { text: `${remaining} spots left`, tone: 'normal' as const }
}

function passCreditText(pt: PassTemplateOption) {
  if (pt.pass_type === 'unlimited') return 'Unlimited'
  if (pt.pass_type === 'credit' && pt.credit_count != null) {
    return `${pt.credit_count} class${pt.credit_count === 1 ? '' : 'es'}`
  }
  return null // shape without pass detail (e.g. the booking endpoint's fallback list)
}

function passExpiryText(pt: PassTemplateOption) {
  const v = pt.expiry_rolling_value
  if (pt.expiry_type === 'fixed_date') return pt.expiry_fixed_date ? `valid until ${formatDate(pt.expiry_fixed_date)}` : null
  if (pt.expiry_type === 'rolling_days' && v) return `valid ${v} day${v === 1 ? '' : 's'}`
  if (pt.expiry_type === 'rolling_months' && v) return `valid ${v} month${v === 1 ? '' : 's'}`
  return null
}

function creditsLine(memberCost: number, guestCost: number, guestCount: number) {
  const guests = guestCount * guestCost
  const total = memberCost + guests
  if (total <= 0) return null
  if (guestCount <= 0) return `Uses ${total} credit${total === 1 ? '' : 's'}`
  return `Uses ${total} credits — ${memberCost} for you + ${guests} for guest${guestCount === 1 ? '' : 's'}`
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

const STEP_LABELS: Record<string, string> = {
  auth: 'Step 1 of 2 — sign in',
  agreements: 'Before you continue',
  options: 'Step 2 of 2 — payment',
  waitlist: 'Waitlist',
  'waitlist-joined': 'Waitlist',
  confirming: 'One moment',
  success: 'Booked',
  error: '',
}

export default function BookingDrawer() {
  const {
    studioSlug, occurrence, step, bookedMode, accessToken, orgId, stripeAccountId, paymentsEnabled,
    bookingOptions, confirmedBooking, errorMessage, joiningWaitlist, joinedWaitlistEntry,
    close, setStep, setAuth, setBookingOptions, setConfirmedBooking, setError,
    goToWaitlist, setJoinedWaitlist,
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
  const [alreadyBooked, setAlreadyBooked] = useState(false)

  // Guests — only honored by the free/pass-credit booking path (BookWithSuitablePassAsync); the
  // backend rejects a nonzero guest_count outright on the drop-in card payment-intent endpoint.
  // No per-guest name/email collection — each guest is just labelled "{member name} - Guest N".
  const [guestCount, setGuestCount] = useState(0)
  const [memberName, setMemberName] = useState('')

  const [waitlistBusy, setWaitlistBusy] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')

  const [dropInSecret, setDropInSecret] = useState<string | null>(null)
  const [dropInBusy, setDropInBusy] = useState(false)
  const [purchaseSecret, setPurchaseSecret] = useState<{ templateId: string; clientSecret: string } | null>(null)
  const [purchaseBusyId, setPurchaseBusyId] = useState('')
  const [confirmingLabel, setConfirmingLabel] = useState('Confirming your booking...')

  // Terms & Liability Waiver acceptance — either shown as part of first-time registration, or as a
  // recovery step when an existing member's accepted waiver has gone stale since they last booked.
  const [waiverInfo, setWaiverInfo] = useState<{ required: boolean; version: number; text: string | null } | null>(null)
  const [waiverLoading, setWaiverLoading] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeWaiver, setAgreeWaiver] = useState(false)
  const [agreementsContext, setAgreementsContext] = useState<'register' | 'booking'>('register')
  const [agreementsBusy, setAgreementsBusy] = useState(false)
  const [agreementsError, setAgreementsError] = useState('')
  // What to retry after acceptance — a discriminant rather than a stored callback, since a callback
  // captured at failure time would close over that render's (possibly stale) agreeTerms/agreeWaiver
  // instead of what the member actually just checked.
  const [pendingRetryKind, setPendingRetryKind] = useState<'register' | 'confirm-booking' | 'drop-in-payment' | null>(null)
  const [pendingToken, setPendingToken] = useState('')
  // How many times the member has hit "Accept & continue" for this occurrence. A ref, not state, so
  // it's readable synchronously inside the awaited retry chain. Once they've accepted and the
  // retried action *still* comes back with a waiver/terms error, we stop re-showing the screen
  // (which the member can't do anything more about) and surface the real message instead — see
  // BookingService's IsActive-less member lookup vs the accept endpoint's IsActiveMemberAsync gate,
  // which can disagree and produce an unbreakable loop.
  const agreementsAttemptsRef = useRef(0)
  // Pass ids the member already held when a purchase started — so the post-payment poll can spot the
  // *newly issued* pass rather than comparing a date-only effective_from against a timestamp.
  const passIdsBeforePurchaseRef = useRef<Set<string>>(new Set())

  const isWaiverOrTermsError = (message: string) =>
    message.includes('Terms & Conditions') || message.includes('Liability Waiver') || message.includes('liability waiver')

  // Call at the top of each isWaiverOrTermsError branch: true means "already accepted once and it
  // still failed — don't loop", and it has already routed to the error step with the real message.
  const agreementsLoopExhausted = (message: string) => {
    if (agreementsAttemptsRef.current < 1) return false
    setError(message ||
      "We couldn't confirm your agreement acceptance with the studio. Please contact them to finish your booking.")
    return true
  }

  // Booking-options doesn't itself know about capacity (only occurrence.spots_remaining does, a
  // page-load-time snapshot) — so a normal booking attempt can still lose the capacity race between
  // reaching the options step and submitting. BookingService.cs surfaces exactly these two messages
  // for that case; catching them here routes into the same join-waitlist flow instead of a dead end.
  const isCapacityFullError = (message: string) =>
    message.includes('This session is full') || message.includes("enough spots left")

  const loadWaiverInfo = async () => {
    if (!studioSlug) return
    setWaiverLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/public/${studioSlug}/liability-waiver`)
      if (res.ok) setWaiverInfo(await res.json())
    } finally {
      setWaiverLoading(false)
    }
  }

  const resolveAuth = async (token: string) => {
    if (!occurrence || !studioSlug) return
    const registerRes = await fetch(`${apiUrl}/api/public/${studioSlug}/members/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...splitName(fullName), phone: null, accept_terms: agreeTerms, accept_waiver: agreeWaiver })
    })
    if (!registerRes.ok) {
      const data = await registerRes.json().catch(() => null)
      const message: string = data?.error ?? ''
      if (isWaiverOrTermsError(message)) {
        if (agreementsLoopExhausted(message)) return
        await loadWaiverInfo()
        setAgreementsContext('register')
        setAgreementsError(message)
        setPendingToken(token)
        setPendingRetryKind('register')
        setStep('agreements')
        return
      }
      setError(message || "Couldn't sign you in to this studio. Please try again.")
      return
    }
    const member = await registerRes.json()

    // Stripe config comes from the public org endpoint at open time (in the store) — the admin
    // GET /api/organisations/{id} is 403 for a member token. Only the member's own name is needed here.
    const profileRes = await fetch(
      `${apiUrl}/api/organisations/${member.organisation_id}/members/me`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (profileRes.ok) setMemberName(displayName(await profileRes.json()))

    setAuth({ accessToken: token, orgId: member.organisation_id })
    setStep(joiningWaitlist ? 'waitlist' : 'options')
  }

  const handleAcceptAgreements = async () => {
    const attempt = agreementsAttemptsRef.current + 1
    agreementsAttemptsRef.current = attempt
    setAgreementsError('')
    setAgreementsBusy(true)
    try {
      if (agreementsContext === 'booking') {
        const res = await fetch(`${apiUrl}/api/organisations/${orgId}/liability-waiver/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const msg = body?.error || "Couldn't record your acceptance."
          if (attempt >= 2) { setError(`${msg} Please contact the studio to finish your booking.`); return }
          setAgreementsError(`${msg} Please try again.`)
          return
        }
      }
      if (pendingRetryKind === 'register') {
        await resolveAuth(pendingToken)
      } else if (pendingRetryKind === 'confirm-booking') {
        // handleConfirmBooking drives its own step (confirming → success/error/options).
        await handleConfirmBooking()
      } else if (pendingRetryKind === 'drop-in-payment') {
        // startDropInPayment only sets the client secret — bring the drawer back to the options
        // step so its inline Stripe form renders instead of leaving the agreements screen up.
        setStep('options')
        await startDropInPayment()
      }
    } finally {
      setAgreementsBusy(false)
    }
  }

  // New occurrence → fresh agreements attempt budget + purchase snapshot.
  useEffect(() => {
    agreementsAttemptsRef.current = 0
    passIdsBeforePurchaseRef.current = new Set()
  }, [occurrence?.occurrence_id])

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

  // Load booking-options once we reach the payment step for this occurrence — and, for a signed-in
  // member, check their own bookings first. booking-options itself doesn't know about the caller's
  // existing bookings, so without this a member re-clicking "Book" on a session they're already
  // confirmed into would walk straight into the payment step with no indication of that.
  useEffect(() => {
    if ((step !== 'options' && step !== 'waitlist') || !occurrence || !studioSlug) return
    let cancelled = false
    setOptionsLoading(true)
    setNote('')
    setWaitlistError('')
    setAlreadyBooked(false)
    setGuestCount(0)
    Promise.all([
      fetch(`${apiUrl}/api/public/${studioSlug}/occurrences/${occurrence.occurrence_id}/booking-options`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      }),
      accessToken && orgId
        ? fetch(`${apiUrl}/api/organisations/${orgId}/members/me/bookings`, { headers: { Authorization: `Bearer ${accessToken}` } })
        : Promise.resolve(null),
    ]).then(async ([optionsRes, bookingsRes]) => {
      if (cancelled) return
      if (!optionsRes.ok) { setError("Couldn't load pricing options for this class."); return }

      if (bookingsRes?.ok) {
        const bookings = await bookingsRes.json()
        const existing = bookings.some((b: any) =>
          b.status === 'confirmed' && b.session_occurrence_id === occurrence.occurrence_id)
        if (existing) { setAlreadyBooked(true); return }
      }

      const data = await optionsRes.json()
      setBookingOptions(data)
    }).finally(() => { if (!cancelled) setOptionsLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, occurrence?.occurrence_id, accessToken, orgId])

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

  const handleForgotPassword = async () => {
    if (authBusy) return
    if (!email.trim()) { setAuthMessage('Enter your email address first, then tap "Forgot password?".'); return }
    setAuthBusy(true)
    setAuthMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    })
    // Same neutral wording regardless of whether the address is registered — don't leak that.
    setAuthMessage(error ? error.message : `Check your email — if an account exists for ${email}, a reset link is on its way.`)
    setAuthBusy(false)
  }

  const handleConfirmBooking = async () => {
    setConfirmingLabel('Confirming your booking...')
    setStep('confirming')
    try {
      const guestLabel = memberName || 'Member'
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          session_occurrence_id: occurrence.occurrence_id,
          guest_count: guestCount,
          guests: Array.from({ length: guestCount }, (_, i) => ({
            first_name: `${guestLabel} - Guest ${i + 1}`, last_name: null, email: null,
          })),
        })
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
        const message: string = data?.error ?? ''
        if (isWaiverOrTermsError(message)) {
          if (agreementsLoopExhausted(message)) return
          await loadWaiverInfo()
          setAgreementsContext('booking')
          setAgreementsError('')
          setPendingRetryKind('confirm-booking')
          setStep('agreements')
          return
        }
        if (isCapacityFullError(message)) { goToWaitlist(); return }
        setError(message || "Couldn't complete your booking. Please try again.")
      }
    } catch {
      setError("Couldn't reach the server. Please try again.")
    }
  }

  const handleJoinWaitlist = async () => {
    if (!occurrence || !bookedMode) return
    setWaitlistBusy(true)
    setWaitlistError('')
    try {
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/occurrences/${occurrence.occurrence_id}/waitlist/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ guest_count: guestCount })
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setJoinedWaitlist({ id: data.id, position: data.position })
        return
      }
      const message: string = data?.error ?? ''
      if (message.includes("There's room in this session")) {
        // Lost the (rare) other direction of the race — a spot opened up between page load and this
        // request. Send them back through the normal options step, which re-fetches fresh pricing.
        setStep('options')
        return
      }
      setWaitlistError(message || "Couldn't join the waitlist. Please try again.")
    } catch {
      setWaitlistError("Couldn't reach the server. Please try again.")
    } finally {
      setWaitlistBusy(false)
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

  const pollForIssuedPassThenBook = async (templateId: string) => {
    setConfirmingLabel('Payment received — issuing your pass...')
    setStep('confirming')
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 1500))
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const passes = await res.json()
        // The pass the webhook just issued: same template, and an id we didn't already hold.
        const found = passes.find((p: any) =>
          p.pass_template_id === templateId && !passIdsBeforePurchaseRef.current.has(p.id))
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
        body: JSON.stringify({ session_occurrence_id: occurrence.occurrence_id })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const message: string = data?.error ?? ''
        if (isWaiverOrTermsError(message)) {
          if (agreementsLoopExhausted(message)) return
          await loadWaiverInfo()
          setAgreementsContext('booking')
          setAgreementsError('')
          setPendingRetryKind('drop-in-payment')
          setStep('agreements')
          return
        }
        if (isCapacityFullError(message)) { goToWaitlist(); return }
        setNote(message || "Couldn't start payment. Please try again.")
        return
      }
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

      // Snapshot the passes the member already holds, so the post-payment poll can tell the
      // newly-issued one apart. Best-effort — an empty snapshot just means "first matching pass wins".
      try {
        const existing = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (existing.ok) {
          const list = await existing.json()
          passIdsBeforePurchaseRef.current = new Set(list.map((p: any) => p.id))
        }
      } catch { /* fall back to first-match */ }
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

  // Card payment is only possible when the studio has enabled payments and a connected account is
  // known (both from GET /api/public/{orgSlug}, carried in the store since the drawer has no admin
  // token). Without it the drop-in / buy-a-pass options can't be offered.
  const canPay = paymentsEnabled && !!stripeAccountId

  // Credits a booking costs — matches what BookingService debits. 0 for free / drop-in paths.
  const creditsCost = bookingOptions
    ? bookingOptions.member_credits_cost + guestCount * bookingOptions.guest_credits_cost
    : 0
  const passCreditsShort = !!bookingOptions?.usable_pass_id
    && bookingOptions.usable_pass_credits_remaining != null
    && creditsCost > bookingOptions.usable_pass_credits_remaining

  const renderGuestSelector = () => {
    if (!bookingOptions?.guest_bookings_enabled || bookingOptions.guest_max_per_booking <= 0) return null

    const spotsRemaining = occurrence!.spots_remaining
    const spotsCap = spotsRemaining === null ? bookingOptions.guest_max_per_booking : Math.max(0, spotsRemaining - 1)
    const maxGuests = Math.min(bookingOptions.guest_max_per_booking, spotsCap)
    if (maxGuests <= 0) return null

    const credits = creditsLine(bookingOptions.member_credits_cost, bookingOptions.guest_credits_cost, guestCount)

    return (
      <div className={styles.infoCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 500, fontSize: '15px' }}>Bringing guests?</div>
          <select
            value={guestCount}
            onChange={e => setGuestCount(parseInt(e.target.value))}
            className={styles.selectPf}
          >
            {Array.from({ length: maxGuests + 1 }, (_, n) => (
              <option key={n} value={n}>{n === 0 ? 'No guests' : `${n} guest${n > 1 ? 's' : ''}`}</option>
            ))}
          </select>
        </div>
        {credits && (
          <div style={{ fontSize: '12.5px', color: passCreditsShort ? '#e8a0a0' : 'var(--text-meta)', marginTop: '8px' }}>
            {credits}
            {passCreditsShort && bookingOptions.usable_pass_credits_remaining != null &&
              ` — only ${bookingOptions.usable_pass_credits_remaining} left on your pass`}
          </div>
        )}
      </div>
    )
  }

  const durationMins = durationMinutes(occurrence.starts_at, occurrence.ends_at)
  const spots = spotsLabel(occurrence.spots_remaining)
  const drawerMeta = [
    formatDateTime(occurrence.starts_at) + ' – ' + timeOnly(occurrence.ends_at),
    durationMins ? `${durationMins} min` : null,
    occurrence.delivery_mode === 'online' ? 'Online' : (occurrence.location_name || 'In person'),
  ].filter(Boolean).join(' · ')

  return (
    <div className={styles.drawerOverlay} onClick={close}>
      <div className={styles.drawerPanel} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHead}>
          <div style={{ minWidth: 0 }}>
            {STEP_LABELS[step] && <div className={styles.drawerStep}>{STEP_LABELS[step]}</div>}
            <div className={styles.drawerTitle}>{occurrence.session_name}</div>
            <div className={styles.drawerMeta}>{drawerMeta}</div>
            {occurrence.instructor_name && (
              <div className={styles.drawerMeta} style={{ marginTop: 2 }}>with {occurrence.instructor_name}</div>
            )}
            {spots && (
              <div
                className={styles.drawerMeta}
                style={{
                  marginTop: 4, fontWeight: 500,
                  color: spots.tone === 'full' ? 'var(--text-footer)' : spots.tone === 'low' ? 'var(--text-warn)' : 'var(--text-meta)',
                }}
              >
                {spots.text}
              </div>
            )}
            {occurrence.is_cancelled && (
              <div className={styles.noticeError} style={{ marginTop: 12, marginBottom: 0 }}>
                This class has been cancelled{occurrence.cancellation_reason ? ` — ${occurrence.cancellation_reason}` : ''}.
              </div>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={close} className={styles.iconClose}>✕</button>
        </div>

        {step === 'auth' && (
          checkingAuth ? (
            <div className={styles.drawerStatus}>Checking…</div>
          ) : (
            <div>
              <p className={styles.drawerText}>
                {authMode === 'signin'
                  ? 'Sign in with your email to book. New here? Create an account — your class selection is saved.'
                  : 'Create your account to book. Your class selection is saved.'}
              </p>

              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {authMode === 'signup' && (
                  <div>
                    <label htmlFor="bk-name" className={styles.fieldLabel}>Full name</label>
                    <input id="bk-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={styles.inputRect} />
                  </div>
                )}
                <div>
                  <label htmlFor="bk-email" className={styles.fieldLabel}>Email</label>
                  <input id="bk-email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className={styles.input} />
                </div>
                <div>
                  <label htmlFor="bk-password" className={styles.fieldLabel}>Password</label>
                  <input id="bk-password" type="password" value={password} onChange={e => setPassword(e.target.value)} className={styles.inputRect} />
                  {authMode === 'signin' && (
                    <button type="button" onClick={handleForgotPassword} disabled={authBusy} className={styles.linkBtn} style={{ marginTop: '10px' }}>
                      Forgot password?
                    </button>
                  )}
                </div>

                <button type="submit" disabled={authBusy} className={styles.blockBtn}>
                  {authBusy ? 'Please wait…' : authMode === 'signin' ? 'Continue' : 'Create account'}
                </button>

                {authMessage && (
                  <div className={authMessage.includes('Check your email') ? styles.noticeOk : styles.noticeError} style={{ marginBottom: 0 }}>
                    {authMessage}
                  </div>
                )}

                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-meta)' }}>
                  {authMode === 'signin' ? (
                    <>New here? <button type="button" onClick={() => { setAuthMode('signup'); setAuthMessage('') }} className={styles.linkBtn}>Create an account</button></>
                  ) : (
                    <>Already have an account? <button type="button" onClick={() => { setAuthMode('signin'); setAuthMessage('') }} className={styles.linkBtn}>Sign in</button></>
                  )}
                </p>
              </form>
            </div>
          )
        )}

        {step === 'agreements' && (
          waiverLoading ? (
            <div className={styles.drawerStatus}>Loading…</div>
          ) : (
            <div>
              <h3 className={styles.resultTitle} style={{ textAlign: 'left', fontSize: '18px' }}>
                {agreementsContext === 'register' ? 'Before you continue' : "This studio's waiver has changed"}
              </h3>
              <p className={styles.drawerText}>
                {agreementsContext === 'register'
                  ? 'Please review and accept the following to finish signing up.'
                  : 'Please review and re-accept the liability waiver to continue booking.'}
              </p>

              {waiverInfo?.text && (
                <div className={styles.infoCard} style={{ maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '13px', color: 'var(--text-body)' }}>
                  {waiverInfo.text}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {agreementsContext === 'register' && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', cursor: 'pointer', color: 'var(--text-body)' }}>
                    <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ marginTop: '2px' }} />
                    I accept the Terms &amp; Conditions
                  </label>
                )}
                {waiverInfo?.required && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', cursor: 'pointer', color: 'var(--text-body)' }}>
                    <input type="checkbox" checked={agreeWaiver} onChange={e => setAgreeWaiver(e.target.checked)} style={{ marginTop: '2px' }} />
                    I accept the Liability Waiver
                  </label>
                )}
              </div>

              {agreementsError && (
                <div className={styles.noticeError} style={{ marginTop: '16px', marginBottom: 0 }}>{agreementsError}</div>
              )}

              <button
                onClick={handleAcceptAgreements}
                disabled={
                  agreementsBusy ||
                  (agreementsContext === 'register' && !agreeTerms) ||
                  (!!waiverInfo?.required && !agreeWaiver)
                }
                className={styles.blockBtn}
                style={{ marginTop: '16px' }}
              >
                {agreementsBusy ? 'Please wait…' : 'Accept & continue'}
              </button>
            </div>
          )
        )}

        {step === 'options' && (
          optionsLoading ? (
            <div className={styles.drawerStatus}>Loading options…</div>
          ) : alreadyBooked ? (
            <div className={styles.resultWrap}>
              <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
              <h3 className={styles.resultTitle}>You&apos;re already booked in</h3>
              <p className={styles.drawerText}>
                You have a confirmed booking for {occurrence.session_name} on {formatDateTime(occurrence.starts_at)}.
              </p>
              <a href={`/${studioSlug}/account`} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>
                View my bookings
              </a>
            </div>
          ) : !bookingOptions ? (
            <div className={styles.drawerStatus}>Loading options…</div>
          ) : (
            <div>
              {note && <div className={styles.noticeWarn}>{note}</div>}

              {bookedMode && (
                <div style={{ fontSize: '13px', color: 'var(--text-meta)', marginBottom: '16px' }}>
                  Attending: <strong style={{ color: 'var(--ink)' }}>{modeLabel(bookedMode)}</strong>
                </div>
              )}

              {bookingOptions.is_free ? (
                <div>
                  <p className={styles.drawerText}>This class is free — no payment required.</p>
                  {renderGuestSelector()}
                  <button onClick={handleConfirmBooking} className={styles.blockBtn} style={{ marginTop: '12px' }}>
                    Confirm booking{guestCount > 0 ? ` (${guestCount + 1} spots)` : ''}
                  </button>
                </div>
              ) : bookingOptions.usable_pass_id ? (
                <div>
                  <div className={styles.infoCard}>
                    <div style={{ fontWeight: 500, fontSize: '15px' }}>Using your pass</div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-meta)', marginTop: '2px' }}>
                      {bookingOptions.usable_pass_name}
                      {bookingOptions.usable_pass_credits_remaining != null &&
                        ` · ${bookingOptions.usable_pass_credits_remaining} credit${bookingOptions.usable_pass_credits_remaining === 1 ? '' : 's'} left`}
                    </div>
                  </div>
                  {renderGuestSelector()}
                  {passCreditsShort && (
                    <div className={styles.noticeError}>
                      This booking needs {creditsCost} credits but only {bookingOptions.usable_pass_credits_remaining} are left on your pass. Reduce guests or buy another pass.
                    </div>
                  )}
                  <button
                    onClick={handleConfirmBooking}
                    disabled={passCreditsShort}
                    className={styles.blockBtn}
                    style={{ marginTop: '12px' }}
                  >
                    Confirm booking{guestCount > 0 ? ` (${guestCount + 1} spots)` : ''}
                  </button>
                </div>
              ) : !canPay ? (
                <p style={{ fontSize: '14px', color: '#e8a0a0' }}>
                  This class needs payment, but this studio hasn&apos;t set up card payments yet. Please contact the studio to book.
                </p>
              ) : (
                <div>
                  {!bookingOptions.drop_in_allowed && !bookingOptions.purchasable_pass_templates?.length ? (
                    <p style={{ fontSize: '14px', color: '#e8a0a0' }}>
                      No pricing options are available for this class. Please contact the studio.
                    </p>
                  ) : (
                    <>
                      <p className={styles.drawerText}>
                        You need a pass to book this class, or you can pay for a single drop-in.
                      </p>

                      {bookingOptions.drop_in_allowed && (
                        <div className={styles.optionCardPf} style={{ cursor: 'default', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <div>
                              <div className={styles.optionTitle}>Pay drop-in</div>
                              <span className={styles.optionNote}>{formatMoney(bookingOptions.base_price ?? 0, bookingOptions.currency)}</span>
                            </div>
                            {!dropInSecret && (
                              <button onClick={startDropInPayment} disabled={dropInBusy} className={styles.smallBtn}>
                                {dropInBusy ? 'Starting…' : 'Pay now'}
                              </button>
                            )}
                          </div>
                          {dropInSecret && stripeAccountId && (
                            <div style={{ marginTop: '14px' }}>
                              <StripePaymentForm
                                key={dropInSecret}
                                clientSecret={dropInSecret}
                                stripeAccountId={stripeAccountId}
                                dark
                                submitLabel="Pay & book"
                                onSuccess={() => pollForConfirmedBooking(Date.now() - 5000)}
                                onError={msg => setNote(msg)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {bookingOptions.purchasable_pass_templates?.map((pt: PassTemplateOption) => {
                        const detail = [passCreditText(pt), passExpiryText(pt)].filter(Boolean).join(' · ')
                        return (
                        <div key={pt.id} className={styles.optionCardPf} style={{ cursor: 'default', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div className={styles.optionTitle}>{pt.name}</div>
                              {detail && <span className={styles.optionNote}>{detail}</span>}
                              {pt.description && <span className={styles.optionNote}>{pt.description}</span>}
                              <span className={styles.optionNote}>{formatMoney(pt.price, pt.currency)}</span>
                            </div>
                            {purchaseSecret?.templateId !== pt.id && (
                              <button onClick={() => startPassPurchase(pt.id)} disabled={purchaseBusyId === pt.id} className={styles.smallBtn} style={{ flexShrink: 0 }}>
                                {purchaseBusyId === pt.id ? 'Starting…' : 'Buy now'}
                              </button>
                            )}
                          </div>
                          {purchaseSecret?.templateId === pt.id && stripeAccountId && (
                            <div style={{ marginTop: '14px' }}>
                              <StripePaymentForm
                                key={purchaseSecret.clientSecret}
                                clientSecret={purchaseSecret.clientSecret}
                                stripeAccountId={stripeAccountId}
                                dark
                                submitLabel="Buy & book"
                                onSuccess={() => pollForIssuedPassThenBook(pt.id)}
                                onError={msg => setNote(msg)}
                              />
                            </div>
                          )}
                        </div>
                      )})}
                    </>
                  )}
                </div>
              )}
              <p className={styles.drawerFootnote}>Free cancellation up to 12 hours before the session.</p>
            </div>
          )
        )}

        {step === 'waitlist' && (
          optionsLoading ? (
            <div className={styles.drawerStatus}>Loading…</div>
          ) : alreadyBooked ? (
            <div className={styles.resultWrap}>
              <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
              <h3 className={styles.resultTitle}>You&apos;re already booked in</h3>
              <p className={styles.drawerText}>
                You have a confirmed booking for {occurrence.session_name} on {formatDateTime(occurrence.starts_at)}.
              </p>
              <a href={`/${studioSlug}/account`} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>
                View my bookings
              </a>
            </div>
          ) : (
            <div>
              <p className={styles.drawerText}>
                This session is full. Join the waitlist and you&apos;ll be offered the first place that opens, by text and email.
              </p>

              {bookingOptions && bookingOptions.guest_bookings_enabled && bookingOptions.guest_max_per_booking > 0 && (
                <div className={styles.infoCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 500, fontSize: '15px' }}>Waiting as a group?</div>
                    <select
                      value={guestCount}
                      onChange={e => setGuestCount(parseInt(e.target.value))}
                      className={styles.selectPf}
                    >
                      {Array.from({ length: bookingOptions.guest_max_per_booking + 1 }, (_, n) => (
                        <option key={n} value={n}>{n === 0 ? 'Just me' : `Me + ${n} guest${n > 1 ? 's' : ''}`}</option>
                      ))}
                    </select>
                  </div>
                  {guestCount > 0 && (
                    <div style={{ fontSize: '12.5px', color: 'var(--text-meta)', marginTop: '8px' }}>
                      You&apos;ll only be promoted once {guestCount + 1} spots open up together.
                    </div>
                  )}
                </div>
              )}

              {waitlistError && <div className={styles.noticeError}>{waitlistError}</div>}

              <button onClick={handleJoinWaitlist} disabled={waitlistBusy} className={styles.blockBtn} style={{ marginTop: '16px' }}>
                {waitlistBusy ? 'Joining…' : `Join the waitlist${guestCount > 0 ? ` (${guestCount + 1} spots)` : ''}`}
              </button>
            </div>
          )
        )}

        {step === 'waitlist-joined' && joinedWaitlistEntry && (
          <div className={styles.resultWrap}>
            <div className={`${styles.resultCircle} ${styles.resultCircleOutline}`}>{joinedWaitlistEntry.position}</div>
            <h3 className={styles.resultTitle}>You&apos;re on the waitlist</h3>
            <p className={styles.drawerText}>
              You&apos;re #{joinedWaitlistEntry.position} in line for {occurrence.session_name} on {formatDateTime(occurrence.starts_at)}.
              If a place opens we&apos;ll hold it for you — nothing is charged until you accept.
            </p>
            <a href={`/${studioSlug}/account`} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>
              View my waitlist
            </a>
          </div>
        )}

        {step === 'confirming' && (
          <div className={styles.drawerStatus}>{confirmingLabel}</div>
        )}

        {step === 'success' && confirmedBooking && (
          <div className={styles.resultWrap}>
            <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
            <h3 className={styles.resultTitle}>You&apos;re booked</h3>
            <p className={styles.drawerText}>
              You&apos;re booked for {occurrence.session_name} on {formatDateTime(occurrence.starts_at)}. A confirmation email is on its way.
            </p>
            <a href={`/${studioSlug}/account`} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>
              View my bookings
            </a>
          </div>
        )}

        {step === 'error' && (
          <div>
            <div className={styles.noticeError}>{errorMessage}</div>
            <button onClick={() => setStep(joiningWaitlist ? 'waitlist' : 'options')} className={styles.blockBtn}>
              {joiningWaitlist ? 'Back to waitlist' : 'Back to options'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
