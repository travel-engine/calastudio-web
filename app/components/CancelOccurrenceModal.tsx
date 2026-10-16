'use client'

import { useState } from 'react'
import { color, space } from '@/lib/ui/tokens'
import { Button, Field, Modal, CheckRow, alertStyle, controlStyle } from '@/app/components/admin'

interface Props {
  occurrenceId: string
  orgId: string
  token: string
  onClose: () => void
  onCancelled: (updated: unknown) => void
}

// POST /occurrences/{id}/cancel — cascades to every confirmed booking (cancelled, credits returned).
// show_on_schedule: keep the cancelled occurrence visible (struck-through) on the public schedule,
// or drop it from that listing entirely. Default true, matching the API default.
export default function CancelOccurrenceModal({ occurrenceId, orgId, token, onClose, onCancelled }: Props) {
  const [reason, setReason] = useState('')
  const [showOnSchedule, setShowOnSchedule] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/occurrences/${occurrenceId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() || null, show_on_schedule: showOnSchedule }),
      })
      if (res.ok) {
        onCancelled(await res.json())
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Could not cancel this class.')
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Cancel this class" onClose={onClose} width={460} zIndex={70}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
        <p style={{ margin: 0, fontSize: 15, color: color.ink2, lineHeight: 1.45 }}>
          Every confirmed booking will be cancelled and any pass credits used will be returned.
        </p>

        {error && <div role="alert" style={alertStyle()}>{error}</div>}

        <Field label="Reason (optional)" htmlFor="cancel-reason">
          <input id="cancel-reason" type="text" placeholder="e.g. teacher unwell, venue unavailable"
            value={reason} onChange={e => setReason(e.target.value)} style={controlStyle} />
        </Field>

        <CheckRow checked={showOnSchedule} onChange={setShowOnSchedule}>
          Keep it on the public schedule, marked as cancelled. Untick to remove it from the schedule entirely.
        </CheckRow>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          <Button onClick={onClose} style={{ flex: '1 1 140px' }}>Keep class</Button>
          <Button variant="destructive" onClick={submit} disabled={busy} style={{ flex: '1 1 140px' }}>
            {busy ? 'Cancelling…' : 'Cancel class'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
