'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatShortDate } from '@/lib/dates'
import { color } from '@/lib/ui/tokens'
import { Button, TextArea, alertStyle } from '@/app/components/admin'

// Dated notes on a member, add only (no edit, no delete): staff notes plus automatic ones such as
// "Welcome email sent…" (author "CalaStudio"). GET/POST /members/{id}/notes, admin-only in the API.
// Rendered inside the member page's Notes card; never shown to the member.

interface MemberNote { id: string; body: string; created_at: string; author_name: string | null }

const MAX = 2000

export default function MemberNotesLog({ api, memberId, timeZone }: {
  api: (path: string, init?: RequestInit) => Promise<Response>
  memberId: string
  timeZone?: string | null
}) {
  const [notes, setNotes] = useState<MemberNote[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await api(`/members/${memberId}/notes`).catch(() => null)
    setNotes(res?.ok ? await res.json() : [])
  }, [api, memberId])

  useEffect(() => { load() }, [load])

  const add = async () => {
    const body = draft.trim()
    if (!body) return
    setSaving(true)
    setError('')
    try {
      const res = await api(`/members/${memberId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        setError(b?.error || "Couldn't save the note. Please try again.")
        return
      }
      const created: MemberNote = await res.json()
      setNotes(n => [created, ...(n ?? [])])
      setDraft('')
    } catch {
      setError("Couldn't save the note. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TextArea aria-label="Add a note" placeholder="Add a note…" value={draft} maxLength={MAX} rows={2}
        onChange={e => setDraft(e.target.value)} style={{ minHeight: 64, background: color.surface }} />
      {draft.trim() && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button size="sm" variant="primary" onClick={add} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</Button>
          <span style={{ fontSize: 13, color: color.muted }}>Notes can&rsquo;t be edited or removed once saved.</span>
        </div>
      )}
      {error && <div role="alert" style={alertStyle('danger')}>{error}</div>}

      {notes && notes.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map(n => (
            <li key={n.id} style={{ borderTop: `1px solid ${color.divider}`, paddingTop: 10 }}>
              <div style={{ fontSize: 13, color: color.muted, marginBottom: 2 }}>
                {formatShortDate(n.created_at, timeZone)} · {n.author_name || 'CalaStudio'}
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
