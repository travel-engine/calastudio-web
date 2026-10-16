'use client'

import { useState } from 'react'
import { space } from '@/lib/ui/tokens'
import { Button, Field, Modal, CheckRow, alertStyle, controlStyle } from '@/app/components/admin'

interface CreatedMember {
  id: string
  first_name: string
  last_name: string
}

interface Props {
  orgId: string
  token: string
  onClose: () => void
  onCreated: (member: CreatedMember) => void
}

// "Add new member" quick-add — POST /organisations/{orgId}/members (03-member-management.md §3.6
// studio-side creation, distinct from CSV bulk import). Waiver-on-behalf acceptance is supported by
// the endpoint but left out here; the member accepts it themselves via the welcome email / booking
// flow, and the reason-required paper-waiver path can be a follow-up.
export default function AddMemberModal({ orgId, token, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)
  const [confirmedPermission, setConfirmedPermission] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError('First name, last name and email are required.')
      return
    }
    if (!confirmedPermission) {
      setError('Please confirm you have permission to add this person.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          confirmed_permission_to_register: true,
          send_welcome_email: sendWelcomeEmail,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        onCreated({ id: created.global_user_id, first_name: form.first_name.trim(), last_name: form.last_name.trim() })
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Could not add this member.')
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add a new member" onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
        {error && <div role="alert" style={alertStyle()}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Field label="First name" htmlFor="am-first">
            <input id="am-first" type="text" autoComplete="off" value={form.first_name} onChange={set('first_name')} style={controlStyle} />
          </Field>
          <Field label="Last name" htmlFor="am-last">
            <input id="am-last" type="text" autoComplete="off" value={form.last_name} onChange={set('last_name')} style={controlStyle} />
          </Field>
        </div>
        <Field label="Email" htmlFor="am-email">
          <input id="am-email" type="email" autoComplete="off" value={form.email} onChange={set('email')} style={controlStyle} />
        </Field>
        <Field label="Phone (optional)" htmlFor="am-phone">
          <input id="am-phone" type="tel" autoComplete="off" value={form.phone} onChange={set('phone')} style={controlStyle} />
        </Field>

        <div>
          <CheckRow checked={sendWelcomeEmail} onChange={setSendWelcomeEmail}>Send a welcome email with a password-set link</CheckRow>
          <CheckRow checked={confirmedPermission} onChange={setConfirmedPermission}>I have this person&rsquo;s permission to add them to the studio.</CheckRow>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Button onClick={onClose} style={{ flex: '1 1 140px' }}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving || !confirmedPermission} style={{ flex: '1 1 140px' }}>
            {saving ? 'Adding…' : 'Add member'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
