'use client'

import { useState } from 'react'

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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '14px', outline: 'none', backgroundColor: 'white',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }

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
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
        maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Add a new member</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
        </div>

        {error && (
          <div style={{ padding: '10px 12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First name</label>
              <input type="text" value={form.first_name} onChange={set('first_name')} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last name</label>
              <input type="text" value={form.last_name} onChange={set('last_name')} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={set('email')} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Phone (optional)</label>
            <input type="tel" value={form.phone} onChange={set('phone')} style={inputStyle} />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#444', cursor: 'pointer' }}>
            <input type="checkbox" checked={sendWelcomeEmail} onChange={e => setSendWelcomeEmail(e.target.checked)} style={{ marginTop: '2px' }} />
            <span>Send a welcome email with a password-set link</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#444', cursor: 'pointer' }}>
            <input type="checkbox" checked={confirmedPermission} onChange={e => setConfirmedPermission(e.target.checked)} style={{ marginTop: '2px' }} />
            <span>I have this person&rsquo;s permission to add them to the studio.</span>
          </label>

          <button
            onClick={submit}
            disabled={saving || !confirmedPermission}
            style={{
              padding: '11px', backgroundColor: saving || !confirmedPermission ? '#9fd6b8' : '#085041',
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              cursor: saving || !confirmedPermission ? 'default' : 'pointer', marginTop: '4px',
            }}
          >
            {saving ? 'Adding…' : 'Add member'}
          </button>
        </div>
      </div>
    </div>
  )
}
