// Where prospects try the shared demo studio (spec 19). Its own host, served by the develop
// deployment against the staging API; the marketing site links here. Override per environment with
// NEXT_PUBLIC_DEMO_URL if the demo moves.
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || 'https://demo.calastudio.app/demo'

export const DEMO_HOST = (() => {
  try { return new URL(DEMO_URL).host } catch { return '' }
})()
