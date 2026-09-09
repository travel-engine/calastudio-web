// Public studio site theming. One template, a set of token values per theme; a studio's `theme`
// key (from the org record) picks the set. Only "photo-first" exists today — the Yoga with Ravi
// look from the design handoff (dark, photography-led). The other five handoff themes
// (classic / night / clay / grid / poster) slot in here later without touching the components,
// which read `var(--*)` off the wrapper rather than importing this object.
//
// Resolved once in app/[studioSlug]/layout.tsx and emitted as CSS custom properties on the studio
// tree wrapper (see `themeVars`). Server components stay free of theme branching.

export type ThemeKey = 'photo-first'

export interface StudioTheme {
  key: ThemeKey
  /** `color-scheme` for form controls, scrollbars, etc. */
  colorScheme: 'light' | 'dark'
  tokens: Record<string, string>
}

// Photo First — handoff §"Part 1". Colours, type ladder, radii and gutter are final; the small-text
// colours all clear 4.5:1 on their actual ground and must not be lightened.
const photoFirst: StudioTheme = {
  key: 'photo-first',
  colorScheme: 'dark',
  tokens: {
    '--bg': '#0e0e0d',
    '--surface': '#1a1a18',
    '--surface-drawer': '#171716',
    '--inset': '#0e0e0d', // inner cards sitting on --surface

    '--ink': '#f5f4f1',
    '--text-body': 'rgba(245, 244, 241, 0.78)',
    '--text-meta': 'rgba(245, 244, 241, 0.6)',
    '--text-footnote': 'rgba(245, 244, 241, 0.58)',
    '--text-label': 'rgba(245, 244, 241, 0.55)',
    '--text-footer': 'rgba(245, 244, 241, 0.5)',
    '--text-warn': '#e8a06a', // low-spots highlight

    '--line': 'rgba(245, 244, 241, 0.12)',
    '--line-strong': 'rgba(245, 244, 241, 0.14)',
    '--line-chip': 'rgba(245, 244, 241, 0.24)',

    '--accent': '#f5f4f1', // solid button fill
    '--accent-ink': '#0e0e0d', // label on the fill
    '--outline-btn': 'rgba(245, 244, 241, 0.4)',

    '--focus': '#f5f4f1',

    '--pill': '999px',
    '--radius-row': '20px',
    '--radius-card': '24px',
    '--radius-drawer': '28px',
    '--radius-thumb': '14px',
    '--radius-tile': '18px',

    '--gutter': 'clamp(20px, 5vw, 56px)',
    '--content-max': '1100px',

    // Manrope, self-hosted via next/font (variable set on the same wrapper).
    '--font-body': "var(--font-manrope), system-ui, -apple-system, sans-serif",
  },
}

const THEMES: Record<ThemeKey, StudioTheme> = {
  'photo-first': photoFirst,
}

const DEFAULT_THEME: ThemeKey = 'photo-first'

export function resolveTheme(key: string | null | undefined): StudioTheme {
  if (key && key in THEMES) return THEMES[key as ThemeKey]
  return THEMES[DEFAULT_THEME]
}

/** CSS custom properties for the studio tree wrapper's `style` prop. */
export function themeVars(theme: StudioTheme): React.CSSProperties {
  return { colorScheme: theme.colorScheme, ...theme.tokens } as React.CSSProperties
}
