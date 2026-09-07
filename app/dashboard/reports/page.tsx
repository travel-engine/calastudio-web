'use client'

import { useState } from 'react'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewReports, canViewAllReports } from '@/lib/roles'
import shell from '@/app/dashboard/dashboard.module.css'
import styles from './reports.module.css'
import { useOrgCtx, RangeControl, RANGE_PRESETS, type Range } from './lib'
import InsightsTab from './InsightsTab'
import RevenueTab from './RevenueTab'
import AttendanceTab from './AttendanceTab'
import PassesTab from './PassesTab'
import MembersTab from './MembersTab'

type TabKey = 'insights' | 'revenue' | 'attendance' | 'passes' | 'members'

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: 'insights', label: 'Insights' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'passes', label: 'Passes' },
  { key: 'members', label: 'Members' },
]

export default function ReportsPage() {
  const { ctx, loading } = useOrgCtx()
  const [range, setRange] = useState<Range>(() => RANGE_PRESETS[2].make()) // This month
  const [tab, setTab] = useState<TabKey>('insights')

  if (loading || !ctx) {
    return (
      <div className={shell.shell}>
        <Sidebar active="reports" />
        <div className={shell.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading…</div>
        </div>
      </div>
    )
  }

  const forbidden = !canViewReports(ctx.roles)
  // A teacher_super who isn't also an admin only gets the Attendance report (spec §8.12).
  const tabs = canViewAllReports(ctx.roles) ? ALL_TABS : ALL_TABS.filter(t => t.key === 'attendance')
  const activeTab = tabs.some(t => t.key === tab) ? tab : tabs[0].key

  return (
    <div className={shell.shell}>
      <Sidebar active="reports" roles={ctx.roles} />
      <div className={shell.main} style={{ maxWidth: 1080 }}>
        {forbidden ? <Forbidden /> : (
          <>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700 }}>Reports</h1>
              <p style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
                Revenue, attendance, passes and members for your studio.
              </p>
            </div>

            <RangeControl range={range} onChange={setRange} />

            <div className={styles.tabs}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'insights' && <InsightsTab ctx={ctx} range={range} />}
            {activeTab === 'revenue' && <RevenueTab ctx={ctx} range={range} />}
            {activeTab === 'attendance' && <AttendanceTab ctx={ctx} range={range} />}
            {activeTab === 'passes' && <PassesTab ctx={ctx} range={range} />}
            {activeTab === 'members' && <MembersTab ctx={ctx} range={range} />}
          </>
        )}
      </div>
    </div>
  )
}
