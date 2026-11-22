import { color } from '@/lib/ui/tokens'

// Web app manifest for the staff dashboard, so owners, teachers and front desk can install
// "CalaStudio" on their phone and open straight into the dashboard. One app for every studio (the
// dashboard lives on calastudio.app, not on studio subdomains); members install their studio's own
// site instead (app/[studioSlug]/app-manifest). No file extension in the path, same as the studio one.
//
// Scope is the whole host so signing in (/login, /auth/callback) stays inside the installed app.

export const dynamic = 'force-static'

export function GET() {
  const icon = (size: 192 | 512, purpose: 'any' | 'maskable') => ({
    src: `/dashboard/app-icon/${size}${purpose === 'maskable' ? '?maskable=1' : ''}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose,
  })

  const manifest = {
    id: '/dashboard',
    name: 'CalaStudio',
    short_name: 'CalaStudio',
    description: 'Run your studio: schedule, rosters, check-ins and members.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: color.bg,
    theme_color: color.bg,
    icons: [icon(192, 'any'), icon(512, 'any'), icon(512, 'maskable')],
  }

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  })
}
