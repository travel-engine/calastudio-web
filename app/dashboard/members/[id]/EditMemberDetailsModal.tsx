'use client'

import { useState } from 'react'
import { color } from '@/lib/ui/tokens'
import { Button, Field, Modal, alertStyle, controlStyle } from '@/app/components/admin'

// "Edit details" on the member page. PATCH /members/{id} (permission member.edit_details).
// Email is never editable here: it's how the member signs in, so they change it themselves.
// A person's name, phone, date of birth, emergency contact and address are shared with every
// studio they belong to; when they also belong to another studio the API reports
// shared_details_editable = false and only this studio's own fields (person type, gender) can change.

export interface EditableMember {
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
  shared_details_editable?: boolean
}

const PERSON_TYPES = [
  { value: 'adult', label: 'Adult' }, { value: 'senior', label: 'Senior' },
  { value: 'student', label: 'Student' }, { value: 'child', label: 'Child' },
]
const GENDERS = [
  { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' }, { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export default function EditMemberDetailsModal<T extends EditableMember>({ api, memberId, member, onClose, onSaved }: {
  api: (path: string, init?: RequestInit) => Promise<Response>
  memberId: string
  member: T
  onClose: () => void
  onSaved: (updated: T) => void
}) {
  const shared = member.shared_details_editable !== false
  const [form, setForm] = useState({
    first_name: member.first_name ?? '',
    last_name: member.last_name ?? '',
    phone: member.phone ?? '',
    date_of_birth: member.date_of_birth ?? '',
    emergency_contact_name: member.emergency_contact_name ?? '',
    emergency_contact_phone: member.emergency_contact_phone ?? '',
    address: member.address ?? '',
    person_type: member.person_type ?? '',
    gender: member.gender ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (shared && (!form.first_name.trim() || !form.last_name.trim())) { setError('First and last name are required.'); return }
    setSaving(true)
    setError('')
    const body = {
      ...(shared ? {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        address: form.address || null,
      } : {}),
      person_type: form.person_type || null,
      gender: form.gender || null,
    }
    try {
      const res = await api(`/members/${memberId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.code === 'shared_details_locked'
          ? "This member also belongs to another studio, so only they can change their name and contact details. Ask them to update it in their account."
          : data?.code === 'forbidden' ? "You don't have permission to edit member details."
            : data?.error || "Couldn't save the changes. Please try again.")
        return
      }
      onSaved({ ...member, ...data })
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const ro = !shared
  const two = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 14px' } as const

  return (
    <Modal title="Edit details" onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ro && (
          <div style={alertStyle('warn')}>
            This member also belongs to another studio, so their name and contact details are shared. Only they can change those, in their account. You can still set their person type and gender here.
          </div>
        )}
        <div style={two}>
          <Field label="First name" htmlFor="ed-first">
            <input id="ed-first" value={form.first_name} onChange={set('first_name')} disabled={ro} style={controlStyle} autoComplete="off" />
          </Field>
          <Field label="Last name" htmlFor="ed-last">
            <input id="ed-last" value={form.last_name} onChange={set('last_name')} disabled={ro} style={controlStyle} autoComplete="off" />
          </Field>
        </div>
        <Field label="Email" htmlFor="ed-email" hint="Members sign in with their email, so only they can change it, from their account.">
          <input id="ed-email" aria-describedby="ed-email-hint" value={member.email} disabled style={{ ...controlStyle, color: color.muted }} />
        </Field>
        <div style={two}>
          <Field label="Phone (optional)" htmlFor="ed-phone">
            <input id="ed-phone" type="tel" value={form.phone} onChange={set('phone')} disabled={ro} style={controlStyle} autoComplete="off" />
          </Field>
          <Field label="Date of birth (optional)" htmlFor="ed-dob">
            <input id="ed-dob" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} disabled={ro} style={controlStyle} />
          </Field>
        </div>
        <div style={two}>
          <Field label="Emergency contact (optional)" htmlFor="ed-ecname">
            <input id="ed-ecname" value={form.emergency_contact_name} onChange={set('emergency_contact_name')} disabled={ro} style={controlStyle} autoComplete="off" />
          </Field>
          <Field label="Emergency contact phone" htmlFor="ed-ecphone">
            <input id="ed-ecphone" type="tel" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} disabled={ro} style={controlStyle} autoComplete="off" />
          </Field>
        </div>
        <Field label="Address (optional)" htmlFor="ed-address">
          <input id="ed-address" value={form.address} onChange={set('address')} disabled={ro} style={controlStyle} autoComplete="off" />
        </Field>
        <div style={two}>
          <Field label="Person type" htmlFor="ed-ptype">
            <select id="ed-ptype" value={form.person_type} onChange={set('person_type')} style={controlStyle}>
              <option value="">Not set</option>
              {PERSON_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Gender" htmlFor="ed-gender">
            <select id="ed-gender" value={form.gender} onChange={set('gender')} style={controlStyle}>
              <option value="">Not set</option>
              {GENDERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {error && <div role="alert" style={alertStyle('danger')}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </Modal>
  )
}
