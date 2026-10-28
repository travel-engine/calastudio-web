'use client'

import { PICKER_THEMES, themePreview, pickerFontHref, type ThemeKey } from '@/lib/studioTheme'

// The studio theme chooser (design handoff §"Onboarding picker", plus the two Photo First looks) — used in the onboarding wizard and
// in dashboard settings. Each card's swatch is painted in that theme's own tokens.
export default function ThemePicker({
  value, onChange, sampleTitle = 'Vinyasa — all levels',
}: {
  value: ThemeKey
  onChange: (key: ThemeKey) => void
  sampleTitle?: string
}) {
  return (
    <>
      <link rel="stylesheet" href={pickerFontHref()} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '14px' }}>
        {PICKER_THEMES.map((key) => {
          const th = themePreview(key)
          const on = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={on}
              style={{
                cursor: 'pointer', padding: 0, overflow: 'hidden', textAlign: 'left',
                background: '#fff', borderRadius: '16px',
                border: `2px solid ${on ? '#16160f' : 'rgba(22,22,15,0.16)'}`,
              }}
            >
              <div style={{ background: th.bg, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '128px' }}>
                <div style={{
                  fontFamily: th.display, fontWeight: Number(th.displayWeight), fontSize: '19px', lineHeight: 1.1,
                  letterSpacing: th.displaySpacing, textTransform: th.displayCase as React.CSSProperties['textTransform'], color: th.ink,
                }}>
                  {sampleTitle}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: 'auto' }}>
                  <span style={{ fontFamily: th.body, fontSize: '12px', fontWeight: 600, borderRadius: th.pill, padding: '5px 12px', background: th.accent, color: th.accentInk }}>Book</span>
                  <span style={{ fontFamily: th.body, fontSize: '12px', color: th.muted }}>6:30 am · 75 min</span>
                </div>
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{th.name}</div>
                <div style={{ fontSize: '13px', lineHeight: 1.45, color: '#56534b' }}>{th.blurb}</div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
