'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, GraduationCap, LayoutDashboard, UserRound } from 'lucide-react'
import { Button, alertStyle } from '@/app/components/admin'
import { FormField, TextInput } from '@/app/components/admin/FormKit'
import { color, font } from '@/lib/ui/tokens'
import {
  type DemoInfo, type DemoVisitor, type Persona, type PersonaKey,
  fetchDemoInfo, forgetVisitor, formatResetTime, readVisitor, signInAsPersona, signUpVisitor, demoStudioUrl,
} from '@/lib/demo'

// "Try the demo": sign up once (name, email, studio, marketing consent), then pick who to be in the
// shared Saltwater studio. The visitor's access lasts 7 days, kept in this browser (lib/demo), so the
// demo strip's "Switch view" brings them straight back to the picker.

const PERSONA_ICON: Record<PersonaKey, typeof UserRound> = {
  owner: LayoutDashboard,
  teacher: GraduationCap,
  basic_teacher: CalendarDays,
  member: UserRound,
}

// The API sends role keys; show them the way the dashboard's Team page would.
const ROLE_LABEL: Record<string, string> = {
  admin: 'Studio owner',
  teacher_super: 'Super teacher',
  teacher_general: 'Teacher',
  teacher_basic: 'Basic teacher',
  front_desk: 'Front desk',
  member: 'Member',
}

type Phase = 'loading' | 'unavailable' | 'ready'

export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [info, setInfo] = useState<DemoInfo | null>(null)
  const [visitor, setVisitor] = useState<DemoVisitor | null>(null)

  useEffect(() => {
    void (async () => {
      const d = await fetchDemoInfo()
      if (!d?.enabled) { setPhase('unavailable'); return }
      setInfo(d)
      setVisitor(readVisitor())
      setPhase('ready')
    })()
  }, [])

  const resetTime = info ? formatResetTime(info.next_reset_at) : null

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: 8, background: color.primary, color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700 }}>C</span>
        <span style={{ fontWeight: 700, fontSize: 17 }}>CalaStudio</span>
      </div>

      <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: 40, lineHeight: 1.1, margin: '0 0 10px' }}>
        Try the demo
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.5, color: color.ink2, margin: '0 0 28px', maxWidth: 620 }}>
        Look around {info?.studio_name ?? 'a sample yoga and Pilates studio'} as its owner, a teacher or a member.
        Book classes, sell passes, check reports, change anything you like.
      </p>

      {phase === 'loading' && <p style={{ color: color.muted }}>Loading…</p>}

      {phase === 'unavailable' && (
        <div role="alert" style={alertStyle('warn')}>The demo isn&apos;t available right now. Please try again a little later.</div>
      )}

      {phase === 'ready' && info && (visitor
        ? <PersonaPicker visitor={visitor} info={info} onExpired={() => setVisitor(null)} />
        : <SignUp onDone={setVisitor} />)}

      {phase === 'ready' && resetTime && (
        <p style={{ marginTop: 28, fontSize: 14, color: color.muted, lineHeight: 1.5 }}>
          The demo studio is shared with other visitors and resets every night at {resetTime} (your time), so anything you change is undone overnight.
          It uses made-up people and test payments only. See our <Link href="/privacy" style={{ color: color.primary }}>Privacy Policy</Link>.
        </p>
      )}
    </main>
  )
}

function SignUp({ onDone }: { onDone: (v: DemoVisitor) => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', studio_name: '', marketing_consent: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: k === 'marketing_consent' ? e.target.checked : e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMessage(''); setErrors({})
    const r = await signUpVisitor(form)
    setBusy(false)
    if (r.ok) { onDone(r.visitor); return }
    setErrors(r.fieldErrors ?? {})
    setMessage(r.message)
  }

  const err = (k: string) => errors[k] && (
    <span role="alert" style={{ fontSize: 13, color: color.dangerInk, marginTop: -10, marginBottom: 12, display: 'block' }}>{errors[k]}</span>
  )

  return (
    <form onSubmit={submit} noValidate style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12, padding: '24px 24px 20px', maxWidth: 520 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Tell us a little about you</h2>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: color.muted }}>Your access lasts 7 days on this device.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', columnGap: 14 }}>
        <div><FormField label="First name"><TextInput autoComplete="given-name" value={form.first_name} onChange={set('first_name')} required aria-invalid={!!errors.first_name} /></FormField>{err('first_name')}</div>
        <div><FormField label="Last name"><TextInput autoComplete="family-name" value={form.last_name} onChange={set('last_name')} required aria-invalid={!!errors.last_name} /></FormField>{err('last_name')}</div>
      </div>
      <FormField label="Email"><TextInput type="email" autoComplete="email" value={form.email} onChange={set('email')} required aria-invalid={!!errors.email} /></FormField>{err('email')}
      <FormField label="Your studio's name" hint="So we know who's looking. Leave it blank if you don't have one yet.">
        <TextInput autoComplete="organization" value={form.studio_name} onChange={set('studio_name')} aria-invalid={!!errors.studio_name} />
      </FormField>{err('studio_name')}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: color.ink2, cursor: 'pointer', margin: '2px 0 18px', lineHeight: 1.45 }}>
        <input type="checkbox" checked={form.marketing_consent} onChange={set('marketing_consent')} style={{ width: 18, height: 18, accentColor: color.primary, marginTop: 1, flexShrink: 0 }} />
        Send me occasional CalaStudio news and tips (optional; unsubscribe any time)
      </label>
      {message && <div role="alert" style={{ ...alertStyle('danger'), marginBottom: 14 }}>{message}</div>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Opening the demo…' : 'Open the demo'}</Button>
    </form>
  )
}

function PersonaPicker({ visitor, info, onExpired }: { visitor: DemoVisitor; info: DemoInfo; onExpired: () => void }) {
  const [busy, setBusy] = useState<PersonaKey | null>(null)
  const [message, setMessage] = useState('')

  const open = async (p: Persona) => {
    setBusy(p.key); setMessage('')
    const r = await signInAsPersona(visitor, p.key)
    if (r.ok) { window.location.href = r.url; return }
    setBusy(null)
    if (r.reason === 'expired') { onExpired(); return }
    setMessage(r.message)
  }

  const startOver = () => { forgetVisitor(); onExpired() }

  return (
    <section aria-labelledby="persona-heading">
      <h2 id="persona-heading" style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>
        {visitor.first_name ? `Hi ${visitor.first_name}, who would you like to be?` : 'Who would you like to be?'}
      </h2>
      <p style={{ margin: '0 0 18px', fontSize: 15, color: color.muted }}>You can switch any time from the bar at the top of the demo.</p>

      {message && <div role="alert" style={{ ...alertStyle('warn'), marginBottom: 14 }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {visitor.personas.map(p => {
          const Icon = PERSONA_ICON[p.key] ?? UserRound
          return (
            <button key={p.key} type="button" onClick={() => void open(p)} disabled={busy !== null}
              style={{
                textAlign: 'left', display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 18px 16px',
                background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12,
                cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== p.key ? 0.6 : 1, font: 'inherit', color: 'inherit',
              }}>
              <span aria-hidden style={{ width: 40, height: 40, borderRadius: 10, background: color.primarySoft, color: color.primaryInk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 16 }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: color.primary, margin: '2px 0 6px' }}>{ROLE_LABEL[p.role] ?? p.role}</span>
                <span style={{ display: 'block', fontSize: 14, color: color.ink2, lineHeight: 1.45 }}>{p.description}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 14, fontWeight: 600, color: color.primary }}>
                  {busy === p.key ? 'Opening…' : <>Open as {p.name.split(' ')[0]} <ArrowRight size={15} aria-hidden /></>}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p style={{ marginTop: 20, fontSize: 14, color: color.muted }}>
        Or just <a href={demoStudioUrl(info.studio_slug)} style={{ color: color.primary, fontWeight: 600 }}>browse {info.studio_name}&apos;s booking site</a> without signing in.
        {' '}Not {visitor.first_name || 'you'}? <button type="button" onClick={startOver} style={{ background: 'none', border: 'none', padding: 0, color: color.primary, fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>Start again</button>
      </p>
    </section>
  )
}
