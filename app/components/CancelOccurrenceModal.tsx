'use client'

import { useState } from 'react'

interface Props {
  occurrenceId: string
  orgId: string
  token: string
  onClose: () => void
  onCancelled: (updated: unknown) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '14px', outline: 'none', backgroundColor: 'white',
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
        setError(data?.error ?? 'Could not cancel this occurrence.')
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '24px',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
        maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Cancel this occurrence</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
        </div>

        <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
          Every confirmed booking will be cancelled and any pass credits used will be returned.
        </p>

        {error && (
          <div style={{ padding: '10px 12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
              Reason (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. teacher unwell, venue unavailable"
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={inputStyle}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#444', cursor: 'pointer' }}>
            <input type="checkbox" checked={showOnSchedule} onChange={e => setShowOnSchedule(e.target.checked)} style={{ marginTop: '2px' }} />
            <span>Keep it on the public schedule, marked as cancelled. Uncheck to remove it from the schedule entirely.</span>
          </label>

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#444', fontWeight: 500,
              }}
            >
              Keep occurrence
            </button>
            <button
              onClick={submit}
              disabled={busy}
              style={{
                flex: 1, padding: '10px', backgroundColor: busy ? '#e69a9a' : '#8b1a1a', color: 'white',
                border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {busy ? 'Cancelling…' : 'Cancel occurrence'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
