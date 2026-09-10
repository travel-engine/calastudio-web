// Public studio site theming. One template, a set of token values per theme; a studio's `theme`
// key (from the org record) picks the set. Components read `var(--*)` off the tree wrapper rather
// than importing this object, so a new theme is purely a token set here.
//
//   photo-first        dark, photography-led — the Yoga with Ravi handoff look
//   photo-first-light  the same layout / type / spacing on a warm light palette
//
// The remaining handoff themes (classic / night / clay / grid / poster) slot in the same way.
//
// Resolved once in app/[studioSlug]/layout.tsx and emitted as CSS custom properties on the studio
// tree wrapper (see `themeVars`). Server components stay free of theme branching.
//
// The photo hero is deliberately light-on-image in every theme (see .hero in photofirst.module.css)
// — a scrimmed photograph reads best with light text regardless of the body palette.

export type ThemeKey = 'photo-first' | 'photo-first-light'

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
    '--fixedbar-bg': 'rgba(14, 14, 13, 0.86)',

    // Notice / status washes.
    '--ok-bg': 'rgba(245, 244, 241, 0.08)',
    '--warn-bg': 'rgba(232, 160, 106, 0.14)',
    '--danger': '#e8a0a0',
    '--danger-bg': 'rgba(214, 120, 120, 0.16)',

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

// Photo First, light. Same structure; warm off-white ground, white cards, dark solid buttons.
// Small-text colours checked ≥4.5:1 on white (their usual ground): body 8.2, meta 5.3, label 4.7,
// warn (#a85c1a) 4.9.
const photoFirstLight: StudioTheme = {
  key: 'photo-first-light',
  colorScheme: 'light',
  tokens: {
    '--bg': '#f7f6f2',
    '--surface': '#ffffff',
    '--surface-drawer': '#ffffff',
    '--inset': '#f2f0ea',

    '--ink': '#1c1b18',
    '--text-body': 'rgba(28, 27, 24, 0.80)',
    '--text-meta': '#65625b',
    '--text-footnote': '#6b6860',
    '--text-label': '#736f67',
    '--text-footer': '#87837a',
    '--text-warn': '#a85c1a',

    '--line': 'rgba(28, 27, 24, 0.12)',
    '--line-strong': 'rgba(28, 27, 24, 0.16)',
    '--line-chip': 'rgba(28, 27, 24, 0.22)',

    '--accent': '#1c1b18',
    '--accent-ink': '#f7f6f2',
    '--outline-btn': 'rgba(28, 27, 24, 0.32)',

    '--focus': '#1c1b18',
    '--fixedbar-bg': 'rgba(255, 255, 255, 0.9)',

    '--ok-bg': 'rgba(28, 27, 24, 0.05)',
    '--warn-bg': 'rgba(168, 92, 26, 0.10)',
    '--danger': '#a3352f',
    '--danger-bg': 'rgba(163, 53, 47, 0.09)',

    '--pill': '999px',
    '--radius-row': '20px',
    '--radius-card': '24px',
    '--radius-drawer': '28px',
    '--radius-thumb': '14px',
    '--radius-tile': '18px',

    '--gutter': 'clamp(20px, 5vw, 56px)',
    '--content-max': '1100px',

    '--font-body': "var(--font-manrope), system-ui, -apple-system, sans-serif",
  },
}

const THEMES: Record<ThemeKey, StudioTheme> = {
  'photo-first': photoFirst,
  'photo-first-light': photoFirstLight,
}

const DEFAULT_THEME: ThemeKey = 'photo-first'

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

export function resolveTheme(key: string | null | undefined): StudioTheme {
  if (key && key in THEMES) return THEMES[key as ThemeKey]
  return THEMES[DEFAULT_THEME]
}

/** CSS custom properties for the studio tree wrapper's `style` prop. */
export function themeVars(theme: StudioTheme): React.CSSProperties {
  return { colorScheme: theme.colorScheme, ...theme.tokens } as React.CSSProperties
}
