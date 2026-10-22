'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { type ThemeKey } from '@/lib/studioTheme'
import ThemePicker from '@/app/components/ThemePicker'
import PlanStep from './PlanStep'
import { STUDIO_DOMAIN, studioOrigin } from '@/lib/seo'

// ── Step components ──────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#666' }}>Step {step} of {total}</span>
        <span style={{ fontSize: '13px', color: '#085041', fontWeight: 500 }}>
          {Math.round((step / total) * 100)}% complete
        </span>
      </div>
      <div style={{ height: '6px', backgroundColor: '#e2e2e2', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(step / total) * 100}%`,
          backgroundColor: '#085041',
          borderRadius: '99px',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
      {children}
    </label>
  )
}

function Input({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px',
        border: '1px solid #e2e2e2',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: 'white',
        ...style
      }}
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px',
        border: '1px solid #e2e2e2',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: 'white',
        cursor: 'pointer'
      }}
    >
      {children}
    </select>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NextButton({ onClick, loading, disabled, children }: { onClick: () => void; loading?: boolean; disabled?: boolean; children: React.ReactNode }) {
  const off = loading || disabled
  return (
    <button
      onClick={onClick}
      disabled={off}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: off ? '#9fd6b8' : '#085041',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: 600,
        cursor: off ? 'not-allowed' : 'pointer',
        marginTop: '8px'
      }}
    >
      {children}
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: '#666',
        fontSize: '14px',
        cursor: 'pointer',
        marginBottom: '24px',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      ← Back
    </button>
  )
}

// ── Step 1: Studio Basics ─────────────────────────────────
function Step1({ data, onChange, onNext, acceptTerms, onAcceptTerms }: {
  data: StudioData
  onChange: (key: string, value: string) => void
  onNext: () => void
  acceptTerms: boolean
  onAcceptTerms: (v: boolean) => void
}) {
  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>Tell us about your studio</h2>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>This takes about 2 minutes</p>

      <Field label="Studio name">
        <Input
          placeholder="e.g. Sunrise Yoga Studio"
          value={data.name}
          onChange={e => onChange('name', e.target.value)}
        />
      </Field>

      <Field label="Your first name">
        <Input
          placeholder="e.g. Sarah"
          value={data.ownerName}
          onChange={e => onChange('ownerName', e.target.value)}
        />
      </Field>

      <Field label="Country">
        <Select value={data.country} onChange={e => onChange('country', e.target.value)}>
          <option value="AU">Australia</option>
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="NZ">New Zealand</option>
          <option value="CA">Canada</option>
          <option value="SG">Singapore</option>
          <option value="IN">India</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>

      <Field label="Currency">
        <Select value={data.currency} onChange={e => onChange('currency', e.target.value)}>
          <option value="AUD">AUD — Australian Dollar</option>
          <option value="USD">USD — US Dollar</option>
          <option value="GBP">GBP — British Pound</option>
          <option value="NZD">NZD — New Zealand Dollar</option>
          <option value="CAD">CAD — Canadian Dollar</option>
          <option value="SGD">SGD — Singapore Dollar</option>
          <option value="INR">INR — Indian Rupee</option>
        </Select>
      </Field>

      <Field label="Timezone">
        <Select value={data.timezone} onChange={e => onChange('timezone', e.target.value)}>
          <option value="Australia/Sydney">Sydney / Melbourne (AEST)</option>
          <option value="Australia/Brisbane">Brisbane (AEST no DST)</option>
          <option value="Australia/Perth">Perth (AWST)</option>
          <option value="Australia/Adelaide">Adelaide (ACST)</option>
          <option value="Pacific/Auckland">Auckland (NZST)</option>
          <option value="Asia/Singapore">Singapore (SGT)</option>
          <option value="Asia/Kolkata">India (IST)</option>
          <option value="America/New_York">New York (EST)</option>
          <option value="America/Los_Angeles">Los Angeles (PST)</option>
          <option value="America/Chicago">Chicago (CST)</option>
          <option value="Europe/London">London (GMT)</option>
          <option value="Europe/Paris">Paris (CET)</option>
        </Select>
      </Field>

      <Field label="What kind of sessions do you run?">
        <Select value={data.sessionType} onChange={e => onChange('sessionType', e.target.value)}>
          <option value="yoga">Yoga</option>
          <option value="fitness">Fitness / Gym</option>
          <option value="pilates">Pilates</option>
          <option value="dance">Dance</option>
          <option value="martial_arts">Martial Arts</option>
          <option value="wellness">Wellness / Meditation</option>
          <option value="workshop">Workshops / Education</option>
          <option value="other">Other</option>
        </Select>
      </Field>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#444', cursor: 'pointer', margin: '4px 0 8px' }}>
        <input type="checkbox" checked={acceptTerms} onChange={e => onAcceptTerms(e.target.checked)} style={{ marginTop: '2px' }} />
        <span>
          I accept the{' '}
          <a href="https://calastudio.app/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#085041', fontWeight: 600 }}>Terms &amp; Conditions</a>.
        </span>
      </label>

      <NextButton onClick={onNext} disabled={!data.name.trim() || !acceptTerms}>
        Continue →
      </NextButton>
    </div>
  )
}

// ── Step 2: First Session ─────────────────────────────────
function Step2({ data, onChange, onNext, onBack }: {
  data: StudioData
  onChange: (key: string, value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>Create your first session</h2>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>
        You can edit all the details later — just get something on the schedule.
      </p>

      <Field label="Session name">
        <Input
          placeholder="e.g. Morning Vinyasa"
          value={data.sessionName}
          onChange={e => onChange('sessionName', e.target.value)}
        />
      </Field>

      <Field label="Delivery mode">
        <Select value={data.deliveryMode} onChange={e => onChange('deliveryMode', e.target.value)}>
          <option value="in_person">In-person</option>
          <option value="online">Online</option>
        </Select>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Day">
          <Select value={data.sessionDay} onChange={e => onChange('sessionDay', e.target.value)}>
            <option value="MO">Monday</option>
            <option value="TU">Tuesday</option>
            <option value="WE">Wednesday</option>
            <option value="TH">Thursday</option>
            <option value="FR">Friday</option>
            <option value="SA">Saturday</option>
            <option value="SU">Sunday</option>
          </Select>
        </Field>

        <Field label="Start time">
          <Input
            type="time"
            value={data.sessionTime}
            onChange={e => onChange('sessionTime', e.target.value)}
          />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Duration">
          <Select value={data.sessionDuration} onChange={e => onChange('sessionDuration', e.target.value)}>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="75">75 minutes</option>
            <option value="90">90 minutes</option>
            <option value="120">2 hours</option>
          </Select>
        </Field>

        <Field label="Max capacity">
          <Input
            type="number"
            placeholder="12"
            min="1"
            value={data.sessionCapacity}
            onChange={e => onChange('sessionCapacity', e.target.value)}
          />
        </Field>
      </div>

      {data.deliveryMode === 'in_person' ? (
        <Field label="Location name">
          <Input
            placeholder="e.g. Studio 1, Bondi Beach"
            value={data.locationName}
            onChange={e => onChange('locationName', e.target.value)}
          />
        </Field>
      ) : null}

      <NextButton onClick={onNext}>Continue →</NextButton>
    </div>
  )
}

// ── Step 3: Pricing ───────────────────────────────────────
function Step3({ data, onChange, onNext, onBack }: {
  data: StudioData
  onChange: (key: string, value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>Set your drop-in price</h2>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>
        This is your standard single-session price. You can add passes, memberships, and discounts later.
      </p>

      <Field label={`Drop-in price (${data.currency})`}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#666',
            fontSize: '14px'
          }}>
            {data.currency === 'GBP' ? '£' : data.currency === 'USD' ? '$' : '$'}
          </span>
          <Input
            type="number"
            placeholder="25.00"
            min="0"
            step="0.50"
            value={data.dropInPrice}
            onChange={e => onChange('dropInPrice', e.target.value)}
            style={{ paddingLeft: '28px' } as React.CSSProperties}
          />
        </div>
      </Field>

      <div style={{
        padding: '16px',
        backgroundColor: '#e8f5ee',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#085041',
        marginBottom: '24px'
      }}>
        💡 Set to 0 for free sessions. You can create class passes and membership pricing after setup.
      </div>

      <NextButton onClick={onNext}>Continue →</NextButton>
    </div>
  )
}

// ── Step 4: Theme ─────────────────────────────────────────
// The studio's public-page look (design handoff §"Onboarding picker"). One template, five themes;
// changeable later in Settings. Swatches are painted in each theme's own tokens.
function ThemeStep({ data, onChange, onNext, onBack }: {
  data: StudioData
  onChange: (key: string, value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>Choose how your studio page looks</h2>
      <p style={{ color: '#666', marginBottom: '28px', fontSize: '14px' }}>
        Every theme carries the same pages — schedule, teachers, pricing, booking. You can change it
        any time in Settings, and your logo and brand colour come along.
      </p>

      <ThemePicker
        value={data.theme}
        onChange={(key) => onChange('theme', key)}
        sampleTitle={data.sessionName?.trim() || undefined}
      />

      <NextButton onClick={onNext}>Continue →</NextButton>
    </div>
  )
}

// ── Step 5: Payments ──────────────────────────────────────
function Step4({ onNext, onSkip, onBack, loading }: {
  onNext: () => void
  onSkip: () => void
  onBack: () => void
  loading?: boolean
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>Connect payments</h2>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>
        We use Stripe so your students can pay by card, Apple Pay, or Google Pay.
      </p>

      <div style={{
        border: '1px solid #e2e2e2',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#635bff',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '18px'
          }}>S</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>Stripe</div>
            <div style={{ fontSize: '13px', color: '#666' }}>Trusted by millions of businesses</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {[
            '✓ Members pay you directly, into your own Stripe account',
            '✓ Cards, Apple Pay, Google Pay accepted',
            '✓ Money paid directly to your bank account',
            '✓ Takes about 5 minutes to set up',
          ].map((item, i) => (
            <div key={i} style={{ fontSize: '14px', color: '#444' }}>{item}</div>
          ))}
        </div>

        <NextButton onClick={onNext} loading={loading}>
          {loading ? 'Setting up…' : 'Connect with Stripe →'}
        </NextButton>
      </div>

      <button
        onClick={onSkip}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: 'transparent',
          color: '#666',
          border: '1px solid #e2e2e2',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        Skip for now — I&apos;ll connect payments later
      </button>

      <p style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '12px' }}>
        You can still create your booking page — payments will be enabled after connecting Stripe.
      </p>
    </div>
  )
}

// ── Step 5: Done! ─────────────────────────────────────────
function Step5({ data, orgSlug, stripeNote }: { data: StudioData; orgSlug: string; stripeNote?: string }) {
  const bookingUrl = `${orgSlug}.${STUDIO_DOMAIN}`

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '64px',
        height: '64px',
        backgroundColor: '#e8f5ee',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        fontSize: '32px'
      }}>
        🎉
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        {data.name} is live!
      </h2>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>
        Your booking page is ready. Share it with your students.
      </p>

      <div style={{
        backgroundColor: '#f4f4f4',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <span style={{ fontSize: '14px', color: '#085041', fontWeight: 500 }}>
          {bookingUrl}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(studioOrigin(orgSlug))}
          style={{
            padding: '6px 14px',
            backgroundColor: '#085041',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Copy link
        </button>
      </div>

      {stripeNote && (
        <div style={{
          padding: '12px 16px', backgroundColor: '#fff8e6', border: '1px solid #f0e0b0',
          borderRadius: '8px', fontSize: '13px', color: '#7a4f00', marginBottom: '24px', textAlign: 'left',
        }}>
          {stripeNote}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
          <a href="/dashboard"
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            backgroundColor: '#085041',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
            textAlign: 'center'
          }}>
          Go to my dashboard &#8594;
        </a>
        
          <a href="/dashboard/sessions/new"
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            backgroundColor: 'transparent',
            color: '#085041',
            border: '1px solid #085041',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'none',
            textAlign: 'center'
          }}>
          Add another session
        </a>
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────
interface StudioData {
  name: string
  ownerName: string
  country: string
  currency: string
  timezone: string
  sessionType: string
  sessionName: string
  deliveryMode: string
  sessionDay: string
  sessionTime: string
  sessionDuration: string
  sessionCapacity: string
  locationName: string
  dropInPrice: string
  theme: ThemeKey
  email: string
}

// ── Main Wizard ───────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [orgSlug, setOrgSlug] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState('')
  const [stripeNote, setStripeNote] = useState('')
  const [orgId, setOrgId] = useState('')
  const [planNote, setPlanNote] = useState('')

  // Guard the wizard: must be signed in, and must not already have a studio.
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) { router.replace('/dashboard'); return }
      // CalaStudio admins (Travel Engine staff) with no studio of their own belong in /admin, not here.
      const me = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null)
      if (me?.ok && (await me.json().catch(() => null))?.is_platform_admin === true) { router.replace('/admin'); return }
      setChecking(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [data, setData] = useState<StudioData>({
    name: '',
    ownerName: '',
    country: 'AU',
    currency: 'AUD',
    timezone: 'Australia/Sydney',
    sessionType: 'yoga',
    sessionName: '',
    deliveryMode: 'in_person',
    sessionDay: 'MO',
    sessionTime: '09:00',
    sessionDuration: '60',
    sessionCapacity: '12',
    locationName: '',
    dropInPrice: '',
    theme: 'classic',
    email: '',
  })

  const update = (key: string, value: string) => {
    setData(prev => ({ ...prev, [key]: value }) as StudioData)
  }

  // Creates the studio and returns { id, slug } — or null after setting `error`.
  const createOrg = async (): Promise<{ id: string; slug: string } | null> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { router.push('/login'); return null }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: data.name,
        email: session?.user?.email ?? '',
        timezone: data.timezone,
        currency: data.currency,
        country: data.country,
        locale: 'en-AU',
        theme: data.theme,
        accept_terms: acceptTerms,
      }),
    })
    const org = await response.json().catch(() => null)
    if (!response.ok || !org?.slug) {
      setError(org?.error ?? 'Something went wrong creating your studio. Please try again.')
      return null
    }
    return { id: org.id, slug: org.slug }
  }

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    try {
      const org = await createOrg()
      if (!org) return
      setOrgSlug(org.slug)
      setOrgId(org.id)
      setStep(6) // plan, then done
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // "Connect with Stripe" — create the studio, then open Stripe Connect in a new tab (per
  // 01-onboarding.md; the OAuth callback lands on /dashboard/settings). The wizard still advances
  // to the done screen here so the "your studio is live" moment isn't lost.
  const handleConnectStripe = async () => {
    setLoading(true)
    setError('')
    try {
      const org = await createOrg()
      if (!org) return
      setOrgSlug(org.slug)
      setOrgId(org.id)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/stripe/connect`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        const body = await res.json().catch(() => null)
        if (res.ok && body?.url) {
          window.open(body.url, '_blank', 'noopener')
          setStripeNote('Stripe opened in a new tab — finish connecting there. You can also do it later from Settings → Payments.')
        } else {
          setStripeNote("We couldn't start Stripe just now. Connect it later from Settings → Payments.")
        }
      } catch {
        setStripeNote("We couldn't start Stripe just now. Connect it later from Settings → Payments.")
      }
      setStep(6)
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const TOTAL_STEPS = 6

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4', color: '#666' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f4f4f4',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 24px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '48px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: '#085041',
            color: 'white',
            fontWeight: 700,
            fontSize: '16px',
            padding: '6px 16px',
            borderRadius: '6px',
            marginBottom: '24px'
          }}>
            CalaStudio
          </div>

          {step < 7 && <ProgressBar step={step} total={TOTAL_STEPS} />}
        </div>

        {/* Steps */}
        {step === 1 && (
          <Step1 data={data} onChange={update} onNext={() => setStep(2)} acceptTerms={acceptTerms} onAcceptTerms={setAcceptTerms} />
        )}
        {step === 2 && (
          <Step2 data={data} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <Step3 data={data} onChange={update} onNext={() => setStep(4)} onBack={() => setStep(2)} />
        )}
        {step === 4 && (
          <ThemeStep data={data} onChange={update} onNext={() => setStep(5)} onBack={() => setStep(3)} />
        )}
        {step === 5 && (
          <>
            <Step4
              onNext={handleConnectStripe}
              onSkip={handleComplete}
              onBack={() => setStep(4)}
              loading={loading}
            />
            {error && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                {error}
              </div>
            )}
          </>
        )}
        {step === 6 && (
          // The studio exists from here on, so this step can't go back — the plan is the last choice.
          <PlanStep orgId={orgId} currency={data.currency} onDone={note => { setPlanNote(note ?? ''); setStep(7) }} />
        )}
        {step === 7 && (
          <Step5 data={data} orgSlug={orgSlug} stripeNote={[stripeNote, planNote].filter(Boolean).join(' ')} />
        )}
      </div>
    </div>
  )
}