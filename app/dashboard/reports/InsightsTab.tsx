'use client'

import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import styles from './reports.module.css'
import {
  type OrgCtx, type Range, useReport, money, num, tickDate,
  Panel, StatTile, ChartFrame, RankedList, ReportState, SERIES, AXIS, GRID,
} from './lib'

interface DailyPoint { date: string; value: number }
interface RankedItem { label: string; value: number; id: string | null }
interface InsightsReport {
  tiles: {
    classes: number; orders: number; total_sales: number
    class_passes_sold: number; class_passes_sold_value: number
    memberships_sold: number; tickets_sold: number
  }
  total_sales_daily: DailyPoint[]
  booked_spots_daily: DailyPoint[]
  new_members_daily: DailyPoint[]
  members_on_waitlist_daily: DailyPoint[]
  cancellations_daily: DailyPoint[]
  most_sold_pricing_options: RankedItem[]
  members_with_most_bookings: RankedItem[]
  members_with_most_cancellations: RankedItem[]
}

export default function InsightsTab({ ctx, range }: { ctx: OrgCtx; range: Range }) {
  const { data, error, loading } = useReport<InsightsReport>(ctx, '/reports/insights', range)
  const state = ReportState({ loading, error })
  if (state) return state
  if (!data) return null

  const t = data.tiles
  const axisProps = { tick: AXIS, tickLine: false, axisLine: { stroke: GRID } }

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        <StatTile label="Classes" value={num(t.classes)} />
        <StatTile label="Orders" value={num(t.orders)} />
        <StatTile label="Total sales" value={money(t.total_sales, ctx.currency)} />
        <StatTile label="Class passes sold" value={num(t.class_passes_sold)} sub={money(t.class_passes_sold_value, ctx.currency)} />
        <StatTile label="Memberships sold" value={num(t.memberships_sold)} sub="Phase 2" />
        <StatTile label="Tickets sold" value={num(t.tickets_sold)} sub="Phase 2" />
      </div>

      <div className={styles.charts2}>
        <Panel title="Total sales">
          <ChartFrame>
            <AreaChart data={data.total_sales_daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} {...axisProps} minTickGap={24} />
              <YAxis width={44} {...axisProps} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={((v: any) => money(Number(v), ctx.currency)) as never} labelFormatter={tickDate} />
              <Area type="monotone" dataKey="value" name="Sales" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ChartFrame>
        </Panel>

        <Panel title="Booked spots">
          <ChartFrame>
            <BarChart data={data.booked_spots_daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} {...axisProps} minTickGap={24} />
              <YAxis width={32} allowDecimals={false} {...axisProps} />
              <Tooltip labelFormatter={tickDate} />
              <Bar dataKey="value" name="Spots" fill={SERIES[1]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </Panel>

        <Panel title="New members">
          <ChartFrame>
            <BarChart data={data.new_members_daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} {...axisProps} minTickGap={24} />
              <YAxis width={32} allowDecimals={false} {...axisProps} />
              <Tooltip labelFormatter={tickDate} />
              <Bar dataKey="value" name="New members" fill={SERIES[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </Panel>

        <Panel title="Cancellations">
          <ChartFrame>
            <LineChart data={data.cancellations_daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} {...axisProps} minTickGap={24} />
              <YAxis width={32} allowDecimals={false} {...axisProps} />
              <Tooltip labelFormatter={tickDate} />
              <Line type="monotone" dataKey="value" name="Cancellations" stroke={SERIES[3]} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartFrame>
        </Panel>
      </div>

      <Panel title="Waitlist size">
        <ChartFrame height={180}>
          <LineChart data={data.members_on_waitlist_daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={tickDate} {...axisProps} minTickGap={24} />
            <YAxis width={32} allowDecimals={false} {...axisProps} />
            <Tooltip labelFormatter={tickDate} />
            <Line type="monotone" dataKey="value" name="On waitlist" stroke={SERIES[2]} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartFrame>
      </Panel>

      <div className={styles.cols2}>
        <Panel title="Most-sold pricing options">
          <RankedList items={data.most_sold_pricing_options} />
        </Panel>
        <Panel title="Members with most bookings">
          <RankedList items={data.members_with_most_bookings} />
        </Panel>
      </div>
      <Panel title="Members with most cancellations">
        <RankedList items={data.members_with_most_cancellations} />
      </Panel>
    </div>
  )
}
