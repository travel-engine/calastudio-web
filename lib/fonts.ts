import localFont from 'next/font/local'

// Self-hosted fonts (Fontsource packages, SIL Open Font Licence). They used to come from
// next/font/google, which downloads them from Google at build time; on Vercel that download failed
// often enough to break builds, production included. Latin subset only, as before. next/font/local
// still emits the same CSS variables, preloads and size-adjusted fallbacks.

// Studio sites (Photo First) and the website widget.
export const manrope = localFont({
  src: '../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-manrope',
})

// calastudio.app home page.
export const homeBody = localFont({
  src: '../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-home-body',
})

export const homeDisplay = localFont({
  src: '../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-home-display',
})

// Dashboard.
export const adminBody = localFont({
  src: '../node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2',
  weight: '300 900',
  display: 'swap',
  variable: '--font-admin-body',
})

export const adminDisplay = localFont({
  src: '../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2',
  weight: '400',
  display: 'swap',
  variable: '--font-admin-display',
})
