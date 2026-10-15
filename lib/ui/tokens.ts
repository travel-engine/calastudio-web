// Admin (dashboard) design tokens — design/admin-redesign/19-admin-redesign-handoff.md §3.
// Reference these instead of repeating hex values. The public studio site has its own theme
// tokens (lib/studioTheme.ts); these are for /dashboard only.

export const color = {
  primary: '#085041', // existing brand green (the design canvas used #14513F; brand wins)
  primaryHover: '#063D32',
  primarySoft: '#E2EEE9', // active nav item, Attended / Active chips
  primaryInk: '#0C3A2D', // text on primarySoft

  bg: '#F3F4F1', // page background
  surface: '#FFFFFF', // cards, sidebar
  border: '#E1E3DE', // card borders
  divider: '#EDEEEA', // row separators
  control: '#CDD1CB', // input and secondary-button borders
  track: '#E7EAE5', // empty part of progress bars

  ink: '#17201C', // primary text
  ink2: '#3C4541', // secondary text
  muted: '#5A635F', // hints, labels — 4.5:1 on white, don't go lighter

  warnBg: '#FBEFD9',
  warnInk: '#7A4508',
  dangerBg: '#FBE4E1',
  dangerInk: '#8F1F17',
  infoBg: '#E4ECF8',
  infoInk: '#1D477F',
  neutralChip: '#EDEEEA',
  neutralInk: '#3C4541',

  fullBar: '#B3261E', // capacity ≥ 100%
  lowBar: '#C77A12', // capacity ≥ 80%
} as const

export const radius = {
  control: 10,
  card: 14,
  chip: 999,
} as const

// Font stacks. The families themselves are loaded once in app/dashboard/layout.tsx and exposed as
// CSS variables, so these resolve only inside the dashboard tree.
export const font = {
  body: "var(--font-admin-body), system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "var(--font-admin-display), Georgia, serif", // H1 page titles only
} as const

export const type = {
  h1: 42, // Instrument Serif 400, page titles only
  section: 18, // section headings, 600
  label: 14, // field labels, 600
  smallCaps: 13, // uppercase eyebrow / column labels, 600, 0.04em tracking, muted
  body: 15,
  hint: 14,
} as const

export const space = {
  pageMaxWidth: 1180,
  pagePadding: '28px 32px',
  cardGap: 20,
  formGap: 16,
  target: 44, // minimum clickable height
  targetDense: 36, // small buttons inside dense tables only
} as const

// Every number, time and price lines up in columns.
export const tabularNums = { fontVariantNumeric: 'tabular-nums' } as const
