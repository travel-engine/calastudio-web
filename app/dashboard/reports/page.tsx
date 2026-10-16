'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewReports, canViewAllReports } from '@/lib/roles'
import { color, space } from '@/lib/ui/tokens'
import { Button, PageHeader } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import shell from '@/app/dashboard/dashboard.module.css'
import { useOrgCtx, RangeControl, RANGE_PRESETS, rangeLabel, type Range } from './lib'
import OverviewTab from './OverviewTab'
import RevenueTab from './RevenueTab'
import AttendanceTab from './AttendanceTab'
import PassesTab from './PassesTab'
import MembersTab from './MembersTab'

type TabKey = 'overview' | 'revenue' | 'attendance' | 'passes' | 'members'

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'passes', label: 'Passes' },
  { key: 'members', label: 'Members' },
]

export default function ReportsPage() {
  const { ctx, loading } = useOrgCtx()
  const [range, setRange] = useState<Range>(() => RANGE_PRESETS[2].make()) // This month
  const [tab, setTab] = useState<TabKey>('overview')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  if (loading || !ctx) {
    return (
      <div className={shell.shell}>
        <Sidebar active="reports" />
        <div className={shell.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  const forbidden = !canViewReports(ctx.roles)
  const full = canViewAllReports(ctx.roles)
  // A teacher_super who isn't also an admin only gets the Attendance report (spec §8.12).
  const tabs = full ? ALL_TABS : ALL_TABS.filter(t => t.key === 'attendance')
  const activeTab = tabs.some(t => t.key === tab) ? tab : tabs[0].key

  // The API's one export: every transaction in the range (the Revenue tab's table).
  const exportCsv = async () => {
    setExporting(true)
    setExportError('')
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${ctx.orgId}/reports/revenue/export?from=${range.from}&to=${range.to}`,
        { headers: { Authorization: `Bearer ${ctx.token}` } },
      )
      if (!res.ok) throw new Error('Export failed.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${range.from}-to-${range.to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Could not export the CSV. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={shell.shell}>
      <Sidebar active="reports" roles={ctx.roles} />
      <div className={shell.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader
              eyebrow={rangeLabel(range)}
              title="Reports"
              actions={full && (
                <Button onClick={exportCsv} disabled={exporting} icon={<Download size={18} strokeWidth={2} aria-hidden />}
                  aria-label="Export this range's transactions as CSV">
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </Button>
              )}
            >
              {exportError && <span role="alert" style={{ fontSize: 14, color: color.dangerInk }}>{exportError}</span>}
            </PageHeader>

            <RangeControl range={range} onChange={setRange} />

            <div role="tablist" aria-label="Reports" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${color.border}` }}>
              {tabs.map(t => (
                <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} onClick={() => setTab(t.key)} className={ui.focusable}
                  style={{
                    minHeight: space.target, padding: '0 14px', marginBottom: -1, border: 'none', background: 'transparent', cursor: 'pointer',
                    borderBottom: `2px solid ${activeTab === t.key ? color.primary : 'transparent'}`,
                    color: activeTab === t.key ? color.primaryInk : color.muted, fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && <OverviewTab ctx={ctx} range={range} onRange={setRange} onShowMembers={() => setTab('members')} />}
            {activeTab === 'revenue' && <RevenueTab ctx={ctx} range={range} />}
            {activeTab === 'attendance' && <AttendanceTab ctx={ctx} range={range} />}
            {activeTab === 'passes' && <PassesTab ctx={ctx} range={range} />}
            {activeTab === 'members' && <MembersTab ctx={ctx} range={range} />}
          </div>
        )}
      </div>
    </div>
  )
}
