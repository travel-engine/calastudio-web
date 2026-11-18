'use client'

import { useCallback, useEffect, useState } from 'react'
import { displayName } from '@/lib/names'
import { formatClock, formatDayMonth, formatShortDate } from '@/lib/dates'
import { color, tabularNums } from '@/lib/ui/tokens'
import { Chip, Modal, alertStyle, buttonStyle, controlStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'

// Staff "Manage pass" dialog: freeze/unfreeze, set credits, change start and expiry dates, credit history. Opened
// from Passes → Issued to members and from a member's profile. Thin over the API: every change is
// the existing member-passes endpoint (admin + teacher_super), and the server decides what's allowed.

export interface ManagedPass {
  id: string
  credits_total: number | null
  credits_remaining: number | null
  effective_from: string
  expires_at: string
  status: 'active' | 'low' | 'frozen' | 'expired' | 'exhausted'
  user?: { first_name: string; last_name: string; email: string } | null
  pass_template?: { name: string } | null
}

interface LedgerEntry {
  id: string
  movement_type: string
  credits_delta: number
  credits_after: number
  notes: string | null
  created_at: string
}

const passStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  active: { label: 'Active', tone: 'primary' },
  low: { label: 'Running low', tone: 'warn' },
  frozen: { label: 'Frozen', tone: 'info' },
  expired: { label: 'Expired', tone: 'neutral' },
  exhausted: { label: 'Used up', tone: 'neutral' },
}

const movementLabels: Record<string, string> = {
  purchase: 'Purchase',
  booking_debit: 'Booking',
  cancel_credit: 'Cancellation credit',
  expired_forfeit: 'Expired',
  promotion_credit: 'Promotion',
  studio_adjustment: 'Studio adjustment',
}

const inputStyle: React.CSSProperties = { ...controlStyle, padding: '10px 12px' }
const sectionStyle: React.CSSProperties = { borderTop: `1px solid ${color.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }
const headStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600 }
const smallLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: color.muted }

export default function ManagePassModal({ orgId, token, passId, timeZone, onClose, onChanged }: {
  orgId: string
  token: string
  passId: string
  timeZone?: string | null
  onClose: () => void
  /** Called with the updated pass after every successful change. */
  onChanged?: (pass: ManagedPass) => void
}) {
  const [pass, setPass] = useState<ManagedPass | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Credits: "Credits left" (the new balance) and "Change by" stay in step, so staff can type
  // whichever they know — "she has 4 left" or "give him 2 more".
  const [balance, setBalance] = useState('')
  const [change, setChange] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [startDate, setStartDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [datesReason, setDatesReason] = useState('')

  const api = useCallback((path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    }), [orgId, token])

  const load = useCallback(async () => {
    const p = await api(`/member-passes/${passId}`)
    if (p.ok) {
      const updated: ManagedPass = await p.json()
      setPass(updated)
      setStartDate(updated.effective_from.slice(0, 10))
      setExpiryDate(updated.expires_at.slice(0, 10))
      return updated
    }
    setError('Could not load this pass.')
    return null
  }, [api, passId])

  const loadLedger = useCallback(async () => {
    const l = await api(`/member-passes/${passId}/ledger`)
    if (l.ok) setLedger(await l.json())
  }, [api, passId])

  useEffect(() => { load(); loadLedger() }, [load, loadLedger])

  const afterChange = async () => {
    const updated = await load()
    await loadLedger()
    if (updated) onChanged?.(updated)
  }

  const post = async (path: string, body: unknown, failure: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await api(path, {
        method: 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? failure)
        return false
      }
      await afterChange()
      return true
    } catch {
      setError(failure)
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!pass) {
    return (
      <Modal title="Manage pass" onClose={onClose} width={560}>
        {error ? <div role="alert" style={alertStyle()}>{error}</div> : <p style={{ margin: 0, color: color.muted }}>Loading…</p>}
      </Modal>
    )
  }

  const credit = pass.credits_remaining !== null
  const current = pass.credits_remaining ?? 0
  const delta = change.trim() === '' ? 0 : Number(change)
  const target = current + delta
  const creditsValid = Number.isInteger(delta) && delta !== 0 && target >= 0

  const onBalance = (v: string) => {
    setBalance(v)
    const n = Number(v)
    setChange(v.trim() === '' || !Number.isInteger(n) ? '' : String(n - current))
  }
  const onChangeBy = (v: string) => {
    setChange(v)
    const n = Number(v)
    setBalance(v.trim() === '' || v === '-' || v === '+' || !Number.isInteger(n) ? '' : String(current + n))
  }

  const saveCredits = async () => {
    if (!creditsValid) { setError(target < 0 ? 'Credits left can’t be below 0.' : 'Enter the new number of credits left.'); return }
    if (!creditReason.trim()) { setError('Add a reason for the change.'); return }
    if (await post(`/member-passes/${pass.id}/adjust-credits`, { delta, reason: creditReason.trim() }, 'Could not change the credits.')) {
      setBalance(''); setChange(''); setCreditReason('')
    }
  }

  // One Save for both dates: each changed date is its own API call (extend-expiry / change-start),
  // expiry first so moving both later never trips the server's "start after expiry" check.
  const startChanged = !!startDate && startDate !== pass.effective_from.slice(0, 10)
  const expiryChanged = !!expiryDate && expiryDate !== pass.expires_at.slice(0, 10)
  const saveDates = async () => {
    if (!startDate || !expiryDate) { setError('Choose both dates.'); return }
    if (!startChanged && !expiryChanged) { setError('Change the start or expiry date first.'); return }
    if (startDate > expiryDate) { setError('The start date can’t be after the expiry date.'); return }
    if (!datesReason.trim()) { setError('Add a reason for changing the dates.'); return }
    const reason = datesReason.trim()
    if (expiryChanged && !await post(`/member-passes/${pass.id}/extend-expiry`, { new_expires_at: expiryDate, reason }, 'Could not change the expiry date.')) return
    if (startChanged && !await post(`/member-passes/${pass.id}/change-start`, { new_effective_from: startDate, reason }, 'Could not change the start date.')) return
    setDatesReason('')
  }

  const frozen = pass.status === 'frozen'
  const s = passStatusChip[pass.status] ?? { label: pass.status, tone: 'neutral' as const }
  const member = pass.user ? displayName(pass.user) : ''

  return (
    <Modal title="Manage pass" onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{pass.pass_template?.name ?? 'Pass'}</span>
            {member && <span style={{ fontSize: 14, color: color.muted }}>{member}{pass.user?.email ? ` · ${pass.user.email}` : ''}</span>}
          </div>
          <Chip tone={s.tone}>{s.label}</Chip>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 14 }}>
          <div>
            <div style={{ color: color.muted }}>Credits left</div>
            <div style={{ fontWeight: 600, fontSize: 16, ...tabularNums }}>{credit ? `${current} of ${pass.credits_total}` : 'Unlimited'}</div>
          </div>
          <div>
            <div style={{ color: color.muted }}>Starts</div>
            <div style={{ fontWeight: 600, fontSize: 16, ...tabularNums }}>{formatDayMonth(pass.effective_from, timeZone)}</div>
          </div>
          <div>
            <div style={{ color: color.muted }}>Expires</div>
            <div style={{ fontWeight: 600, fontSize: 16, ...tabularNums }}>{formatDayMonth(pass.expires_at, timeZone)}</div>
          </div>
        </div>

        {error && <div role="alert" style={alertStyle()}>{error}</div>}

        {credit && (
          <div style={sectionStyle}>
            <span style={headStyle}>Set credits</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <label style={smallLabel}>
                Credits left
                <input type="number" inputMode="numeric" min={0} value={balance} onChange={e => onBalance(e.target.value)}
                  placeholder={String(current)} style={{ ...inputStyle, width: 110 }} />
              </label>
              <span style={{ paddingBottom: 12, color: color.muted, fontSize: 14 }}>or</span>
              <label style={smallLabel}>
                Change by
                <input type="number" inputMode="numeric" value={change} onChange={e => onChangeBy(e.target.value)}
                  placeholder="e.g. -6 or 2" style={{ ...inputStyle, width: 130 }} />
              </label>
            </div>
            {change.trim() !== '' && Number.isInteger(delta) && delta !== 0 && (
              <span style={{ fontSize: 14, color: target < 0 ? color.dangerInk : color.ink2, ...tabularNums }}>
                {current} → {target} credits ({delta > 0 ? '+' : ''}{delta})
              </span>
            )}
            <input type="text" value={creditReason} onChange={e => setCreditReason(e.target.value)}
              placeholder="Reason (required), e.g. Carried over from old system" style={inputStyle} />
            <div>
              <button type="button" onClick={saveCredits} disabled={busy} className={`${ui.button} ${ui.focusable}`} style={buttonStyle('secondary')}>
                Save credits
              </button>
            </div>
          </div>
        )}

        <div style={sectionStyle}>
          <span style={headStyle}>Dates</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <label style={smallLabel}>
              Starts
              <input type="date" value={startDate} max={expiryDate || undefined} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, width: 170 }} />
            </label>
            <label style={smallLabel}>
              Expires
              <input type="date" value={expiryDate} min={startDate || undefined} onChange={e => setExpiryDate(e.target.value)} style={{ ...inputStyle, width: 170 }} />
            </label>
          </div>
          <input type="text" value={datesReason} onChange={e => setDatesReason(e.target.value)}
            placeholder="Reason (required), e.g. Matching the old system's dates" style={inputStyle} />
          <div>
            <button type="button" onClick={saveDates} disabled={busy || (!startChanged && !expiryChanged)} className={`${ui.button} ${ui.focusable}`} style={buttonStyle('secondary')}>
              Save dates
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <span style={headStyle}>{frozen ? 'Frozen' : 'Freeze'}</span>
          <span style={{ fontSize: 14, color: color.ink2 }}>
            {frozen ? 'This pass can’t be used to book until it’s unfrozen.' : 'Pause the pass, for example while the member is away or injured.'}
          </span>
          <div>
            <button type="button" disabled={busy || pass.status === 'expired' || pass.status === 'exhausted'}
              onClick={() => post(`/member-passes/${pass.id}/${frozen ? 'unfreeze' : 'freeze'}`, undefined, `Could not ${frozen ? 'unfreeze' : 'freeze'} this pass.`)}
              className={`${ui.button} ${ui.focusable}`} style={buttonStyle('secondary')}>
              {frozen ? 'Unfreeze pass' : 'Freeze pass'}
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <span style={headStyle}>Credit history</span>
          {ledger === null ? (
            <span style={{ fontSize: 14, color: color.muted }}>Loading…</span>
          ) : ledger.length === 0 ? (
            <span style={{ fontSize: 14, color: color.muted }}>No credit movements yet.</span>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {ledger.slice().reverse().map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${color.divider}`, fontSize: 14 }}>
                  <div>
                    <div>{movementLabels[e.movement_type] ?? e.movement_type}</div>
                    {e.notes && <div style={{ fontSize: 13, color: color.muted }}>{e.notes}</div>}
                    <div style={{ fontSize: 12, color: color.muted, ...tabularNums }}>{formatShortDate(e.created_at, timeZone)}, {formatClock(e.created_at, timeZone)}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: e.credits_delta < 0 ? color.dangerInk : color.primaryInk, ...tabularNums }}>
                    {e.credits_delta > 0 ? `+${e.credits_delta}` : e.credits_delta}
                    <div style={{ fontSize: 12, color: color.muted, fontWeight: 400 }}>→ {e.credits_after}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
