'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartColumn } from 'lucide-react'
import { studioUrl } from '@/lib/seo'
import { color, radius, tabularNums } from '@/lib/ui/tokens'
import { Button, Chip, EmptyState, cardStyle, capacityColor } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from './reports.module.css'
import {
  type OrgCtx, type Range, type Col, useReport, money, num, pct, tickDate, dayLabel,
  Panel, StatTile, ChartFrame, Table, ReportState, RANGE_PRESETS, AXIS, GRID, tooltipStyle, tilesGrid,
} from './lib'

interface DailyPoint { date: string; value: number }
interface InsightsReport { booked_spots_daily: DailyPoint[] }
interface RevenueReport { summary: { total_revenue: number; drop_in: number; pass_sales: number; currency: string } }
interface SessionPerf {
  session_id: string; name: string; occurrences: number; avg_bookings: number
  avg_capacity: number | null; fill_rate: number | null; attended: number; no_shows: number
}
interface HeatCell { day_of_week: number; hour: number; fill_rate: number }
interface AttendanceReport {
  summary: { total_sessions: number; bookings: number; attended: number; no_shows: number; avg_fill_rate: number; avg_attendance_rate: number }
  sessions: SessionPerf[]
  heatmap: HeatCell[]
}
interface PassReport {
  summary: { active_passes: number; credits_outstanding: number }
  templates: { template_id: string; name: string; sold_all_time: number; active: number }[]
}
interface MemberReport {
  summary: { active_members: number; new_in_range: number }
  at_risk: { member_id: string; name: string; last_booking_date: string | null }[]
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon-first
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`
// One green scale, darker = fuller; text flips to white on the two darkest steps.
const shade = (p: number): [string, string] =>
  p >= 0.85 ? [color.primary, '#FFFFFF'] : p >= 0.6 ? ['#5E9480', '#FFFFFF'] : p >= 0.45 ? ['#A9CBBB', color.primaryInk] : [color.primarySoft, color.primaryInk]
// Test templates left over from QA ("[JOB SMOKE TEST] Expiry Pass") are flagged, not hidden.
export const isTestTemplate = (name: string) => /^\[[^\]]*test[^\]]*\]/i.test(name)

export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const hours = Array.from(new Set(cells.map(c => c.hour))).sort((a, b) => a - b)
  const byKey = new Map(cells.map(c => [`${c.day_of_week}:${c.hour}`, c.fill_rate]))
  return (
    <div style={{ overflowX: 'auto' }}>
      <div role="table" aria-label="Average fill by day and start time"
        style={{ display: 'grid', gridTemplateColumns: `44px repeat(${hours.length}, minmax(52px, 1fr))`, gap: 6, alignItems: 'center', minWidth: 44 + hours.length * 58 }}>
        <div role="row" style={{ display: 'contents' }}>
          <span role="columnheader" />
          {hours.map(h => <span key={h} role="columnheader" style={{ fontSize: 13, color: color.muted, textAlign: 'center', ...tabularNums }}>{hourLabel(h)}</span>)}
        </div>
        {ROW_ORDER.map(d => (
          <div key={d} role="row" style={{ display: 'contents' }}>
            <span role="rowheader" style={{ fontSize: 14, fontWeight: 600, color: color.ink2 }}>{DOW[d]}</span>
            {hours.map(h => {
              const v = byKey.get(`${d}:${h}`)
              if (v == null) return <span key={h} role="cell" aria-label={`${DOW[d]} ${hourLabel(h)}: no class`} title="No class" style={{ height: 40, borderRadius: 8, border: '1px dashed #DADDD7' }} />
              const [bg, ink] = shade(v)
              return (
                <span key={h} role="cell" title={`${DOW[d]} ${hourLabel(h)} · ${pct(v)} full`}
                  style={{ height: 40, borderRadius: 8, background: bg, color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, ...tabularNums }}>
                  {pct(v)}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: color.muted }}>
        Emptier
        {[0.2, 0.5, 0.7, 0.9].map(p => <span key={p} aria-hidden style={{ width: 22, height: 12, borderRadius: 3, background: shade(p)[0] }} />)}
        Fuller
      </div>
    </div>
  )
}

export default function OverviewTab({ ctx, range, onRange, onShowMembers }: {
  ctx: OrgCtx; range: Range; onRange: (r: Range) => void; onShowMembers: () => void
}) {
  const ins = useReport<InsightsReport>(ctx, '/reports/insights', range)
  const rev = useReport<RevenueReport>(ctx, '/reports/revenue', range)
  const att = useReport<AttendanceReport>(ctx, '/reports/attendance', range)
  const pas = useReport<PassReport>(ctx, '/reports/passes', range)
  const mem = useReport<MemberReport>(ctx, '/reports/members', range)
  const [copied, setCopied] = useState(false)

  const all = [ins, rev, att, pas, mem]
  const state = ReportState({ loading: all.some(r => r.loading), error: all.find(r => r.error)?.error ?? '' })
  if (state) return state
  if (!ins.data || !rev.data || !att.data || !pas.data || !mem.data) return null

  const cur = rev.data.summary.currency || ctx.currency
  const r = rev.data.summary, a = att.data.summary
  const empty = a.bookings === 0
  const daily = ins.data.booked_spots_daily
  const busiest = daily.reduce<DailyPoint | null>((best, d) => (d.value > (best?.value ?? 0) ? d : best), null)

  const copyLink = async () => {
    if (!ctx.slug) return
    try {
      await navigator.clipboard.writeText(studioUrl(ctx.slug))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — nothing useful to show */ }
  }

  const perfCols: Col<SessionPerf>[] = [
    { label: 'Session', render: s => (
      <Link href={`/dashboard/sessions/${s.session_id}`} className={ui.focusable} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{s.name}</Link>
    ) },
    { label: 'Classes', align: 'right', render: s => num(s.occurrences) },
    { label: 'Avg booked', align: 'right', render: s => s.avg_capacity == null ? s.avg_bookings.toFixed(1) : `${s.avg_bookings.toFixed(1)} / ${Math.round(s.avg_capacity)}` },
    { label: 'Fill', width: '170px', render: s => s.fill_rate == null ? <span style={{ color: color.muted }}>No cap</span> : (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ flex: '1 1 auto', minWidth: 60, height: 6, borderRadius: 3, background: color.track, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${Math.min(s.fill_rate, 1) * 100}%`, borderRadius: 3, background: capacityColor(s.fill_rate) }} />
        </span>
        <span style={{ minWidth: 38, textAlign: 'right', ...tabularNums }}>{pct(s.fill_rate)}</span>
      </span>
    ) },
    { label: 'Attended', align: 'right', render: s => num(s.attended) },
    { label: 'No-shows', align: 'right', render: s => num(s.no_shows) },
  ]

  const winBack = mem.data.at_risk.slice(0, 6)

  return (
    <div className={styles.stack}>
      <div style={tilesGrid}>
        <StatTile label="Revenue" value={money(r.total_revenue, cur)}
          sub={r.total_revenue > 0 ? `${money(r.drop_in, cur)} drop-in · ${money(r.pass_sales, cur)} passes` : 'No sales in this range'} />
        <StatTile label="Booked spots" value={num(a.bookings)} sub={empty ? 'No bookings yet' : `${pct(a.avg_fill_rate)} of spots filled`} />
        <StatTile label="Attended" value={empty ? '—' : num(a.attended)}
          sub={empty ? 'Nothing to count yet' : `${pct(a.avg_attendance_rate)} showed up · ${num(a.no_shows)} no-show${a.no_shows === 1 ? '' : 's'}`} />
        <StatTile label="New members" value={num(mem.data.summary.new_in_range)} sub={`${num(mem.data.summary.active_members)} active in total`} />
        <StatTile label="Active passes" value={num(pas.data.summary.active_passes)} sub={`${num(pas.data.summary.credits_outstanding)} credits not yet used`} />
      </div>

      {empty ? (
        <div style={cardStyle}>
          <EmptyState
            icon={<ChartColumn size={22} strokeWidth={1.8} />}
            message={<><strong style={{ display: 'block', fontSize: 17, color: color.ink, marginBottom: 6 }}>No bookings in this range yet</strong>
              Once members start booking, you&apos;ll see bookings by day, which classes fill best and how passes are being used.</>}
            action={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                <Button variant="primary" onClick={() => onRange(RANGE_PRESETS[1].make())}>Try last 30 days</Button>
                {ctx.slug && <Button onClick={copyLink}>{copied ? 'Link copied' : 'Copy booking page link'}</Button>}
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className={styles.charts2}>
            <Panel title="Booked spots by day" right={busiest && (
              <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>Busiest: {dayLabel(busiest.date)} · {num(busiest.value)}</span>
            )}>
              <ChartFrame height={240}>
                <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={tickDate} tick={AXIS} tickLine={false} axisLine={{ stroke: color.border }} minTickGap={20} />
                  <YAxis width={32} allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip {...tooltipStyle} cursor={{ fill: color.bg }} labelFormatter={((d: any) => dayLabel(String(d))) as never} formatter={((v: any) => [`${v} booked`, '']) as never} separator="" />
                  <Bar dataKey="value" name="Booked" fill={color.primary} radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ChartFrame>
            </Panel>

            <Panel title="How full classes are" subtitle="Average fill by day and start time">
              {att.data.heatmap.length === 0
                ? <p style={{ margin: 0, color: color.muted, fontSize: 14 }}>No classes with a capacity ran in this range.</p>
                : <Heatmap cells={att.data.heatmap} />}
            </Panel>
          </div>

          <Panel title="Class performance" flush>
            <Table cols={perfCols} rows={att.data.sessions} keyOf={s => s.session_id} empty="No classes ran in this range." minWidth={720} />
          </Panel>
        </>
      )}

      <div className={styles.cols2}>
        <Panel title="Pass types" flush>
          <Table
            minWidth={360}
            rows={pas.data.templates}
            keyOf={t => t.template_id}
            empty="No pass types yet."
            cols={[
              { label: 'Pass', render: t => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {t.name}{isTestTemplate(t.name) && <Chip tone="warn">Test</Chip>}
                </span>
              ) },
              { label: 'Sold (all time)', align: 'right', render: t => num(t.sold_all_time) },
              { label: 'Active now', align: 'right', render: t => num(t.active) },
            ]}
          />
        </Panel>

        <Panel title="Members to win back" subtitle="No recent bookings" flush>
          {winBack.length === 0 ? (
            <p style={{ margin: 0, padding: '8px 20px 20px', color: color.muted, fontSize: 14 }}>Everyone has booked recently.</p>
          ) : (
            <>
              {winBack.map((m, i) => (
                <Link key={m.member_id} href={`/dashboard/members/${m.member_id}`} className={`${ui.rowLink} ${ui.focusable}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, padding: '0 20px',
                    borderTop: i ? `1px solid ${color.divider}` : 'none', color: color.ink, textDecoration: 'none', ['--hover-bg' as string]: '#F7F8F5',
                  }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</span>
                  <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>
                    {m.last_booking_date ? `Last booked ${tickDate(m.last_booking_date)}` : 'Never booked'}
                  </span>
                </Link>
              ))}
              {mem.data.at_risk.length > winBack.length && (
                <div style={{ padding: '10px 20px 16px', borderTop: `1px solid ${color.divider}` }}>
                  <button type="button" onClick={onShowMembers} className={ui.focusable}
                    style={{ background: 'none', border: 0, padding: '6px 0', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: color.primary, cursor: 'pointer', borderRadius: radius.control }}>
                    See all {num(mem.data.at_risk.length)}
                  </button>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}

