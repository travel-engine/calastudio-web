// Public studio site theming — the five-theme system from the design handoff
// (design_handoff_studio_pages/Studio Themes.dc.html + its README token table).
//
// One template; every visual axis is a token. A studio's `theme` key picks a set. Components read
// `var(--*)` off the tree wrapper, so a theme is purely data here.
//
//   photo-first        Night's tokens with the full-bleed photo hero layout
//   photo-first-light  the same layout on a light paper ground (hero stays light-on-photo)
//   classic      light, plain, gets out of the way (default for new studios)
//   night        dark, photography-led
//   clay         warm sand ground, serif headings
//   grid         crisp, hard rules, uppercase headings, radius 0
//   poster       loud, colour-blocked
//
// The photo hero is fixed light-on-image in every theme (dark scrim — see .hero in
// photofirst.module.css); the switcher/picker is dev-only (layout.tsx).

export type ThemeKey = 'photo-first' | 'photo-first-light' | 'classic' | 'night' | 'clay' | 'grid' | 'poster'

// A theme's design decisions, in the handoff's own shape. `expandTokens` turns one into the CSS
// custom-property map the stylesheet consumes.
interface ThemeSpec {
  name: string
  blurb: string
  colorScheme: 'light' | 'dark'

  bg: string
  surface: string
  ink: string
  muted: string
  faint: string
  accent: string
  accentInk: string
  /** Accent darkened enough for small text; falls back to accent (or muted when accent === ink). */
  accentText?: string
  line: string

  /** Google Fonts family names to request for this theme (see fontHref). */
  fonts: string[]
  display: string
  body: string
  displayWeight: number
  displaySpacing: string
  displayCase: 'none' | 'uppercase'
  displaySize: string
  h2Weight: number
  h2Size: string

  radius: string
  pill: string
  imgRadius: string
  filter: string
  /** Row separator: a `border-bottom` value, or 'none'. */
  rule: string

  brandWeight: number
  kickerSpacing: string

  fixedBar: string
  /** Notice washes. */
  okBg: string
  warnBg: string
  danger: string
  dangerBg: string
}

const SPECS: Record<Exclude<ThemeKey, 'photo-first' | 'photo-first-light'>, ThemeSpec> = {
  classic: {
    name: 'Classic',
    blurb: 'Light and familiar. A plain booking page that gets out of the way.',
    colorScheme: 'light',
    bg: '#ffffff', surface: '#f6f7f8', ink: '#23282d', muted: '#5b6470', faint: '#5f6874',
    accent: '#1f6f5c', accentInk: '#ffffff', line: '#dfe3e8',
    fonts: ['Public Sans:wght@400;500;700'],
    display: "'Public Sans', system-ui, sans-serif", body: "'Public Sans', system-ui, sans-serif",
    displayWeight: 700, displaySpacing: '-0.02em', displayCase: 'none', displaySize: 'clamp(30px, 4.6vw, 52px)',
    h2Weight: 700, h2Size: 'clamp(20px, 2.4vw, 26px)',
    radius: '12px', pill: '8px', imgRadius: '12px', filter: 'none', rule: 'none',
    brandWeight: 700, kickerSpacing: '0.1em',
    fixedBar: 'rgba(255, 255, 255, 0.92)',
    okBg: 'rgba(31, 111, 92, 0.10)', warnBg: 'rgba(168, 92, 26, 0.12)', danger: '#a3352f', dangerBg: 'rgba(163, 53, 47, 0.09)',
  },
  night: {
    name: 'Night',
    blurb: 'Photography-led and dark. Best when the studio has strong images.',
    colorScheme: 'dark',
    bg: '#0e0e0d', surface: '#1a1a18', ink: '#f5f4f1', muted: 'rgba(245,244,241,0.62)', faint: 'rgba(245,244,241,0.5)',
    accent: '#f5f4f1', accentInk: '#0e0e0d', line: 'rgba(245,244,241,0.14)',
    fonts: ['Manrope:wght@300;400;500;700'],
    display: "var(--font-manrope), 'Manrope', system-ui, sans-serif", body: "var(--font-manrope), 'Manrope', system-ui, sans-serif",
    displayWeight: 300, displaySpacing: '-0.035em', displayCase: 'none', displaySize: 'clamp(34px, 5.4vw, 68px)',
    h2Weight: 700, h2Size: 'clamp(21px, 2.7vw, 29px)',
    radius: '20px', pill: '999px', imgRadius: '24px', filter: 'none', rule: 'none',
    brandWeight: 700, kickerSpacing: '0.14em',
    fixedBar: 'rgba(14, 14, 13, 0.86)',
    okBg: 'rgba(245,244,241,0.08)', warnBg: 'rgba(232,160,106,0.14)', danger: '#e8a0a0', dangerBg: 'rgba(214,120,120,0.16)',
  },
  clay: {
    name: 'Clay',
    blurb: 'Warm, quiet and centred. Serif headings on a sand ground.',
    colorScheme: 'light',
    bg: '#ece5da', surface: '#f6f1e9', ink: '#2b2620', muted: '#605a51', faint: '#6b6156',
    accent: '#7d4a33', accentInk: '#f6f1e9', line: 'rgba(43,38,32,0.16)',
    fonts: ['Newsreader:opsz,wght@6..72,300;6..72,400', 'Jost:wght@300;400;500'],
    display: "'Newsreader', Georgia, serif", body: "'Jost', system-ui, sans-serif",
    displayWeight: 300, displaySpacing: '-0.01em', displayCase: 'none', displaySize: 'clamp(34px, 5.4vw, 68px)',
    h2Weight: 300, h2Size: 'clamp(22px, 2.9vw, 32px)',
    radius: '24px', pill: '999px', imgRadius: '999px 999px 16px 16px',
    filter: 'sepia(0.16) saturate(0.72) brightness(1.04)', rule: '1px solid rgba(43,38,32,0.16)',
    brandWeight: 400, kickerSpacing: '0.2em',
    fixedBar: 'rgba(236, 229, 218, 0.92)',
    okBg: 'rgba(125, 74, 51, 0.10)', warnBg: 'rgba(168, 92, 26, 0.12)', danger: '#8f2f26', dangerBg: 'rgba(143, 47, 38, 0.10)',
  },
  grid: {
    name: 'Grid',
    blurb: 'Crisp and businesslike. Hard rules, uppercase headings, one signal colour.',
    colorScheme: 'light',
    bg: '#fbfbf9', surface: '#ffffff', ink: '#111111', muted: '#4a4a45', faint: '#55554f',
    accent: '#e2431f', accentInk: '#ffffff', accentText: '#c53113', line: '#111111',
    fonts: ['Archivo:wght@400;500;600;700'],
    display: "'Archivo', system-ui, sans-serif", body: "'Archivo', system-ui, sans-serif",
    displayWeight: 700, displaySpacing: '-0.045em', displayCase: 'uppercase', displaySize: 'clamp(32px, 5vw, 62px)',
    h2Weight: 700, h2Size: 'clamp(20px, 2.4vw, 26px)',
    radius: '0px', pill: '0px', imgRadius: '0px', filter: 'none', rule: '1px solid rgba(17,17,17,0.18)',
    brandWeight: 700, kickerSpacing: '0.1em',
    fixedBar: 'rgba(255, 255, 255, 0.95)',
    okBg: 'rgba(17,17,17,0.06)', warnBg: 'rgba(197, 49, 19, 0.10)', danger: '#c53113', dangerBg: 'rgba(197, 49, 19, 0.10)',
  },
  poster: {
    name: 'Poster',
    blurb: 'Loud and colour-blocked. Good for workshops and short courses.',
    colorScheme: 'dark',
    bg: '#123b2e', surface: '#1c5344', ink: '#f2efe6', muted: 'rgba(242,239,230,0.72)', faint: 'rgba(242,239,230,0.78)',
    accent: '#e9f36a', accentInk: '#123b2e', line: 'rgba(242,239,230,0.18)',
    fonts: ['Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800', 'Public Sans:wght@400;500;700'],
    display: "'Bricolage Grotesque', system-ui, sans-serif", body: "'Public Sans', system-ui, sans-serif",
    displayWeight: 800, displaySpacing: '-0.05em', displayCase: 'none', displaySize: 'clamp(36px, 6vw, 76px)',
    h2Weight: 700, h2Size: 'clamp(22px, 2.8vw, 30px)',
    radius: '28px', pill: '999px', imgRadius: '24px', filter: 'none', rule: 'none',
    brandWeight: 800, kickerSpacing: '0.1em',
    fixedBar: 'rgba(18, 59, 46, 0.9)',
    okBg: 'rgba(242,239,230,0.10)', warnBg: 'rgba(233,243,106,0.14)', danger: '#f2b8b8', dangerBg: 'rgba(214,120,120,0.18)',
  },
}

export interface StudioTheme {
  key: ThemeKey
  name: string
  blurb: string
  colorScheme: 'light' | 'dark'
  /** Google Fonts families to request for this theme (empty when covered by next/font). */
  fonts: string[]
  /**
   * Home / nav layout family:
   *  - `photofirst` — full-bleed photo hero + overlaid nav + fixed booking bar (Ravi's look)
   *  - `themed`     — split hero (copy left, photo right) + solid nav with a "Book a class" CTA
   *                   (the design handoff's Studio Themes template; all picker themes)
   */
  layout: 'photofirst' | 'themed'
  tokens: Record<string, string>
}

function expandTokens(s: ThemeSpec): Record<string, string> {
  const square = s.radius === '0px'
  // spots ≤3 highlight: handoff uses accentText, or muted when the accent is a near-white ink.
  const warnColor = s.accent.toLowerCase() === s.ink.toLowerCase() ? s.muted : (s.accentText ?? s.accent)
  return {
    '--bg': s.bg,
    '--surface': s.surface,
    '--surface-drawer': s.surface,
    '--inset': s.bg,

    '--ink': s.ink,
    '--text-body': s.muted,
    '--text-meta': s.muted,
    '--text-footnote': s.faint,
    '--text-label': s.faint,
    '--text-footer': s.faint,
    '--text-warn': warnColor,

    '--line': s.line,
    '--line-strong': s.line,
    '--line-chip': s.line,

    '--accent': s.accent,
    '--accent-ink': s.accentInk,
    '--accent-text': s.accentText ?? s.accent,
    '--outline-btn': s.line,
    '--focus': 'currentColor',
    '--fixedbar-bg': s.fixedBar,

    '--ok-bg': s.okBg,
    '--warn-bg': s.warnBg,
    '--danger': s.danger,
    '--danger-bg': s.dangerBg,

    '--font-display': s.display,
    '--font-body': s.body,
    '--display-weight': String(s.displayWeight),
    '--display-spacing': s.displaySpacing,
    '--display-case': s.displayCase,
    '--display-size': s.displaySize,
    '--h2-weight': String(s.h2Weight),
    '--h2-size': s.h2Size,
    '--brand-weight': String(s.brandWeight),
    '--kicker-spacing': s.kickerSpacing,

    '--radius': s.radius,
    '--radius-row': s.radius,
    '--radius-card': s.radius,
    '--radius-tile': square ? '0px' : '18px',
    '--radius-thumb': square ? '0px' : '14px',
    '--radius-drawer': square ? '0px' : '28px',
    '--row-gap': square ? '0px' : '10px',
    '--circle': s.pill === '0px' ? '0px' : '50%',
    '--pill': s.pill,
    '--img-radius': s.imgRadius,
    '--photo-filter': s.filter,
    '--rule': s.rule,

    '--gutter': 'clamp(20px, 5vw, 56px)',
    '--content-max': '1100px',
  }
}

function build(key: ThemeKey, s: ThemeSpec): StudioTheme {
  return { key, name: s.name, blurb: s.blurb, colorScheme: s.colorScheme, fonts: s.fonts, layout: 'themed', tokens: expandTokens(s) }
}

// Photo First's light sibling: Night's type, shape and spacing on a warm paper ground. The hero
// photo, its scrim and the nav over it stay light-on-image exactly as in Photo First.
const DAY: ThemeSpec = {
  ...SPECS.night,
  name: 'Photo First Light',
  blurb: 'One full-screen photograph with your studio name over it, then calm, light pages below.',
  colorScheme: 'light',
  bg: '#f6f4ef', surface: '#ffffff', ink: '#1b1a17', muted: '#5d5a53', faint: '#6a665e',
  accent: '#1b1a17', accentInk: '#f6f4ef', line: 'rgba(27,26,23,0.12)',
  fixedBar: 'rgba(246, 244, 239, 0.92)',
  okBg: 'rgba(27,26,23,0.06)', warnBg: 'rgba(168, 92, 26, 0.12)', danger: '#a3352f', dangerBg: 'rgba(163, 53, 47, 0.09)',
}

const THEMES: Record<ThemeKey, StudioTheme> = {
  classic: build('classic', SPECS.classic),
  night: build('night', SPECS.night),
  clay: build('clay', SPECS.clay),
  grid: build('grid', SPECS.grid),
  poster: build('poster', SPECS.poster),
  // The Night token set with the full-bleed photo-hero layout instead of the split hero.
  'photo-first': {
    ...build('photo-first', SPECS.night),
    name: 'Photo First',
    blurb: 'One full-screen photograph with your studio name over it. Dark and dramatic — best with a single strong hero image.',
    layout: 'photofirst',
  },
  'photo-first-light': { ...build('photo-first-light', DAY), layout: 'photofirst' },
}

const DEFAULT_THEME: ThemeKey = 'photo-first'

/** All seven themes a studio can choose, in picker order. */
export const PICKER_THEMES: ThemeKey[] = ['classic', 'night', 'clay', 'grid', 'poster', 'photo-first', 'photo-first-light']
/** Alias kept for the dev switcher. */
export const THEME_KEYS: ThemeKey[] = PICKER_THEMES

export function resolveTheme(key: string | null | undefined): StudioTheme {
  if (key && key in THEMES) return THEMES[key as ThemeKey]
  return THEMES[DEFAULT_THEME]
}

/**
 * `<link>` href for a theme's Google Fonts (the non-Manrope faces). Manrope is self-hosted via
 * next/font, so Night/Photo First need nothing extra.
 */
export function fontHref(theme: StudioTheme): string | null {
  const families = theme.fonts.filter((f) => !f.startsWith('Manrope'))
  if (families.length === 0) return null
  // Google Fonts CSS2 wants '+' for spaces in family names.
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, '+')}`).join('&')}&display=swap`
}

/** A single Google Fonts `<link>` covering every picker theme's faces — for the onboarding
 *  picker and the settings selector, which preview all themes on one page. */
export function pickerFontHref(): string {
  const families = new Set<string>()
  for (const key of PICKER_THEMES) {
    for (const f of THEMES[key].fonts) {
      if (!f.startsWith('Manrope')) families.add(f.replace(/ /g, '+'))
    }
  }
  return `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join('&')}&display=swap`
}

/** The design decisions a swatch needs to paint a theme preview without applying it to the tree. */
export function themePreview(key: ThemeKey) {
  const s = resolveTheme(key)
  const t = s.tokens
  return {
    key,
    name: s.name,
    blurb: s.blurb,
    bg: t['--bg'],
    surface: t['--surface'],
    ink: t['--ink'],
    muted: t['--text-meta'],
    accent: t['--accent'],
    accentInk: t['--accent-ink'],
    line: t['--line'],
    display: t['--font-display'],
    body: t['--font-body'],
    displayWeight: t['--display-weight'],
    displaySpacing: t['--display-spacing'],
    displayCase: t['--display-case'],
    pill: t['--pill'],
    radius: t['--radius'],
  }
}

/** CSS custom properties for the studio tree wrapper's `style` prop. */
export function themeVars(theme: StudioTheme): React.CSSProperties {
  return { colorScheme: theme.colorScheme, ...theme.tokens } as React.CSSProperties
}
