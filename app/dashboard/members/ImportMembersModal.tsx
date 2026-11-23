'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { displayName } from '@/lib/names'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Chip, Field, Modal, alertStyle, controlStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import WelcomeEmailForm from './WelcomeEmailForm'

// Bulk member import for studios moving from another system (spec 03 §3.6, API #85).
// One row per member. Besides the member columns, any column headed with the exact name of one of
// the studio's passes carries that member's remaining balance ("yes" for an unlimited pass), with an
// optional "<pass name> expiry" column; sessions_attended carries their visit count so far. All the
// matching and checking happens on the API — this screen only shows what it reports.
// Welcome emails are always held (send_welcome: false): the studio sends them when it's ready, from
// here or from the banner on the members list.

interface PassCell {
  column: string
  pass_template_id: string | null
  pass_name: string | null
  value: string
  expiry: string | null
  credits: number | null // null = unlimited
  expires_at: string | null
  status: 'will_issue' | 'already_has_pass' | 'invalid' | 'issued'
  reason: string | null
}

interface ImportRow {
  row_number: number
  first_name: string
  last_name: string
  email: string | null
  sessions_attended?: string | null
  passes?: PassCell[]
  status: 'valid' | 'invalid' | 'already_member'
  reason: string | null
}

interface ImportResult {
  rows: ImportRow[]
  valid_count: number
  invalid_count: number
  already_member_count: number
  imported_count: number
  passes_issued_count?: number
  summary?: {
    members_new: number
    members_existing: number
    passes_to_issue: number
    unknown_columns: string[]
    pass_columns: string[]
  }
}

const ROW_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  valid: { label: 'New member', tone: 'primary' },
  invalid: { label: 'Needs fixing', tone: 'danger' },
  already_member: { label: 'Already a member', tone: 'warn' },
}

const PASS_STATUS: Record<PassCell['status'], { label: string; tone: ChipTone }> = {
  will_issue: { label: 'Will add', tone: 'primary' },
  issued: { label: 'Added', tone: 'primary' },
  already_has_pass: { label: 'Already has it', tone: 'neutral' },
  invalid: { label: 'Needs fixing', tone: 'danger' },
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function passSummary(p: PassCell) {
  const balance = p.credits === null ? 'unlimited' : plural(p.credits, 'class', 'classes')
  return `${p.pass_name ?? p.column}: ${balance}${p.expires_at ? `, until ${p.expires_at.slice(0, 10)}` : ''}`
}

export default function ImportMembersModal({ orgId, token, studioName, onClose, onImported }: {
  orgId: string
  token: string
  studioName?: string
  onClose: () => void
  // After a successful import, so the list (and the pending-welcome banner) can refresh.
  onImported: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [committed, setCommitted] = useState(false)
  const [busy, setBusy] = useState<'' | 'template' | 'preview' | 'commit'>('')
  const [error, setError] = useState('')
  const [welcomeQueued, setWelcomeQueued] = useState<number | null>(null)

  const api = (path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    })

  const downloadTemplate = async () => {
    setBusy('template')
    setError('')
    try {
      const res = await api('/members/import-template')
      if (!res.ok) { setError("Couldn't download the template. Please try again."); return }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = 'member-import-template.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Couldn't download the template. Please try again.")
    } finally {
      setBusy('')
    }
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same (corrected) file again still fires
    if (!file) return
    setFileName(file.name)
    setCsvText(await file.text())
    setPreview(null)
    setError('')
  }

  const send = async (commit: boolean) => {
    const res = await api('/members/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_content: csvText, commit, send_welcome: false }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error || body?.message || '')
    }
    return await res.json() as ImportResult
  }

  const runPreview = async () => {
    if (!csvText.trim()) { setError('Choose your filled-in CSV file first.'); return }
    setBusy('preview')
    setError('')
    try {
      setPreview(await send(false))
    } catch (err) {
      setError((err as Error).message || "Couldn't read this file. Check it's saved as CSV and try again.")
    } finally {
      setBusy('')
    }
  }

  const runImport = async () => {
    setBusy('commit')
    setError('')
    try {
      setPreview(await send(true))
      setCommitted(true)
      onImported()
    } catch (err) {
      setError((err as Error).message || 'The import failed. Nothing was saved.')
    } finally {
      setBusy('')
    }
  }

  const summary = preview?.summary
  const newMembers = summary?.members_new ?? preview?.valid_count ?? 0
  const passesToIssue = summary?.passes_to_issue ?? 0
  const canImport = newMembers > 0 || passesToIssue > 0
  const importLabel = [
    newMembers > 0 && plural(newMembers, 'member'),
    passesToIssue > 0 && plural(passesToIssue, 'pass', 'passes'),
  ].filter(Boolean).join(' and ')

  const td: React.CSSProperties = { padding: '10px 14px', borderBottom: `1px solid ${color.divider}`, verticalAlign: 'top' }
  const step: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600, color: color.ink }
  const note: React.CSSProperties = { margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: color.ink2 }

  return (
    <Modal title="Import members" onClose={onClose} width={900}>
      {!preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
          <div>
            <p style={step}>1. Download the template</p>
            <p style={note}>
              It already has a column for each of your passes. Fill in one row per member in Excel or Google Sheets:
            </p>
            <ul style={{ ...note, paddingLeft: 20 }}>
              <li>first_name and email are required; the rest is optional.</li>
              <li><strong>sessions_attended</strong>: how many classes they&apos;ve been to so far.</li>
              <li><strong>Pass columns</strong>: the classes they have left, or <strong>yes</strong> for an unlimited pass. Leave blank if they don&apos;t have it.</li>
              <li><strong>&ldquo;… expiry&rdquo; columns</strong>: when that pass runs out. Leave blank to use the pass&apos;s usual expiry, counted from today.</li>
              <li>All dates as <strong>yyyy-mm-dd</strong>, e.g. 2026-11-19.</li>
            </ul>
            <div style={{ marginTop: 10 }}>
              <Button onClick={downloadTemplate} disabled={busy === 'template'} icon={<Download size={18} strokeWidth={1.8} aria-hidden />}>
                {busy === 'template' ? 'Downloading…' : 'Download template'}
              </Button>
            </div>
          </div>

          <div>
            <p style={step}>2. Upload your filled-in file</p>
            <p style={note}>Save it as CSV. You&apos;ll see a preview before anything is saved.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <Button onClick={() => fileInputRef.current?.click()} icon={<Upload size={18} strokeWidth={1.8} aria-hidden />}>Choose CSV file</Button>
              {fileName && <span style={{ fontSize: 14, color: color.ink2 }}>{fileName}</span>}
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
            </div>
          </div>

          <details>
            <summary className={ui.focusable} style={{ cursor: 'pointer', fontSize: 14, color: color.ink2 }}>Or paste the rows instead</summary>
            <div style={{ marginTop: 10 }}>
              <Field label="CSV rows, with the header row" htmlFor="csv-paste">
                <textarea id="csv-paste" value={csvText} onChange={e => { setCsvText(e.target.value); setFileName('') }}
                  placeholder={'first_name,last_name,email,sessions_attended,10-class pass\nJane,Smith,jane@example.com,42,7'}
                  style={{ ...controlStyle, minHeight: 140, padding: '10px 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, resize: 'vertical' }} />
              </Field>
            </div>
          </details>

          {error && <div role="alert" style={alertStyle()}>{error}</div>}

          <div><Button variant="primary" onClick={runPreview} disabled={busy === 'preview' || !csvText.trim()}>{busy === 'preview' ? 'Checking…' : 'Check file'}</Button></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
          {committed ? (
            <div role="status" style={alertStyle('ok')}>
              Imported {plural(preview.imported_count, 'new member')}
              {preview.passes_issued_count ? ` and added ${plural(preview.passes_issued_count, 'pass', 'passes')}` : ''}.
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 15, color: color.ink2, lineHeight: 1.5, ...tabularNums }}>
              <strong style={{ color: color.ink }}>{plural(newMembers, 'new member')}</strong>,{' '}
              {plural(summary?.members_existing ?? preview.already_member_count, 'existing member')},{' '}
              <strong style={{ color: color.ink }}>{plural(passesToIssue, 'pass', 'passes')} to add</strong>
              {preview.invalid_count > 0 && <>, <strong style={{ color: color.dangerInk }}>{plural(preview.invalid_count, 'row')} to fix</strong></>}.
              {' '}Nothing has been saved yet.
            </p>
          )}

          {!committed && summary && summary.unknown_columns.length > 0 && (
            <div role="alert" style={alertStyle('warn')}>
              These columns don&apos;t match a member field or one of your passes, so they&apos;ll be ignored:{' '}
              <strong>{summary.unknown_columns.join(', ')}</strong>. If one is a pass, make the heading match the pass&apos;s name exactly.
            </div>
          )}
          {!committed && preview.invalid_count > 0 && (
            <p style={{ margin: 0, fontSize: 14, color: color.ink2 }}>
              Rows that need fixing are skipped. Fix them in your file and upload it again; members already imported won&apos;t be added twice.
            </p>
          )}

          {error && <div role="alert" style={alertStyle()}>{error}</div>}

          <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, overflow: 'auto', maxHeight: 380 }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Row', 'Member', 'Classes so far', 'Passes', 'Status'].map(h => (
                    <th key={h} scope="col" style={{ ...smallCapsStyle, textAlign: 'left', padding: '10px 14px', borderBottom: `1px solid ${color.border}`, position: 'sticky', top: 0, background: color.surface, zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map(row => {
                  const st = ROW_STATUS[row.status] ?? { label: row.status, tone: 'neutral' as ChipTone }
                  return (
                    <tr key={row.row_number}>
                      <td style={{ ...td, color: color.muted, ...tabularNums }}>{row.row_number}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{displayName(row) || '—'}</div>
                        <div style={{ color: color.ink2, wordBreak: 'break-word' }}>{row.email || '—'}</div>
                      </td>
                      <td style={{ ...td, ...tabularNums }}>{row.sessions_attended?.trim() || '—'}</td>
                      <td style={td}>
                        {(row.passes ?? []).length === 0 ? <span style={{ color: color.muted }}>—</span> : (
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {row.passes!.map(p => {
                              const ps = PASS_STATUS[p.status] ?? { label: p.status, tone: 'neutral' as ChipTone }
                              return (
                                <li key={p.column}>
                                  <span style={{ marginRight: 6 }}>{passSummary(p)}</span>
                                  <Chip tone={ps.tone}>{ps.label}</Chip>
                                  {p.reason && <div style={{ color: p.status === 'invalid' ? color.dangerInk : color.muted, fontSize: 13, marginTop: 2 }}>{p.reason}</div>}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </td>
                      <td style={td}>
                        <Chip tone={st.tone}>{st.label}</Chip>
                        {row.reason && row.reason.toLowerCase() !== st.label.toLowerCase() && (
                          <div style={{ color: row.status === 'invalid' ? color.dangerInk : color.muted, fontSize: 13, marginTop: 4 }}>{row.reason}</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {committed && preview.imported_count > 0 && (
            welcomeQueued === null ? (
              <section aria-labelledby="welcome-step" style={{ border: `1px solid ${color.border}`, borderRadius: radius.card, padding: '18px 20px' }}>
                <h3 id="welcome-step" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: color.ink }}>Send welcome emails</h3>
                <p style={{ margin: '0 0 12px', fontSize: 14, color: color.muted }}>Nothing has gone out yet. Send them now, or later from the Members page.</p>
                <WelcomeEmailForm api={api} studioName={studioName} onSent={q => { setWelcomeQueued(q); onImported() }} />
              </section>
            ) : (
              <div role="status" style={alertStyle('ok')}>
                {welcomeQueued === 0
                  ? 'No welcome emails were waiting to go out.'
                  : `${plural(welcomeQueued, 'welcome email')} will go out over the next few minutes.`}
              </div>
            )
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {!committed ? (
              <>
                <Button onClick={() => setPreview(null)}>Back</Button>
                <Button variant="primary" onClick={runImport} disabled={busy === 'commit' || !canImport}>
                  {busy === 'commit' ? 'Importing…' : canImport ? `Import ${importLabel}` : 'Nothing to import'}
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={onClose}>Done</Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
