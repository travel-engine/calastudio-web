'use client'

import { useRouter, usePathname } from 'next/navigation'

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '13px', backgroundColor: 'white', cursor: 'pointer'
}

export default function FilterBar({ mode, sessionType, location, locations }: {
  mode: string
  sessionType: string
  location: string
  locations?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  const updateParam = (key: 'mode' | 'type' | 'location', value: string) => {
    const next = { mode, type: sessionType, location, [key]: value }
    const params = new URLSearchParams()
    if (next.mode !== 'all') params.set('mode', next.mode)
    if (next.type !== 'all') params.set('type', next.type)
    if (next.location !== 'all') params.set('location', next.location)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
      <select value={mode} onChange={e => updateParam('mode', e.target.value)} style={selectStyle}>
        <option value="all">All modes</option>
        <option value="in_person">In-person</option>
        <option value="online">Online</option>
      </select>
      <select value={sessionType} onChange={e => updateParam('type', e.target.value)} style={selectStyle}>
        <option value="all">All types</option>
        <option value="class">Class</option>
        <option value="workshop">Workshop</option>
      </select>
      {locations && locations.length > 1 && (
        <select value={location} onChange={e => updateParam('location', e.target.value)} style={selectStyle}>
          <option value="all">All locations</option>
          {locations.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      )}
    </div>
  )
}
